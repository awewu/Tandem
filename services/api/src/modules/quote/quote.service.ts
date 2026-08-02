import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { QuotationEntity } from './quote.entity';
import { CustomerEntity, OpportunityEntity } from '../crm/crm.entity';
import { AuditLogEntity } from '../governance/governance.entity';
import { JwtPayload } from '../auth/auth.service';
import { PriceGuardrailService, GuardrailLine, GuardrailThresholds } from './price-guardrail.service';
import { EventBusService } from '../mdm/event-bus.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import {
  validateGenerateInput, validateLoadCalcInput, validateEconetInput,
  validateExportInput, validateGuardrailInput, validatePersistInput,
} from './quote.validation';

// Econet 加成引擎（复用 Express 层已有逻辑）
// 精算引擎经 @rhautt/engines 共享包消费（Strangler 收口点），取代深层相对 require。
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EconetPricingEngine, ExportEngine, PromotionEngine } = require('@rhautt/engines');

@Injectable()
export class QuoteService {
  private econet = EconetPricingEngine;

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly guardrail: PriceGuardrailService,
    private readonly eventBus: EventBusService,
  ) {}

  // 报价项 -> 价格护栏行（兼容 price/unitPrice、cost/unitCost、guidePrice 字段别名）
  private toGuardrailLines(items: any[]): GuardrailLine[] {
    return (items ?? []).map((it: any) => ({
      sku: it.sku ?? it.model ?? null,
      name: it.name ?? null,
      unitPrice: Number(it.unitPrice ?? it.price ?? 0),
      unitCost: it.unitCost ?? it.cost ?? undefined,
      guidePrice: it.guidePrice ?? it.listPrice ?? undefined,
      quantity: Number(it.quantity ?? 1),
    }));
  }

  // M11 价格护栏校验（无状态，公开计算）
  async checkGuardrails(dto: { items?: any[]; thresholds?: Partial<GuardrailThresholds> }) {
    validateGuardrailInput(dto); // B1 类型边界：items 数组 / thresholds 对象
    return this.guardrail.evaluate({ items: this.toGuardrailLines(dto.items ?? []), thresholds: dto.thresholds });
  }

  // ── 生成报价（不持久化）────────────────────────────────────────────────────
  async generate(dto: { design?: Record<string, unknown>; devices?: Record<string, unknown>[]; services?: string[] }) {
    validateGenerateInput(dto); // B1 类型边界：design 对象 / devices,services 数组
    const devices = dto.devices ?? [];
    const area = Number((dto.design as any)?.area ?? 100);
    const deviceCost = devices.reduce((s, d: any) => s + Number(d.price ?? 0) * Number(d.quantity ?? 1), 0);
    const installCost = area * 150;
    const subtotal = deviceCost + installCost;
    const tax = Math.round(subtotal * 0.13);
    return { quoteId: `QT${Date.now()}`, summary: { subtotal: Math.round(subtotal), tax, total: Math.round(subtotal + tax), currency: 'CNY' } };
  }

  // ── Econet 加成计算 ────────────────────────────────────────────────────────
  async econetPremium(dto: { devices: { type: string; quantity?: number }[] }) {
    validateEconetInput(dto); // B1 类型边界：devices 必填数组，每项含字符串 type
    if (!this.econet.initialized) await this.econet.initialize();
    return this.econet.calculateEconetPremium(dto);
  }

  // ── 负荷计算 ──────────────────────────────────────────────────────────────
  // 优先调用 ASHRAE 可溯源精算微服务（calc-engine, hvacpy）；verified 结果可喂 M15 门禁。
  // 微服务不可达/未就绪时降级为本地快速估算（unverified，仅参考）。
  async loadCalc(dto: { area: number; city?: string; buildingType?: string; ceilingHeight?: number }) {
    validateLoadCalcInput(dto); // B1 类型边界：area 必填正数（替代原松散 !dto.area 判定）
    const engine = await this.callCalcEngine(dto);
    if (engine && engine.trust_level === 'verified' && engine.cooling_load_kw != null) {
      return {
        coolingLoad: engine.cooling_load_kw,
        heatingLoad: engine.heating_load_kw,
        method: engine.method,
        accuracy: 'ASHRAE (hvacpy)',
        trustLevel: 'verified',
        provenance: engine.provenance,
      };
    }
    const indicators: Record<string, { cooling: number; heating: number }> = {
      residential: { cooling: 120, heating: 100 },
      office: { cooling: 140, heating: 110 },
      commercial: { cooling: 180, heating: 120 },
    };
    const i = indicators[dto.buildingType ?? 'residential'];
    return { coolingLoad: +(dto.area * i.cooling / 1000).toFixed(2), heatingLoad: +(dto.area * i.heating / 1000).toFixed(2), method: 'Quick Estimate', accuracy: '±30%', trustLevel: 'unverified' };
  }

  // 调用精算微服务（短超时 + 优雅降级，绝不阻塞报价）
  private async callCalcEngine(dto: { area: number; city?: string; buildingType?: string; ceilingHeight?: number }): Promise<any | null> {
    const base = process.env.CALC_ENGINE_URL || 'http://localhost:8200';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    try {
      const res = await fetch(`${base}/v1/load-calc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_m2: dto.area,
          ceiling_height_m: dto.ceilingHeight ?? 3,
          city: dto.city ?? 'beijing',
          building_type: dto.buildingType ?? 'residential',
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── 持久化 ────────────────────────────────────────────────────────────────
  async persist(user: JwtPayload, dto: Record<string, unknown>) {
    validatePersistInput(dto); // B1 类型边界：customerId 必填 + 集合字段类型校验
    const tenantId = this.scope(user);
    const quotationNo = `Q2-${String(tenantId).slice(-6).toUpperCase()}-${Date.now()}`;
    return withRlsTransaction(this.ds, async (em) => {
      const quotations = em.getRepository(QuotationEntity);
      const scoped = ownershipScope(user, { hasStore: true });
      const customerId = dto.customerId as string;
      const customer = await em.getRepository(CustomerEntity)
        .findOne({ where: { id: customerId, tenantId, ...scoped } });
      if (!customer) throw new NotFoundException('客户不存在');
      if (dto.opportunityId) {
        const opportunity = await em.getRepository(OpportunityEntity).findOne({ where: {
          id: dto.opportunityId as string,
          customerId,
          tenantId,
          ...scoped,
        } });
        if (!opportunity) throw new NotFoundException('商机不存在');
      }
      const quote = await quotations.save(quotations.create({
        tenantId, dealerId: user.dealerId, storeId: user.storeId,
        customerId: dto.customerId as string, opportunityId: dto.opportunityId as string,
        projectId: null,
        ownerUserId: user.userId, quotationNo,
        status: (dto.status as string) ?? 'draft',
        project: (dto.project as any) ?? {},
        items: (dto.items as any) ?? [],
        systemFamilies: (dto.systemFamilies as string[]) ?? [],
        costBreakdown: (dto.costBreakdown as any) ?? {},
        econetPremium: (dto.econetPremium as any) ?? {},
        taxProfile: (dto.taxProfile as any) ?? {},
      }));
      await this.recordAudit(em, user, 'quotation.create', quote, null);
      await this.eventBus.publishInTx(em, {
        tenantId, eventType: 'quotation.created', aggregateType: 'quotation', aggregateId: quote.id,
        payload: { quotationId: quote.id, quotationNo, customerId: quote.customerId, opportunityId: quote.opportunityId },
      });
      return quote;
    }, this.rls(user));
  }

  list(user: JwtPayload, query: Record<string, string>) {
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(QuotationEntity).createQueryBuilder('q').where('q.tenantId = :t', { t: this.scope(user) });
      // dealer/store 归属过滤（RLS 仅兜 tenant）
      if (user.storeId)       qb.andWhere('q.storeId = :s',  { s: user.storeId });
      else if (user.dealerId) qb.andWhere('q.dealerId = :d', { d: user.dealerId });
      if (query.customerId)    qb.andWhere('q.customerId = :c',    { c: query.customerId });
      if (query.opportunityId) qb.andWhere('q.opportunityId = :o', { o: query.opportunityId });
      if (query.status)        qb.andWhere('q.status = :s',        { s: query.status });
      return qb.orderBy('q.updatedAt', 'DESC').limit(20).getMany();
    }, this.rls(user));
  }

  exportQuote(dto: Record<string, unknown>) {
    validateExportInput(dto); // B1 类型边界：body 对象 / format 字符串
    const engine = new ExportEngine();
    const fmt = (dto.format as string) || 'excel';
    return engine.exportQuotation(dto, fmt);
  }

  // ── M11 · 价格快照锁定（PRD 4.9）─────────────────────────────────────────
  // 报价确认时冻结所选 SKU 的价格/参数；品牌库后续改价不影响已锁报价。
  async lockQuotation(user: JwtPayload, id: string) {
    const t = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const quotations = em.getRepository(QuotationEntity);
      const quote = await quotations.findOne({ where: { id, tenantId: t, ...ownershipScope(user, { hasStore: true }) } });
      if (!quote) throw new NotFoundException('报价不存在');
      if ((quote.quotationLock as any)?.locked) return quote; // 幂等：已锁直接返回
      const beforeState = this.quoteAuditState(quote);

      // 锁价前过价格护栏：block 级违规阻断锁定
      const guardrail = await this.guardrail.evaluate({ items: this.toGuardrailLines(quote.items as any[]) });
      if (guardrail.blocked) {
        throw new BadRequestException({ message: '报价未通过价格护栏，无法锁定', violations: guardrail.violations, facts: guardrail.facts });
      }
      const snapshotItems = (quote.items || []).map((it: any) => ({
        sku: it.sku ?? it.model ?? null,
        globalProductId: it.globalProductId ?? null,
        name: it.name ?? null,
        unitPrice: it.price ?? it.unitPrice ?? null,
        quantity: it.quantity ?? 1,
        params: it.params ?? null,
      }));
      quote.priceSnapshot = {
        frozenAt: new Date().toISOString(),
        items: snapshotItems,
        costBreakdown: quote.costBreakdown,
        taxProfile: quote.taxProfile,
      };
      quote.quotationLock = {
        locked: true,
        lockedAt: new Date().toISOString(),
        lockedBy: user.userId,
        lockedVersion: ((quote.quotationLock as any)?.lockedVersion ?? 0) + 1,
        guardrail: { passed: guardrail.passed, violations: guardrail.violations, facts: guardrail.facts },
      };
      quote.status = quote.status === 'draft' ? 'locked' : quote.status;
      const saved = await quotations.save(quote);
      await this.recordAudit(em, user, 'quotation.lock', saved, beforeState);
      await this.eventBus.publishInTx(em, {
        tenantId: t, eventType: 'quotation.locked', aggregateType: 'quotation', aggregateId: saved.id,
        payload: { quotationId: saved.id, lockedBy: user.userId, status: saved.status },
      });
      return saved;
    }, this.rls(user));
  }

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }

  private quoteAuditState(quote: Record<string, any>) {
    const fields = [
      'id', 'tenantId', 'dealerId', 'storeId', 'customerId', 'opportunityId', 'projectId',
      'ownerUserId', 'quotationNo', 'status', 'source', 'systemFamilies', 'quotationLock',
    ];
    return fields.reduce<Record<string, unknown>>((result, field) => {
      if (quote[field] !== undefined) result[field] = quote[field];
      return result;
    }, {});
  }

  private async recordAudit(
    em: EntityManager,
    user: JwtPayload,
    action: string,
    quote: Record<string, any>,
    beforeState: Record<string, unknown> | null,
  ) {
    const audits = em.getRepository(AuditLogEntity);
    await audits.save(audits.create({
      tenantId: this.scope(user),
      actorUserId: user.userId || null,
      action,
      resourceType: 'quotation',
      resourceId: quote.id,
      beforeState,
      afterState: this.quoteAuditState(quote),
      requestId: null,
      traceId: null,
      ipHash: null,
    }));
  }
}
