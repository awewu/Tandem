import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DesignProjectEntity, DesignReleaseEntity, FloorPlanEntity } from './design.entity';
import { CustomerEntity, OpportunityEntity } from '../crm/crm.entity';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import { evaluateGate, GateInput, GateResult } from './calc-gate';
import { buildCalcReport } from './calc-report';
import { computeHotWaterDesign, HotWaterCandidate } from './hot-water-sizing';
import { GlobalProductEntity } from '../mdm/master-data.entity';
import { buildSystemSchematicSvg } from './design-diagram';
import { parseDxf } from './dxf-import';
import { EventBusService } from '../mdm/event-bus.service';
import { ProductCatalogService } from '../product-catalog/product-catalog.service';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// W1 精算归位：直连 hvac-kernels 单一真相源（原 server/core 仅为 re-export 薄壳）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LoadCalcV3 = require('../../../../../packages/domain/hvac-kernels/load-calculation/LoadCalculationEngineV3');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WaterSystemEngine } = require('../../../../../packages/domain/hvac-kernels/water-system');
// 水力平衡内核（Darcy-Weisbach 沿程+局部阻力、树状流量分配、最不利环路、水泵扬程）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { HydraulicEngine } = require('../../../../../packages/domain/hvac-kernels/hydraulic');
// CFD 气流组织/热舒适仿真引擎（PMV/PPD、热点、吹风感、优化建议）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CFDSimulationEngine = require('../../../../../server/core/CFDSimulationEngine');
import { autoRoutePipes } from './auto-route';

// 七系统（独立系统层）与五恒维度（舒适维度层）—— 两层模型（决议#3）
type SystemKey = 'hotWater' | 'water' | 'heating' | 'airConditioning' | 'freshAir' | 'humidity' | 'control';
const SYSTEM_LABELS: Record<SystemKey, string> = {
  hotWater: '热水', water: '净水', heating: '采暖', airConditioning: '制冷',
  freshAir: '新风', humidity: '恒湿/除湿(DOAS)', control: '控制',
};

// P1 · 设备推荐 / BOM 引擎：七系统的产品目录匹配关键词 + 辅材面积系数（工程估算）。
// 关键词供 product-catalog 价带匹配；系数为辅材量算经验值（管路 m/㎡、阀门基数、人工工时/㎡）。
const SYSTEM_SOURCING: Record<SystemKey, { label: string; keywords: string[]; pipePerArea: number; valveBase: number; laborPerArea: number }> = {
  hotWater:        { label: '热水', keywords: ['热水器', '壁挂炉', 'water heater', 'boiler', 'heater'], pipePerArea: 0.42, valveBase: 8, laborPerArea: 0.9 },
  water:           { label: '净水', keywords: ['净水', '软水', '前置', 'RO', '反渗透', 'purifier', 'softener'], pipePerArea: 0.18, valveBase: 5, laborPerArea: 0.4 },
  heating:         { label: '采暖', keywords: ['采暖', '地暖', '暖气片', '热泵', 'radiator', 'floor heating', 'heat pump'], pipePerArea: 0.72, valveBase: 10, laborPerArea: 1.2 },
  airConditioning: { label: '制冷', keywords: ['空调', '多联机', '风管机', 'VRF', 'air condition'], pipePerArea: 0.48, valveBase: 7, laborPerArea: 1.35 },
  freshAir:        { label: '新风', keywords: ['新风', '全热交换', 'ERV', 'fresh air', 'ventilation'], pipePerArea: 0.55, valveBase: 6, laborPerArea: 0.85 },
  humidity:        { label: '恒湿/除湿', keywords: ['除湿', '恒湿', 'DOAS', 'dehumid'], pipePerArea: 0.30, valveBase: 4, laborPerArea: 0.5 },
  control:         { label: '控制', keywords: ['控制', '智能', '网关', '温控', 'control', 'gateway', 'thermostat'], pipePerArea: 0.08, valveBase: 2, laborPerArea: 0.25 },
};

const LABOR_RATE = 120; // 元/工时（估算口径，正式报价以合同为准）

export interface DesignCalcInput extends GateInput {
  area?: number;
  city?: string;
  buildingType?: string;
  systems?: SystemKey[]; // 本方案选用的系统
  waterParams?: Record<string, unknown>; // 净水系统设计入参（houseType/residents/bathrooms/waterQuality…）
  hotWaterParams?: Record<string, unknown>; // 热水系统精算入参（residents/inletTempC/targetTempC/perCapitaLiters/recoveryHours…）
}

@Injectable()
export class DesignService {
  private readonly engine = new LoadCalcV3();
  private readonly waterEngine = new WaterSystemEngine();
  private readonly hydraulicEngine = new HydraulicEngine();
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly eventBus: EventBusService,
    private readonly productCatalog: ProductCatalogService,
  ) {}

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: user.tenantId, actorId: user.userId ?? undefined, role: user.role };
  }

  async quickEstimate(area: number, city: string, buildingType: string) {
    return this.engine.quickEstimate(area, city, buildingType);
  }

  /**
   * W-BIM-1 · verified 精算链路：调 calc-engine(hvacpy, ASHRAE 可溯源)。
   * 不可用/超时/异常 → 返回 null，上层降级为 estimate（诚实标注，不伪装）。
   */
  private async fetchVerifiedLoad(params: { area: number; city: string; buildingType: string }): Promise<Record<string, any> | null> {
    if (!params.area || params.area <= 0) return null;
    const base = process.env.CALC_ENGINE_URL || 'http://localhost:8200';
    // calc-engine 气象库用拼音城市名；中文城市做最小映射，未命中由 calc-engine 自行降级并返回 warning
    const CITY_MAP: Record<string, string> = {
      上海: 'shanghai', 北京: 'beijing', 广州: 'guangzhou', 深圳: 'shenzhen',
      杭州: 'hangzhou', 南京: 'nanjing', 成都: 'chengdu', 重庆: 'chongqing',
      武汉: 'wuhan', 西安: 'xian', 青岛: 'qingdao', 济南: 'jinan',
    };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    try {
      const res = await fetch(`${base}/v1/load-calc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          area_m2: params.area,
          city: CITY_MAP[params.city] || params.city,
          building_type: params.buildingType,
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as Record<string, any>;
    } catch {
      return null; // 不可达/超时 → 上层降级 estimate
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * W-BIM-1 · 1.7：水路设计产出必须引用产品模块，禁止硬编码设备/品牌。
   * 第一步：用产品目录 `priceBandsForSystems` 拉取真实上架产品及其牌价，
   * 与 kernel 计算结果合并；后续逐步把 capacity/flow/material 等参数也迁入产品 spec。
   * 失败时返回 null，不阻塞既有 kernel 输出（降级保持可用）。
   */
  private async enrichWaterSystemWithProducts(user: JwtPayload): Promise<Record<string, any> | null> {
    try {
      const r = await this.productCatalog.priceBandsForSystems(
        { tenantId: user.tenantId },
        [
          { code: 'water', label: '净水', keywords: ['净水', '软水', '前置过滤', 'RO', '反渗透', 'water', 'purifier', 'softener'] },
          { code: 'hotWater', label: '热水', keywords: ['热水器', '壁挂炉', 'water heater', 'boiler', 'heater'] },
        ],
      );
      return r?.data ?? null;
    } catch {
      return null;
    }
  }

  /**
   * P1-1 ②③ · 拉取热水主机候选（真相源 = mdm_global_products）。
   * 仅返回带可信度分级(dataTrustLevel)与精算参数(canonicalParams)的产品；
   * 选型引擎据此裁决——仅 verified 驱动精算，calibrated/unverified 只进 BOM。
   * 失败/无数据返回空数组（选型引擎将给 insufficient_data，不伪装）。
   */
  private async fetchHotWaterCandidates(user: JwtPayload): Promise<HotWaterCandidate[]> {
    const KW = ['热水', '热泵热水', '空气能', '壁挂炉', 'water heater', 'boiler', 'heater'];
    try {
      const repo = this.ds.getRepository(GlobalProductEntity);
      // owned/shared 全租户可见；tenant-private 仅本租户。
      const rows = await repo
        .createQueryBuilder('p')
        .where('(p.tenant_id IS NULL OR p.tenant_id = :t)', { t: user.tenantId ?? '' })
        .take(1000)
        .getMany();
      return rows
        .filter((p) => {
          const sys = String((p.canonicalParams as any)?.system ?? '').toLowerCase();
          if (sys === 'hotwater' || sys === 'hot_water' || sys === '热水') return true;
          const hay = `${p.name} ${p.sku}`.toLowerCase();
          return KW.some((k) => hay.includes(k.toLowerCase()));
        })
        .map((p) => ({
          globalProductId: p.globalProductId,
          sku: p.sku,
          name: p.name,
          dataTrustLevel: p.dataTrustLevel,
          canonicalParams: p.canonicalParams || {},
          listPrice: Number((p.canonicalParams as any)?.listPrice) || null,
        }));
    } catch {
      return [];
    }
  }

  /**
   * 把 product-catalog.priceBandsForSystems 返回的价带映射为 WaterSystemEngine 可接受的
   * deviceCatalog 子集。当前只覆盖价格字段，后续随产品 spec 丰富扩展 capacity/flow/material。
   */
  private mapProductBandsToWaterDeviceCatalog(bands: Record<string, any>): Record<string, any> {
    if (!bands || !Array.isArray(bands.bands)) return {};
    const catalog: Record<string, any> = {};
    for (const band of bands.bands) {
      if (!band.priced || !Array.isArray(band.prices) || band.prices.length === 0) continue;
      const prices = band.prices as number[];
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const priceRange = `${min}-${max}元`;
      if (band.code === 'hotWater') {
        catalog.hotWater = {
          central: { estimatedPrice: priceRange },
          instant: { estimatedPrice: priceRange },
        };
      }
      if (band.code === 'water') {
        catalog.softener = {
          premium: { estimatedPrice: priceRange },
          standard: { estimatedPrice: priceRange },
          alternative: { estimatedPrice: priceRange },
        };
        catalog.pureWater = {
          preFilter: { price: priceRange },
          centralFilter: { price: priceRange },
          roSystem: { totalPrice: priceRange },
          allInOne: { totalPrice: priceRange },
        };
      }
    }
    return catalog;
  }

  /**
   * design calc 编排器（W1/W-BIM-1）：负荷（估算+verified 双轨）+ 七系统 + 五恒维度 + 必算校验闸（软闸）。
   * 不落库；供 POST /design/calc 出方案预算 + 闸结论。
   * trust 分级：verified（calc-engine/hvacpy，带 ASHRAE 出处链）> estimate（LoadCalcV3 前期快估）。
   */
  async runCalc(input: DesignCalcInput = {}, user?: JwtPayload) {
    const area = Number(input.area) || 0;
    const city = input.city || '上海';
    const buildingType = input.buildingType || 'residential';

    // Layer 1 · 独立系统层：估算（快）+ verified 精算（可辩护）双轨
    const load = area > 0 ? this.engine.quickEstimate(area, city, buildingType) : null;
    const verifiedLoad = await this.fetchVerifiedLoad({ area, city, buildingType });
    const loadTrust: 'verified' | 'estimate' =
      verifiedLoad && verifiedLoad.trust_level === 'verified' ? 'verified' : 'estimate';
    const selected = Array.isArray(input.systems) ? input.systems : [];

    // 1.7：若方案含 water，先拉取产品模块价带并映射为 engine deviceCatalog，
    // 使 kernel 产出的设备价格/品牌来自产品真相源，而非硬编码。
    let waterDeviceCatalog: Record<string, any> | null = null;
    let waterProductBands: Record<string, any> | null = null;
    if (user && selected.includes('water')) {
      waterProductBands = await this.enrichWaterSystemWithProducts(user);
      if (waterProductBands) {
        waterDeviceCatalog = this.mapProductBandsToWaterDeviceCatalog(waterProductBands);
      }
    }

    // P1-1 ②③：热水系统选中 → 拉取候选主机（真相源 mdm_global_products），跑真负荷+选型。
    let hotWaterCandidates: HotWaterCandidate[] = [];
    if (user && selected.includes('hotWater')) {
      hotWaterCandidates = await this.fetchHotWaterCandidates(user);
    }

    const systems = (Object.keys(SYSTEM_LABELS) as SystemKey[]).map((key) => {
      const entry: { key: SystemKey; label: string; selected: boolean; design?: unknown; productBands?: any } = {
        key, label: SYSTEM_LABELS[key], selected: selected.includes(key),
      };
      // 热水系统选中 → 负荷(面积/人数/城市/水温)→选型(仅 verified 驱动)真精算链路
      if (key === 'hotWater' && entry.selected) {
        try {
          entry.design = computeHotWaterDesign(
            { area, city, ...(input.hotWaterParams || {}) },
            hotWaterCandidates,
          );
        } catch {
          entry.design = { error: 'hot_water_design_failed' };
        }
      }
      // 净水系统选中 → 直连 water kernel 产出独立设计（恒洁维度依据）
      if (key === 'water' && entry.selected) {
        try {
          entry.design = this.waterEngine.generateDesign(
            { area, city, ...(input.waterParams || {}) },
            waterDeviceCatalog || undefined,
          );
        } catch {
          entry.design = { error: 'water_design_failed' };
        }
      }
      if (key === 'water' && entry.selected && waterProductBands) {
        entry.productBands = waterProductBands;
      }
      return entry;
    });

    // 必算校验闸（软闸 + 签字越过）
    const gate: GateResult = evaluateGate(input);
    const gc = (k: string) => gate.checks.find((c) => c.key === k);

    // Layer 2 · 五恒维度达标表（维度≠系统；由系统+闸映射）
    const comfortDimensions = [
      { key: 'temp', label: '恒温', basis: '负荷/采暖/制冷', status: load ? 'evaluated' : 'insufficient_data',
        ok: load ? true : null },
      { key: 'humidity', label: '恒湿', basis: '独立除湿(DOAS)/结露校验',
        status: gc('condensation')?.status ?? 'insufficient_data',
        ok: gc('condensation') ? gc('condensation')!.status === 'pass' : null },
      { key: 'oxygen', label: '恒氧', basis: '新风系统',
        status: selected.includes('freshAir') ? 'evaluated' : 'insufficient_data',
        ok: selected.includes('freshAir') ? true : null },
      { key: 'clean', label: '恒洁', basis: '过滤/净水',
        status: (selected.includes('freshAir') || selected.includes('water')) ? 'evaluated' : 'insufficient_data',
        ok: (selected.includes('freshAir') || selected.includes('water')) ? true : null },
      { key: 'quiet', label: '恒静', basis: '室内噪声 GB 50118',
        status: gc('noise')?.status ?? 'insufficient_data',
        ok: gc('noise') ? gc('noise')!.status === 'pass' : null },
    ];

    return {
      success: true,
      data: {
        input: { area, city, buildingType },
        load,
        // W-BIM-1 verified 链路：calc-engine(hvacpy) 结果，含 trust_level/provenance(ASHRAE 出处)/warnings；
        // 不可用时为 null，loadTrust 降级 estimate（诚实标注，禁伪装 verified）
        verifiedLoad,
        loadTrust,
        provenance: verifiedLoad?.provenance ?? null,
        systems,
        comfortDimensions,
        gate,
        // 软闸结论：releasable=true 才可直接出图/锁价；否则需经销商签字越过
        releasable: gate.pass !== false,
        requiresOverride: gate.requiresOverride,
        disclaimer: loadTrust === 'verified'
          ? '负荷为 ASHRAE 可溯源精算（见 provenance）；合规校验依国标基线。最终合规与选型由经销商负责。'
          : '本计算为工程估算（精算服务不可用或未达 verified），依据国标基线；最终合规与选型由经销商负责，平台（设备制造商）不承担设计责任。',
      },
    };
  }

  async saveFloorPlan(user: JwtPayload, body: any) {
    const fp = body.floorPlan ?? body;
    return withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(DesignProjectEntity);
      const plans = em.getRepository(FloorPlanEntity);
      let project = body.projectId
        ? await projects.findOne({ where: { id: body.projectId, tenantId: user.tenantId, ...ownershipScope(user) } })
        : null;
      if (!project) {
        project = await projects.save(projects.create({
          tenantId: user.tenantId, dealerId: user.dealerId ?? null,
          name: body.name || '未命名方案', status: 'draft',
          meta: { customerId: body.customerId },
        }));
      }
      // 版本递增：取同一 project 最新 floor_plan 版本，+1
      const latest = await plans.findOne({
        where: { tenantId: user.tenantId, projectId: project.id },
        order: { createdAt: 'DESC' },
      });
      const nextVersion = this.bumpVersion(latest?.version ?? 'v0');
      const plan = await plans.save(plans.create({
        tenantId: user.tenantId, projectId: project.id, version: nextVersion,
        walls: fp.walls ?? [], equipment: fp.equipment ?? body.equipment ?? {}, rooms: fp.rooms ?? [],
        doors: fp.doors ?? body.doors ?? null, windows: fp.windows ?? body.windows ?? null, furniture: fp.furniture ?? body.furniture ?? null,
        pipes: fp.pipes ?? body.hvac ?? [],
        devices: fp.devices ?? [],
        cadImageUrl: fp.cadImageUrl ?? null,
        meta: body.meta ?? {},
      }));
      // W-BIM-2 · 2.1：design 变更 → outbox，触发派生产物 stale + quote 重算
      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId,
        eventType: 'design.changed',
        aggregateType: 'design',
        aggregateId: project.id,
        payload: {
          designProjectId: project.id,
          designVersion: nextVersion,
          floorPlanId: plan.id,
          opportunityId: project.opportunityId ?? null,
          dealerId: user.dealerId ?? null,
          changedBy: user.userId ?? null,
        },
      });
      return { success: true, data: { projectId: project.id, planId: plan.id, version: nextVersion } };
    }, this.rls(user));
  }

  private bumpVersion(v: string): string {
    const m = /^v(\d+)$/.exec(v);
    const n = m ? Number(m[1]) : 0;
    return `v${n + 1}`;
  }

  async listProjects(user: JwtPayload) {
    return withRlsTransaction(this.ds, async (em) => {
      const items = await em.getRepository(DesignProjectEntity).find({
        where: { tenantId: user.tenantId, ...ownershipScope(user) }, order: { updatedAt: 'DESC' }, take: 50,
      });
      return { success: true, data: { items } };
    }, this.rls(user));
  }

  async createProjectFromOpportunity(user: JwtPayload, body: {
    opportunityId: string; customerId: string; name?: string;
    area?: number; city?: string; systems?: string[]; painPoints?: string[];
  }) {
    const { opportunityId, customerId } = body;
    if (!opportunityId || !customerId) throw new BadRequestException('opportunityId and customerId required');
    return withRlsTransaction(this.ds, async (em) => {
      const customers = em.getRepository(CustomerEntity);
      const opportunities = em.getRepository(OpportunityEntity);
      const projects = em.getRepository(DesignProjectEntity);

      const customer = await customers.findOne({
        where: { id: customerId, tenantId: user.tenantId, ...ownershipScope(user, { hasStore: true }) },
      });
      if (!customer) throw new NotFoundException('customer not found');

      const opportunity = await opportunities.findOne({
        where: { id: opportunityId, tenantId: user.tenantId, customerId, ...ownershipScope(user, { hasStore: true }) },
      });
      if (!opportunity) throw new NotFoundException('opportunity not found');

      const name = body.name || `${customer.name} · ${body.city || customer.city || '未命名'}方案`;
      const project = await projects.save(projects.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        customerId,
        opportunityId,
        name,
        status: 'draft',
        meta: {
          area: body.area ?? customer.profile?.area ?? null,
          city: body.city || customer.city,
          systems: body.systems ?? [],
          painPoints: body.painPoints ?? [],
          source: 'crm-opportunity',
        },
      }));

      await this.eventBus.publishInTx(em, {
        tenantId: user.tenantId,
        eventType: 'design.project.created',
        aggregateType: 'design',
        aggregateId: project.id,
        payload: {
          designProjectId: project.id,
          customerId,
          opportunityId,
          dealerId: user.dealerId ?? null,
          createdBy: user.userId ?? null,
        },
      });

      return { success: true, data: project };
    }, this.rls(user));
  }

  async getLatestPlan(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      // floor_plans 无 dealer 列，经父项目归属校验，防同租户跨经销商读图
      const project = await em.getRepository(DesignProjectEntity)
        .findOne({ where: { id: projectId, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!project) throw new NotFoundException('design project not found');
      const plan = await em.getRepository(FloorPlanEntity).findOne({
        where: { tenantId: user.tenantId, projectId }, order: { createdAt: 'DESC' },
      });
      return { success: true, data: { floorPlan: plan } };
    }, this.rls(user));
  }

  /**
   * 3.5 · BOM 价格带：读取项目最新户型的系统列表，返回产品目录真实牌价分布。
   * 当前取 devices 的 systemType 作为系统关键词；无 product catalog 数据时返回 priced=false。
   */
  async getBomPriceBands(user: JwtPayload, projectId: string) {
    const planRes = await this.getLatestPlan(user, projectId);
    const plan = planRes.data.floorPlan;
    const devices: any[] = ((plan?.devices ?? []) as unknown as any[]);
    const pipes: any[] = ((plan?.pipes ?? []) as unknown as any[]);
    const systemCodes = Array.from(new Set<string>([
      ...devices.map((d) => String(d.systemType || '').trim()).filter(Boolean),
      ...pipes.map((p) => String(p.systemType || 'hvac').trim()).filter(Boolean),
    ]));

    const systems = systemCodes.map((code) => ({
      code,
      label: SYSTEM_LABELS[code as SystemKey] || code,
      keywords: [code, SYSTEM_LABELS[code as SystemKey] || code].filter(Boolean),
    }));

    if (systems.length === 0) {
      return { success: true, data: { bands: [], note: '未识别到系统，无法生成价格带' } };
    }

    const priceRes = await this.productCatalog.priceBandsForSystems(
      { tenantId: user.tenantId },
      systems,
    );
    return { success: true, data: priceRes.data };
  }

  /**
   * 3.5 · BOM/工程图 PDF 导出：用 pdf-lib 生成含图签、户型统计、BOM 表、价格带的 PDF。
   * 解决 W-BIM 上线阻塞项 #3（PDF 工程图导出）。
   */
  async exportBomPdf(user: JwtPayload, projectId: string) {
    const planRes = await this.getLatestPlan(user, projectId);
    const plan = planRes.data.floorPlan;
    const priceRes = await this.getBomPriceBands(user, projectId);
    const bands = priceRes.data?.bands ?? [];

    const devices: any[] = ((plan?.devices ?? []) as unknown as any[]);
    const pipes: any[] = ((plan?.pipes ?? []) as unknown as any[]);
    const walls: any[] = ((plan?.walls ?? []) as unknown as any[]);
    const rooms: any[] = ((plan?.rooms ?? []) as unknown as any[]);

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 40;
    let y = height - margin;

    const drawText = (text: string, size: number, x: number, yPos: number, bold = false) => {
      page.drawText(text, { x, y: yPos, size, font: bold ? fontBold : font, color: rgb(0, 0, 0) });
    };

    const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: rgb(0, 0, 0) });
    };

    // 图签 / 标题
    drawText('HVAC 工程图与 BOM 清单', 18, margin, y, true);
    y -= 22;
    drawText(`项目编号: ${projectId}`, 10, margin, y);
    drawText(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 10, width - margin - 160, y);
    y -= 14;
    drawLine(margin, y, width - margin, y);
    y -= 20;

    // 户型统计
    drawText('户型统计', 12, margin, y, true);
    y -= 16;
    drawText(`墙: ${walls.length}  房间: ${rooms.length}  设备: ${devices.length}  管段: ${pipes.length}`, 10, margin, y);
    y -= 20;

    // BOM 表
    drawText('设备清单', 12, margin, y, true);
    y -= 16;
    const colX = [margin, margin + 120, margin + 240, margin + 340, margin + 420];
    const headers = ['名称', '系统', '型号', '数量', '位置'];
    headers.forEach((h, i) => drawText(h, 9, colX[i], y, true));
    y -= 12;
    drawLine(margin, y, width - margin, y);
    y -= 12;
    for (const d of devices.slice(0, 30)) {
      drawText(String(d.name || '-').slice(0, 18), 9, colX[0], y);
      drawText(String(d.systemType || '-').slice(0, 14), 9, colX[1], y);
      drawText(String(d.model || '-').slice(0, 14), 9, colX[2], y);
      drawText(String(d.quantity ?? 1), 9, colX[3], y);
      drawText(`(${Number(d.x ?? 0).toFixed(0)}, ${Number(d.y ?? 0).toFixed(0)})`, 9, colX[4], y);
      y -= 12;
      if (y < margin + 60) break;
    }
    y -= 10;

    // 价格带
    if (bands.length > 0 && y > margin + 60) {
      drawText('产品目录价格带', 12, margin, y, true);
      y -= 16;
      for (const b of bands) {
        const prices = Array.isArray(b.prices) ? b.prices : [];
        const range = prices.length ? `${Math.min(...prices)} - ${Math.max(...prices)} 元` : '未定价';
        drawText(`${b.label || b.code}: ${range}`, 9, margin, y);
        y -= 12;
        if (y < margin + 40) break;
      }
    }

    // 图签框（右下角）
    const titleBlockW = 140;
    const titleBlockH = 50;
    const tbX = width - margin - titleBlockW;
    const tbY = margin;
    page.drawRectangle({ x: tbX, y: tbY, width: titleBlockW, height: titleBlockH, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
    drawText('瑞诺瓦 · 设计交付', 9, tbX + 6, tbY + titleBlockH - 14, true);
    drawText('版本: v1', 8, tbX + 6, tbY + titleBlockH - 28);
    drawText('状态: 初稿', 8, tbX + 6, tbY + titleBlockH - 40);

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  // ── 签章状态机：draft → reviewed → released（软闸 + 签字越过） ───────────
  /** 起草：跑校验闸并落 draft 台账，快照闸结论 */
  async createRelease(user: JwtPayload, body: DesignCalcInput & { projectId?: string; customerId?: string }) {
    const calc = await this.runCalc(body, user);
    const gate = calc.data.gate;
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignReleaseEntity);
      const row = await repo.save(repo.create({
        tenantId: user.tenantId, dealerId: user.dealerId ?? null,
        projectId: body.projectId ?? null, customerId: body.customerId ?? null,
        status: 'draft',
        calcSnapshot: calc.data as unknown as Record<string, unknown>,
        gatePass: gate.pass, gateBlocked: gate.blocked,
        overrideRequired: gate.requiresOverride,
      }));
      return { success: true, data: { id: row.id, status: row.status, gate } };
    }, this.rls(user));
  }

  /** 评审：draft → reviewed */
  async reviewRelease(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignReleaseEntity);
      const row = await repo.findOne({ where: { id, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!row) throw new NotFoundException('release not found');
      if (row.status !== 'draft') throw new ConflictException(`仅 draft 可评审，当前 ${row.status}`);
      row.status = 'reviewed';
      row.reviewedBy = user.userId ?? null;
      row.reviewedAt = new Date();
      await repo.save(row);
      return { success: true, data: { id: row.id, status: row.status } };
    }, this.rls(user));
  }

  /** 软闸签字越过：blocked 时经销商显式签署免责越过（留审计） */
  async signOverride(user: JwtPayload, id: string, reason: string) {
    if (!reason || !reason.trim()) throw new BadRequestException('越过须填写免责理由');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignReleaseEntity);
      const row = await repo.findOne({ where: { id, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!row) throw new NotFoundException('release not found');
      if (!row.overrideRequired) throw new ConflictException('校验闸未拦截，无需签字越过');
      row.overrideSigned = true;
      row.overrideBy = user.userId ?? null;
      row.overrideReason = reason.trim();
      row.overrideSignedAt = new Date();
      await repo.save(row);
      return { success: true, data: { id: row.id, overrideSigned: true } };
    }, this.rls(user));
  }

  /** 放行：reviewed → released；blocked 须先签字越过；须确认免责声明 */
  async releaseDesign(user: JwtPayload, id: string, opts: { disclaimerAccepted?: boolean } = {}) {
    if (!opts.disclaimerAccepted) throw new BadRequestException('须确认免责声明（经销商为责任主体）后方可放行');
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignReleaseEntity);
      const row = await repo.findOne({ where: { id, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!row) throw new NotFoundException('release not found');
      if (row.status !== 'reviewed') throw new ConflictException(`仅 reviewed 可放行，当前 ${row.status}`);
      if (row.gateBlocked && !row.overrideSigned) {
        throw new ConflictException('校验闸拦截：须经销商签字越过后方可放行');
      }
      row.status = 'released';
      row.releasedBy = user.userId ?? null;
      row.releasedAt = new Date();
      row.disclaimerAccepted = true;
      await repo.save(row);

      // M12 · 放行即真相源新版本锚点 → 同事务发 design.released（outbox）。
      // 消费方（event-consumers）调 design-sync.onDesignChanged，把该 design 的
      // 全部 Rysnova 派生产物置 stale（须重做深化）。releaseId 作为版本锚点。
      if (row.projectId) {
        await this.eventBus.publishInTx(em, {
          tenantId: user.tenantId,
          eventType: 'design.released',
          aggregateType: 'design_project',
          aggregateId: row.projectId,
          payload: { designId: row.projectId, version: row.id, releaseId: row.id, releasedBy: user.userId ?? null },
        });
      }
      return { success: true, data: { id: row.id, status: row.status, overrideUsed: row.overrideSigned } };
    }, this.rls(user));
  }

  async getRelease(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await em.getRepository(DesignReleaseEntity).findOne({ where: { id, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!row) throw new NotFoundException('release not found');
      return { success: true, data: row };
    }, this.rls(user));
  }

  /** 计算书（W-BIM-1 · 1.5b）：从 release 快照生成结构化计算书（报告结构学 HAP 样张） */
  async getReleaseReport(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const row = await em.getRepository(DesignReleaseEntity).findOne({ where: { id, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!row) throw new NotFoundException('release not found');
      const report = buildCalcReport(row.calcSnapshot ?? {}, {
        id: row.id, status: row.status, gatePass: row.gatePass,
        overrideSigned: !!row.overrideSigned,
        reviewedAt: row.reviewedAt ?? null, releasedAt: row.releasedAt ?? null,
      });
      return { success: true, data: report };
    }, this.rls(user));
  }

  // ── 工作区状态（BIM 编辑器自动保存与恢复）────────────────────────────────
  /** 保存工作区状态到 design_projects.meta.workspaceState（逐版本覆盖）。 */
  async saveWorkspaceState(user: JwtPayload, projectId: string, state: Record<string, unknown>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const project = await repo.findOne({ where: { id: projectId, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!project) throw new NotFoundException('design project not found');
      project.meta = { ...(project.meta ?? {}), workspaceState: state, workspaceStateAt: new Date().toISOString() };
      await repo.save(project);
      return { success: true, data: { projectId, savedAt: project.meta.workspaceStateAt } };
    }, this.rls(user));
  }

  /** 读取工作区状态（BIM 编辑器重入时恢复草稿）。 */
  async getWorkspaceState(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const project = await em.getRepository(DesignProjectEntity)
        .findOne({ where: { id: projectId, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!project) throw new NotFoundException('design project not found');
      const state = (project.meta as any)?.workspaceState ?? null;
      return { success: true, data: { projectId, state, savedAt: (project.meta as any)?.workspaceStateAt ?? null } };
    }, this.rls(user));
  }

  /** 保存设计进度（百分比 + 最后完成步骤）到 meta.progress。 */
  async saveProgress(user: JwtPayload, projectId: string, body: { step?: string; percent?: number; note?: string }) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const project = await repo.findOne({ where: { id: projectId, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!project) throw new NotFoundException('design project not found');
      const progress = { step: body.step ?? null, percent: body.percent ?? null, note: body.note ?? null, updatedAt: new Date().toISOString() };
      project.meta = { ...(project.meta ?? {}), progress };
      await repo.save(project);
      return { success: true, data: { projectId, progress } };
    }, this.rls(user));
  }

  /** 读取设计进度。 */
  async getProgress(user: JwtPayload, projectId: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const project = await em.getRepository(DesignProjectEntity)
        .findOne({ where: { id: projectId, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!project) throw new NotFoundException('design project not found');
      const progress = (project.meta as any)?.progress ?? null;
      return { success: true, data: { projectId, progress } };
    }, this.rls(user));
  }

  /** 自动保存（防抖写）：合并 state patch 到 workspaceState，幂等。 */
  async autosave(user: JwtPayload, projectId: string, patch: Record<string, unknown>) {
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const project = await repo.findOne({ where: { id: projectId, tenantId: user.tenantId, ...ownershipScope(user) } });
      if (!project) throw new NotFoundException('design project not found');
      const prev = (project.meta as any)?.workspaceState ?? {};
      project.meta = { ...(project.meta ?? {}), workspaceState: { ...prev, ...patch }, workspaceStateAt: new Date().toISOString() };
      await repo.save(project);
      return { success: true, data: { projectId, autosavedAt: project.meta.workspaceStateAt } };
    }, this.rls(user));
  }

  // ── 候选端点（Stub · 计算服务未接入）────────────────────────────────────
  // 以下方法均有路由、有契约形状，但重计算路径尚未接入具体引擎。
  // 返回结构化占位响应（不返回 null/503），前端可据 implemented=false 判断并降级。

  /** quick/estimate：/design/load-calc 的 RESTful 别名，同转 LoadCalcV3。 */
  async quickEstimateV2(area: number, city: string, buildingType: string) {
    const data = await this.quickEstimate(area, city, buildingType);
    return { success: true, data };
  }

  /** load/calculation：精算别名，尝试 calc-engine；不可达时 estimate 兜底。 */
  async loadCalculation(input: { area?: number; city?: string; buildingType?: string }) {
    const area = Number(input.area) || 0;
    const city = input.city || '上海';
    const buildingType = input.buildingType || 'residential';
    const verified = await this.fetchVerifiedLoad({ area, city, buildingType });
    const estimate = area > 0 ? this.engine.quickEstimate(area, city, buildingType) : null;
    return {
      success: true,
      data: {
        trust: verified?.trust_level === 'verified' ? 'verified' : 'estimate',
        verifiedLoad: verified,
        estimate,
        note: verified ? '已接入精算引擎（hvacpy/ASHRAE）' : '精算引擎不可达，已降级为工程估算',
      },
    };
  }

  /** 归一化系统入参：过滤为受支持的七系统 key。 */
  private normalizeSystems(systems?: string[]): SystemKey[] {
    const valid = new Set(Object.keys(SYSTEM_SOURCING) as SystemKey[]);
    return Array.isArray(systems) ? (systems.filter((s): s is SystemKey => valid.has(s as SystemKey))) : [];
  }

  /** 取选定系统的真实产品价带（product-catalog，牌价口径），失败降级空。 */
  private async fetchSystemBands(user: JwtPayload, systems: SystemKey[]): Promise<Map<string, any>> {
    const byCode = new Map<string, any>();
    if (!systems.length) return byCode;
    try {
      const r = await this.productCatalog.priceBandsForSystems(
        { tenantId: user.tenantId },
        systems.map((k) => ({ code: k, label: SYSTEM_SOURCING[k].label, keywords: SYSTEM_SOURCING[k].keywords })),
      );
      for (const b of r?.data?.bands ?? []) byCode.set(b.code, b);
    } catch { /* 降级：无价带 */ }
    return byCode;
  }

  /**
   * P1 · 设备推荐引擎（产品目录 × 负荷匹配）。
   * 依面积/城市算负荷定容，按选定系统从 product-catalog 拉真实上架设备与牌价；
   * 每系统给主设备价带 + 基于负荷的定容提示。牌价为公开安全字段（不含成本）。
   */
  async equipmentRecommendation(user: JwtPayload, input: { area?: number; systems?: string[]; city?: string }) {
    const area = Number(input.area) || 0;
    const city = input.city || '上海';
    const systems = this.normalizeSystems(input.systems);
    const load = area > 0 ? this.engine.quickEstimate(area, city, 'residential') : null;
    const bands = await this.fetchSystemBands(user, systems);

    const items = systems.map((key) => {
      const band = bands.get(key);
      const priced = !!band?.priced && Array.isArray(band.prices) && band.prices.length > 0;
      const prices: number[] = priced ? [...band.prices].sort((a, b) => a - b) : [];
      const sizingHint = load
        ? `建议按负荷定容：制冷≈${load.coolingLoad ?? load.cooling ?? '—'}、采暖≈${load.heatingLoad ?? load.heating ?? '—'}`
        : '面积缺失，未做负荷定容';
      return {
        system: key,
        label: SYSTEM_SOURCING[key].label,
        priced,
        candidateCount: prices.length,
        priceLow: priced ? prices[0] : null,
        priceHigh: priced ? prices[prices.length - 1] : null,
        currency: band?.currency ?? 'CNY',
        recommendedQty: 1,
        sizingHint,
        note: priced ? '价带来自产品目录上架牌价' : '产品目录未命中该系统上架产品',
      };
    });

    return {
      success: true,
      implemented: true,
      data: {
        input: { area, city, systems },
        load,
        loadTrust: load ? 'estimate' : 'insufficient_data',
        items,
      },
    };
  }

  /**
   * P1 · BOM 材料清单引擎。
   * 主设备取自 product-catalog 牌价中位数；辅材（管路/阀门/人工）按面积系数估算。
   * trust=estimate（工程估算口径，正式报价以合同为准）；未命中主设备价则该行 unitPrice=null 并诚实标注。
   */
  async generateMaterials(user: JwtPayload, input: Record<string, unknown>) {
    const area = Number(input.area) || 0;
    const systems = this.normalizeSystems(input.systems as string[] | undefined);
    if (!systems.length) {
      throw new BadRequestException('至少选择一个系统（systems: SystemKey[]）');
    }
    const bands = await this.fetchSystemBands(user, systems);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const median = (xs: number[]) => {
      if (!xs.length) return null;
      const s = [...xs].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : round2((s[m - 1] + s[m]) / 2);
    };

    const lines: Array<Record<string, unknown>> = [];
    let subtotal = 0;
    let currency = 'CNY';
    for (const key of systems) {
      const cfg = SYSTEM_SOURCING[key];
      const band = bands.get(key);
      if (band?.currency) currency = band.currency;
      // 主设备
      const unit = band?.priced ? median(band.prices as number[]) : null;
      const mainAmount = unit != null ? unit : 0;
      subtotal += mainAmount;
      lines.push({
        system: key, category: 'equipment', name: `${cfg.label}主设备`, unit: '台',
        quantity: 1, unitPrice: unit, amount: unit != null ? mainAmount : null,
        priced: unit != null, note: unit != null ? '牌价中位数(产品目录)' : '产品目录未命中，待选型定价',
      });
      // 辅材（面积系数估算）
      if (area > 0) {
        const pipeQty = round2(area * cfg.pipePerArea);
        const laborHours = round2(area * cfg.laborPerArea);
        const laborAmount = round2(laborHours * LABOR_RATE);
        subtotal += laborAmount;
        lines.push({ system: key, category: 'material', name: `${cfg.label}管路`, unit: 'm', quantity: pipeQty, unitPrice: null, amount: null, priced: false, note: '辅材量算(面积系数)，单价待材料库接入' });
        lines.push({ system: key, category: 'material', name: `${cfg.label}阀门/管件`, unit: '套', quantity: cfg.valveBase, unitPrice: null, amount: null, priced: false, note: '辅材量算(基数)，单价待材料库接入' });
        lines.push({ system: key, category: 'labor', name: `${cfg.label}安装人工`, unit: '工时', quantity: laborHours, unitPrice: LABOR_RATE, amount: laborAmount, priced: true, note: '人工估算(可配置)' });
      }
    }

    const pricedLines = lines.filter((l) => l.priced).length;
    return {
      success: true,
      implemented: true,
      data: {
        input: { area, systems },
        trust: 'estimate',
        currency,
        lines,
        summary: {
          lineCount: lines.length,
          pricedLineCount: pricedLines,
          subtotalPriced: round2(subtotal),
          note: '设备取产品目录牌价中位数 + 人工估算；管路/管件单价待材料库接入。正式报价以合同为准。',
        },
      },
    };
  }

  /**
   * P2 · AutoLayout 自动布点（确定性网格算法）。
   * 依面积估房间数，将选定系统主机/末端按网格均匀布点，产出带坐标的布局（mm）。
   * 真实、可复现，供 BIM/前端预览；精细排布仍需人工深化。
   */
  async generateLayout(input: { area?: number; systems?: string[]; roomCount?: number }) {
    const area = Number(input.area) || 0;
    const systems = this.normalizeSystems(input.systems);
    if (area <= 0 || !systems.length) {
      throw new BadRequestException('generateLayout 需要 area>0 与至少一个 system');
    }
    // 估房间数：约每 12㎡ 一个功能空间，至少 1，可被显式 roomCount 覆盖。
    const rooms = Math.max(1, Number(input.roomCount) || Math.round(area / 12));
    const side = Math.sqrt(area) * 1000; // 房型近似正方形边长(mm)
    const cols = Math.ceil(Math.sqrt(rooms));
    const rowsN = Math.ceil(rooms / cols);
    const cellX = side / cols;
    const cellY = side / rowsN;

    const nodes: Array<Record<string, unknown>> = [];
    // 主机集中布于左下角设备区；末端按房间网格中心布点。
    systems.forEach((sys, si) => {
      nodes.push({
        system: sys, role: 'source', label: `${SYSTEM_SOURCING[sys].label}主机`,
        position: { x: Math.round(400 + si * 900), y: 400, z: 0 },
      });
      for (let r = 0; r < rooms; r++) {
        const c = r % cols;
        const rr = Math.floor(r / cols);
        nodes.push({
          system: sys, role: 'terminal', label: `${SYSTEM_SOURCING[sys].label}末端-${r + 1}`,
          room: r + 1,
          position: { x: Math.round((c + 0.5) * cellX), y: Math.round((rr + 0.5) * cellY), z: 2700 },
        });
      }
    });

    return {
      success: true,
      implemented: true,
      data: {
        method: 'grid-auto-layout',
        input: { area, systems, rooms },
        bounds: { width: Math.round(side), depth: Math.round(side), height: 2800 },
        nodeCount: nodes.length,
        nodes,
        note: '确定性网格自动布点（工程预览口径），精细排布以深化图为准。',
      },
    };
  }

  /**
   * P2 · 碰撞检测（真实 AABB 相交/净距）。
   * 与 rysnova-bim/cloud clash 同口径：硬碰撞=包围盒相交，软碰撞=净距≤clearanceMm。
   */
  async collisionCheck(input: {
    elements?: Array<{ id: string; type?: string; boundingBox: { min: number[]; max: number[] } }>;
    clearanceMm?: number;
  }) {
    const els = Array.isArray(input.elements) ? input.elements : [];
    const clearance = Number(input.clearanceMm) > 0 ? Number(input.clearanceMm) : 50;
    const valid = els.filter(
      (e) => e?.boundingBox && Array.isArray(e.boundingBox.min) && Array.isArray(e.boundingBox.max)
        && e.boundingBox.min.length >= 3 && e.boundingBox.max.length >= 3,
    );
    const collisions: Array<Record<string, unknown>> = [];
    let hard = 0;
    let soft = 0;
    for (let i = 0; i < valid.length; i++) {
      for (let j = i + 1; j < valid.length; j++) {
        const a = valid[i].boundingBox;
        const b = valid[j].boundingBox;
        let sq = 0;
        let separated = false;
        for (let ax = 0; ax < 3; ax++) {
          const gap = Math.max(a.min[ax] - b.max[ax], b.min[ax] - a.max[ax], 0);
          if (gap > 0) { separated = true; sq += gap * gap; }
        }
        const distanceMm = separated ? Math.round(Math.sqrt(sq) * 100) / 100 : 0;
        if (distanceMm > clearance) continue;
        const type = distanceMm === 0 ? 'hard' : 'soft';
        if (type === 'hard') hard++; else soft++;
        collisions.push({ elementA: valid[i].id, elementB: valid[j].id, type, distanceMm });
      }
    }
    return {
      success: true,
      implemented: true,
      data: { hardCollisions: hard, softCollisions: soft, clearanceMm: clearance, collisions },
    };
  }

  /**
   * P2 · 管路水力平衡 / 选型。
   *  - 提供 network(nodes/pipes) → 走 HydraulicEngine.solveNetwork：树状流量分配 +
   *    Darcy-Weisbach 逐段阻力 + 最不利环路 + 水泵扬程（出具估算依据）。
   *  - 仅 segments/area → 流速法快速选型 d=√(4Q/(πv)) 向上取标准 DN（估算）。
   */
  async optimizePipes(input: {
    network?: {
      nodes?: Array<{ id: string; type: string; demand_Lh?: number; power_W?: number }>;
      pipes?: Array<{ id: string; from: string; to: string; length_m: number; fittings?: Record<string, number> }>;
    };
    systemType?: string;
    supplyT?: number;
    returnT?: number;
    segments?: Array<{ id?: string; flowM3h?: number; system?: string; velocityMps?: number }>;
    area?: number;
    systems?: string[];
  }) {
    // 水力平衡：需要完整管网拓扑（热源→主干→末端）+ 各段管长/附件。
    const net = input.network;
    if (net && Array.isArray(net.nodes) && net.nodes.length && Array.isArray(net.pipes) && net.pipes.length) {
      try {
        const solved = this.hydraulicEngine.solveNetwork(
          { nodes: net.nodes, pipes: net.pipes },
          { systemType: input.systemType ?? 'heating', supplyT: input.supplyT ?? 60, returnT: input.returnT ?? 50 },
        );
        return {
          success: true,
          implemented: true,
          data: {
            method: 'hydraulic-balance',
            trust: 'estimate',
            standard: 'GB 50736-2012 / GB 50015-2019（Darcy-Weisbach 沿程+局部阻力当量长度法）',
            totalFlow_Lh: solved.totalFlow_Lh,
            segments: solved.segments,      // 逐段：DN/实际流速/雷诺/λ/沿程+局部阻力
            worstLoop: solved.worstLoop,     // 最不利环路（供泵扬程依据）
            pump: solved.pump,               // 水泵扬程/流量（含往返×2 与安全系数）
            warnings: solved.warnings,       // 流速超限/管径偏大提示
            note: '水力平衡为工程估算依据，正式选型以水力计算书与产品样本为准。',
          },
        };
      } catch (err: unknown) {
        throw new BadRequestException(`水力平衡求解失败：${String((err as Error)?.message ?? err)}`);
      }
    }

    const DN = [15, 20, 25, 32, 40, 50, 65, 80, 100, 125, 150, 200]; // 标准公称管径
    const pickDN = (dMm: number) => DN.find((n) => n >= dMm) ?? DN[DN.length - 1];
    // 各系统推荐流速(m/s)：水系统 0.8~1.5，风系统更高（此处按水管口径）。
    const vDefault: Record<string, number> = { hotWater: 1.0, water: 1.0, heating: 1.2, airConditioning: 1.5, freshAir: 3.0, humidity: 2.5, control: 0.8 };

    let segments = Array.isArray(input.segments) ? input.segments : [];
    // 无显式段时，按面积×系统系数造一段/系统（估算流量：管长×0.02 m³/h·m 粗估）。
    if (!segments.length && Number(input.area) > 0) {
      const sys = this.normalizeSystems(input.systems);
      segments = sys.map((s) => ({ id: `${s}-main`, system: s, flowM3h: Math.round(Number(input.area) * SYSTEM_SOURCING[s].pipePerArea * 0.05 * 100) / 100 }));
    }
    if (!segments.length) {
      throw new BadRequestException('optimizePipes 需要 segments[] 或 area+systems');
    }

    const results = segments.map((seg) => {
      const q = Number(seg.flowM3h) || 0;
      const v = Number(seg.velocityMps) || vDefault[seg.system ?? ''] || 1.2;
      // Q[m³/h]→[m³/s]; d=√(4Q/(πv)) [m] → mm
      const qs = q / 3600;
      const dMm = q > 0 ? Math.sqrt((4 * qs) / (Math.PI * v)) * 1000 : 0;
      const dn = q > 0 ? pickDN(dMm) : null;
      const actualV = dn ? Math.round((qs / (Math.PI * Math.pow(dn / 2000, 2))) * 100) / 100 : null;
      return {
        id: seg.id ?? null, system: seg.system ?? null,
        flowM3h: q, designVelocityMps: v,
        theoreticalDiameterMm: Math.round(dMm * 100) / 100,
        selectedDN: dn, actualVelocityMps: actualV,
        note: q > 0 ? '流速法选型(向上取标准DN)' : '流量为0，未选型',
      };
    });

    return {
      success: true,
      implemented: true,
      data: { method: 'velocity-based-sizing', trust: 'estimate', segments: results, note: '水力选型为工程估算，正式选型以水力计算书为准。' },
    };
  }

  /**
   * P2 · 风管自动变径 + 阻力（LATS 对标）。
   * 提供风管网(nodes/pipes)→ HydraulicEngine.solveDuctNetwork：逐段按风量自动选径(圆风管)、
   * Darcy 比摩阻/沿程+局部阻力、最不利环路、风机余压。下游随风量减小逐级变径。
   */
  async optimizeDucts(input: {
    network?: {
      nodes?: Array<{ id: string; type: string; flow_m3h?: number }>;
      pipes?: Array<{ id: string; from: string; to: string; length_m: number; fittings?: Record<string, number> }>;
    };
  }) {
    const net = input.network;
    if (!net || !Array.isArray(net.nodes) || !net.nodes.length || !Array.isArray(net.pipes) || !net.pipes.length) {
      throw new BadRequestException('optimizeDucts 需要 network(nodes/pipes)');
    }
    try {
      const solved = this.hydraulicEngine.solveDuctNetwork({ nodes: net.nodes, pipes: net.pipes });
      return {
        success: true,
        implemented: true,
        data: {
          method: 'duct-auto-sizing',
          trust: 'estimate',
          standard: 'GB 50736-2012（圆风管风速/比摩阻，Darcy-Weisbach）',
          totalFlow_m3h: solved.totalFlow_m3h,
          segments: solved.segments,   // 逐段自动变径：D/风速/比摩阻/阻力
          worstLoop: solved.worstLoop,
          fan: solved.fan,             // 风机余压
          warnings: solved.warnings,
          note: '风管自动变径为工程估算依据，正式选型以风管水力计算书为准。',
        },
      };
    } catch (err: unknown) {
      throw new BadRequestException(`风管求解失败：${String((err as Error)?.message ?? err)}`);
    }
  }

  /**
   * P2 · 辐射采暖自动盘管（LoopCAD 对标）。
   * 依房间面积/尺寸 + 管间距，生成蛇形盘管：盘管长度、环路数(≤maxLoop 拆分)、
   * 及代表房间的蛇形路径点(mm，供出图)。
   */
  async generateRadiantCoil(input: {
    rooms?: Array<{ name?: string; area?: number; widthMm?: number; lengthMm?: number }>;
    spacingMm?: number;
    marginMm?: number;
    maxLoopM?: number;
  }) {
    const spacing = Number(input.spacingMm) > 0 ? Number(input.spacingMm) : 200; // 管间距 mm
    const margin = Number(input.marginMm) >= 0 ? Number(input.marginMm) : 200;   // 边距 mm
    const maxLoop = Number(input.maxLoopM) > 0 ? Number(input.maxLoopM) : 120;   // 单环路上限 m
    const rooms = Array.isArray(input.rooms) && input.rooms.length ? input.rooms : [{ name: '房间1', area: 20 }];

    const results = rooms.map((r, i) => {
      // 房间尺寸：给 w×l 则用之；否则由面积近似正方形
      const areaM2 = Number(r.area) > 0 ? Number(r.area) : (r.widthMm && r.lengthMm ? (r.widthMm * r.lengthMm) / 1e6 : 20);
      const W = Number(r.widthMm) || Math.round(Math.sqrt(areaM2) * 1000);
      const L = Number(r.lengthMm) || Math.round((areaM2 * 1e6) / W);
      const usableW = Math.max(0, W - 2 * margin);
      const usableL = Math.max(0, L - 2 * margin);
      // 蛇形沿 L 方向排布，行数 = usableL/spacing
      const passes = Math.max(1, Math.floor(usableL / spacing) + 1);
      const straight = (passes * usableW) / 1000;             // 直段总长 m
      const bends = ((passes - 1) * spacing) / 1000;          // 折返段
      const leader = 2 * (Math.max(W, L) / 1000);             // 到分集水器往返引管估算
      const coilLengthM = Math.round((straight + bends + leader) * 10) / 10;
      const loops = Math.max(1, Math.ceil(coilLengthM / maxLoop));

      // 代表房间蛇形路径点(mm)：仅首个房间输出，供出图预览
      let path: Array<[number, number]> | undefined;
      if (i === 0) {
        path = [];
        for (let p = 0; p < passes; p++) {
          const y = margin + p * spacing;
          const x0 = margin, x1 = margin + usableW;
          if (p % 2 === 0) { path.push([x0, y], [x1, y]); } else { path.push([x1, y], [x0, y]); }
        }
      }
      return {
        name: r.name || `房间${i + 1}`,
        areaM2: Math.round(areaM2 * 100) / 100,
        dimsMm: { width: W, length: L },
        spacingMm: spacing, passes,
        coilLengthM, loops,
        loopLengthM: Math.round((coilLengthM / loops) * 10) / 10,
        ...(path ? { serpentinePathMm: path } : {}),
      };
    });

    const totalCoilM = Math.round(results.reduce((s, r) => s + r.coilLengthM, 0) * 10) / 10;
    const totalLoops = results.reduce((s, r) => s + r.loops, 0);
    return {
      success: true,
      implemented: true,
      data: {
        method: 'radiant-serpentine',
        trust: 'estimate',
        spacingMm: spacing, maxLoopM: maxLoop,
        rooms: results,
        totalCoilLengthM: totalCoilM,
        totalLoops,
        note: '辐射盘管为蛇形估算（长度/环路/间距），正式排布以地暖深化图为准。',
      },
    };
  }

  /**
   * P2 · 管线/风管自动寻路（LATS 收尾）。
   * 栅格 A* 从机房/立管向各末端正交寻路、绕障、主干复用（支管汇入主干），
   * 返回逐末端拐点路径(mm) + 去重后实际用管量 + 主干复用节省。
   */
  async autoRoute(input: {
    bounds?: { width: number; height: number };
    source?: { x: number; y: number };
    terminals?: Array<{ id?: string; x: number; y: number }>;
    obstacles?: Array<{ x: number; y: number; w: number; h: number }>;
    gridStepMm?: number;
    turnPenalty?: number;
  }) {
    if (!input.bounds || !input.source || !Array.isArray(input.terminals) || !input.terminals.length) {
      throw new BadRequestException('autoRoute 需要 bounds、source、terminals');
    }
    try {
      const solved = autoRoutePipes({
        bounds: input.bounds, source: input.source, terminals: input.terminals,
        obstacles: input.obstacles || [], gridStepMm: input.gridStepMm, turnPenalty: input.turnPenalty,
      });
      return {
        success: true,
        implemented: true,
        data: {
          method: 'astar-grid-routing',
          trust: 'estimate',
          ...solved,
          note: '自动寻路为管线综合初排（正交绕障+主干复用），精确标高/交叉避让以 BIM 深化为准。',
        },
      };
    } catch (err: unknown) {
      throw new BadRequestException(`自动寻路失败：${String((err as Error)?.message ?? err)}`);
    }
  }

  /**
   * P2 · CFD 气流组织 / 热舒适仿真（LATS CFD 接入）。
   * 接 server/core CFDSimulationEngine：房间尺寸+送/回风口+热源+季节 → PMV/PPD、
   * 舒适分布、热点、吹风感、优化建议。为控延迟/响应体，网格粗化并剥离原始场数组，仅返回聚合。
   */
  async simulateCfd(input: {
    roomDimensions?: { length: number; width: number; height: number };
    inlets?: Array<Record<string, unknown>>;
    outlets?: Array<Record<string, unknown>>;
    heatSources?: Array<Record<string, unknown>>;
    boundaryConditions?: Record<string, unknown>;
    season?: string;
    resolutionM?: number;
  }) {
    const dims = input.roomDimensions;
    if (!dims || !(dims.length > 0 && dims.width > 0 && dims.height > 0)) {
      throw new BadRequestException('simulateCfd 需要 roomDimensions{length,width,height}');
    }
    // 网格粗化 + 单元数上限，避免 API 长阻塞
    const resolution = Number(input.resolutionM) > 0 ? Number(input.resolutionM) : 0.3;
    const estCells = Math.ceil(dims.length / resolution) * Math.ceil(dims.width / resolution) * Math.ceil(dims.height / resolution);
    if (estCells > 60000) {
      throw new BadRequestException(`网格过密(${estCells} 单元)，请增大 resolutionM 或缩小房间`);
    }
    try {
      const engine = new CFDSimulationEngine();
      engine.meshConfig.resolution = resolution;
      engine.meshConfig.maxIterations = Math.min(engine.meshConfig.maxIterations, 300);
      const season = input.season === 'winter' ? 'winter' : 'summer';
      const sim = engine.simulate({
        roomDimensions: dims,
        boundaryConditions: input.boundaryConditions || {},
        heatSources: input.heatSources || [],
        inlets: input.inlets || [{ position: { x: dims.length / 2, y: dims.width / 2, z: dims.height - 0.2 }, velocity: 2.5, radius: 0.3, temperature: season === 'summer' ? 16 : 35 }],
        outlets: input.outlets || [{ position: { x: dims.length / 2, y: dims.width / 2, z: 0.2 } }],
        season,
      });
      // 剥离原始场数组（velocityField/temperatureField/pressureField 可能上万），仅返回聚合
      return {
        success: true,
        implemented: true,
        data: {
          method: 'cfd-simulation',
          trust: 'estimate',
          simulationId: sim.simulationId,
          season,
          meshInfo: sim.meshInfo,
          comfort: {
            overall: sim.comfort.overall,          // PMV/PPD/isComfortable
            distribution: sim.comfort.distribution, // 冷/凉/舒适/暖/热 占比
            hotspotCount: (sim.comfort.hotspots || []).length,
            draftCount: (sim.comfort.drafts || []).length,
            hotspots: (sim.comfort.hotspots || []).slice(0, 5),
            drafts: (sim.comfort.drafts || []).slice(0, 5),
          },
          velocityDistribution: sim.results?.airflow?.velocityDistribution,
          temperatureDistribution: sim.results?.temperature?.temperatureDistribution,
          pressureDrop: sim.results?.pressure?.pressureDrop,
          quality: sim.quality,
          recommendations: sim.recommendations,
          note: 'CFD 为简化稳态仿真（PMV/PPD 与气流组织趋势判读），精确评估以专业 CFD 软件为准。',
        },
      };
    } catch (err: unknown) {
      throw new BadRequestException(`CFD 仿真失败：${String((err as Error)?.message ?? err)}`);
    }
  }

  /**
   * P2 · 自动系统图/原理图（确定性 SVG）。
   * 依选定系统 + 面积估末端数，生成「机房→立管→末端」原理图，返回 SVG + base64。
   * 示意/原理级；精确管线综合以 BIM 深化图为准。
   */
  async generateSystemDiagram(input: { projectName?: string; city?: string; area?: number; systems?: string[]; terminalsPerSystem?: Record<string, number> }) {
    const systems = this.normalizeSystems(input.systems);
    if (!systems.length) throw new BadRequestException('generateSystemDiagram 需要至少一个 system');
    const area = Number(input.area) || 0;
    const rooms = Math.max(1, area > 0 ? Math.round(area / 12) : 3);
    const diagram = buildSystemSchematicSvg({
      projectName: input.projectName,
      city: input.city,
      area: area || undefined,
      systems: systems.map((s) => {
        const cfg = SYSTEM_SOURCING[s];
        const terms = Number(input.terminalsPerSystem?.[s]) > 0 ? Number(input.terminalsPerSystem![s]) : rooms;
        return { key: s, label: cfg.label, sourceLabel: `${cfg.label}主机/机房`, terminals: terms, terminalLabel: `${cfg.label}末端` };
      }),
    });
    return {
      success: true,
      implemented: true,
      data: {
        method: 'schematic-svg',
        format: 'svg',
        width: diagram.width,
        height: diagram.height,
        svg: diagram.svg,
        contentBase64: Buffer.from(diagram.svg, 'utf8').toString('base64'),
        note: '系统原理图（示意级），精确管线综合以 BIM 深化图为准。',
      },
    };
  }

  /** CAD 上传（stub，文件接收层待接入）。 */
  async uploadCad(input: Record<string, unknown>) {
    return {
      success: true,
      implemented: false,
      data: { note: 'CAD 文件上传/解析引擎待接入，当前返回占位', fileId: null, input },
    };
  }

  /**
   * P2 · CAD 解析（DXF 开放格式，dxf-parser）。
   *  - 提供 dxf(文本) 或 dxfBase64 → 真实解析：按图层提取管线长度/设备块计数，归类水管/风管。
   *  - .dwg/.rvt 为闭源二进制，无开源解析器 → 诚实 `implemented:false`，建议导出 DXF/IFC。
   */
  async parseCad(input: { dxf?: string; dxfBase64?: string; format?: string; unitToMm?: number }) {
    let dxfText: string | null = null;
    if (typeof input.dxf === 'string' && input.dxf.trim()) dxfText = input.dxf;
    else if (typeof input.dxfBase64 === 'string' && input.dxfBase64.trim()) {
      try { dxfText = Buffer.from(input.dxfBase64, 'base64').toString('utf8'); } catch { throw new BadRequestException('dxfBase64 解码失败'); }
    }

    if (!dxfText) {
      const fmt = (input.format || '').toLowerCase();
      const note = ['dwg', 'rvt'].includes(fmt)
        ? `.${fmt} 为闭源二进制，无开源解析器；请从 CAD/Revit 导出 DXF 或 IFC 再导入。`
        : '未提供 dxf/dxfBase64；支持开放格式 DXF（几何）与 IFC（走 /rysnova-bim/cloud/ifc-clash）。';
      return { success: true, implemented: false, data: { note, parsed: null } };
    }

    try {
      const parsed = parseDxf(dxfText, Number(input.unitToMm) > 0 ? Number(input.unitToMm) : 1);
      return { success: true, implemented: true, data: { method: 'dxf-parser', ...parsed } };
    } catch (err: unknown) {
      throw new BadRequestException(String((err as Error)?.message ?? err));
    }
  }

  /** 3D 渲染提交（stub，渲染队列待接入；renderId 为本地占位 ID）。 */
  async render3d(input: Record<string, unknown>) {
    const renderId = `render-stub-${Date.now()}`;
    return {
      success: true,
      implemented: false,
      data: { note: '3D 渲染引擎待接入，当前返回占位 renderId', renderId, status: 'queued', input },
    };
  }

  /** 3D 渲染状态查询（stub）。 */
  async render3dStatus(renderId: string) {
    return {
      success: true,
      implemented: false,
      data: { renderId, status: 'not_implemented', note: '3D 渲染引擎待接入' },
    };
  }

  /**
   * P2 · 方案 PDF 导出（真实，pdf-lib）。
   * 生成含项目信息 / 负荷 / 系统 / BOM 汇总的方案摘要 PDF，返回 base64。
   * DWG 导出仍需 CAD 引擎（honest：format=dwg 时 implemented=false）。
   */
  async exportDesign(input: {
    format?: 'pdf' | 'dwg';
    projectName?: string;
    area?: number;
    city?: string;
    systems?: string[];
    load?: { coolingLoad?: number; heatingLoad?: number };
    bomSummary?: { subtotalPriced?: number; lineCount?: number };
  }) {
    const format = input.format ?? 'pdf';
    if (format === 'dwg') {
      return {
        success: true,
        implemented: false,
        data: { note: 'DWG 导出需 CAD 引擎（AutoCAD/ODA），当前不支持；PDF 导出可用', exportUrl: null },
      };
    }
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let y = 800;
    // StandardFonts 仅支持 WinAnsi(Latin-1)；非 Latin(如中文) 以 '?' 占位，避免编码抛错。
    // 完整 CJK 输出需嵌入中文 TTF（后续增强）。
    const winAnsi = (t: string) => String(t ?? '').replace(/[^\x00-\xFF]/g, '?');
    const line = (text: string, size = 11, f = font, color = rgb(0.1, 0.1, 0.1)) => {
      page.drawText(winAnsi(text), { x: 48, y, size, font: f, color });
      y -= size + 8;
    };
    line('RysNova HVAC Design Proposal', 18, bold, rgb(0.11, 0.31, 0.85));
    y -= 6;
    line(`Project: ${input.projectName ?? '-'}`, 12, bold);
    line(`City: ${input.city ?? '-'}    Area: ${input.area ?? '-'} m2`);
    line(`Generated: ${new Date().toISOString()}`);
    y -= 6;
    line('Load (Quick Estimate, +/-30%)', 13, bold);
    line(`Cooling: ${input.load?.coolingLoad ?? '-'} kW    Heating: ${input.load?.heatingLoad ?? '-'} kW`);
    y -= 6;
    line('Systems', 13, bold);
    const sys = this.normalizeSystems(input.systems);
    line(sys.length ? sys.join(' / ') : '-');
    y -= 6;
    line('BOM Summary', 13, bold);
    line(`Lines: ${input.bomSummary?.lineCount ?? '-'}    Priced subtotal: ${input.bomSummary?.subtotalPriced ?? '-'} CNY`);
    y -= 10;
    line('Note: engineering estimate; final quotation subject to contract.', 9, font, rgb(0.45, 0.45, 0.45));
    const bytes = await pdf.save();
    const base64 = Buffer.from(bytes).toString('base64');
    return {
      success: true,
      implemented: true,
      data: {
        format: 'pdf',
        fileName: `${(input.projectName ?? 'design').replace(/[^\w-]+/g, '_')}.pdf`,
        sizeBytes: bytes.length,
        contentBase64: base64,
        note: '方案摘要 PDF（pdf-lib 生成）。DWG 导出需 CAD 引擎。',
      },
    };
  }

  /** P2 · 设计模板库（内置真实模板集，供快速起草）。 */
  private static readonly TEMPLATES = [
    { id: 'residential-3systems', name: '家用三恒（制冷/新风/采暖）', segment: 'residential', systems: ['airConditioning', 'freshAir', 'heating'], defaultAreaRange: [80, 180] },
    { id: 'residential-5constants', name: '家用五恒（恒温/恒湿/恒氧/恒净/恒静）', segment: 'residential', systems: ['airConditioning', 'freshAir', 'heating', 'humidity', 'water'], defaultAreaRange: [120, 400] },
    { id: 'residential-hotwater-purify', name: '家用热水+净水', segment: 'residential', systems: ['hotWater', 'water'], defaultAreaRange: [60, 200] },
    { id: 'commercial-doas', name: '商用 DOAS + 多联机', segment: 'commercial', systems: ['airConditioning', 'freshAir', 'humidity', 'control'], defaultAreaRange: [300, 3000] },
    { id: 'commercial-central', name: '商用中央（冷热源+末端+控制）', segment: 'commercial', systems: ['airConditioning', 'heating', 'freshAir', 'control'], defaultAreaRange: [500, 10000] },
  ];

  async listTemplates() {
    return { success: true, data: { templates: DesignService.TEMPLATES, count: DesignService.TEMPLATES.length } };
  }

  /**
   * P2 · 从模板新建设计项目（真实落库，复用 createProject 语义）。
   * 依模板预填 systems/segment，创建 DesignProjectEntity。
   */
  async useTemplate(user: JwtPayload, templateId: string, body: { name?: string; area?: number; city?: string }) {
    const tpl = DesignService.TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) throw new NotFoundException(`模板不存在：${templateId}`);
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(DesignProjectEntity);
      const saved = await repo.save(repo.create({
        tenantId: user.tenantId,
        dealerId: user.dealerId ?? null,
        name: body.name ?? `${tpl.name}-${new Date().toISOString().slice(0, 10)}`,
        status: 'draft',
        meta: {
          fromTemplate: tpl.id,
          segment: tpl.segment,
          systems: tpl.systems,
          area: body.area ?? null,
          city: body.city ?? null,
        },
      }));
      return {
        success: true,
        implemented: true,
        data: { projectId: saved.id, template: tpl.id, systems: tpl.systems, segment: tpl.segment },
      };
    });
  }
}
