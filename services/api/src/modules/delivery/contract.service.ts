import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ContractEntity, DeliveryRecordEntity } from './delivery.entity';
import { QuotationEntity } from '../quote/quote.entity';
import { LifecycleLinkEntity } from '../lifecycle/lifecycle.entity';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import { EsignService, QYS_CONTRACT_STATUS } from './esign.service';
import { FileArtifactService } from '../file-artifact/file-artifact.service';

export type ContractStatus = 'draft' | 'sent' | 'signed' | 'active' | 'fulfilled' | 'cancelled';

// 合同状态机：每个状态允许迁移到的下一状态集合（终态映射为空）。
const TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft:     ['sent', 'signed', 'cancelled'],
  sent:      ['signed', 'cancelled'],
  signed:    ['active', 'cancelled'],
  active:    ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

/**
 * 合同持久化与生命周期（contracts 表，启用 RLS）。
 * 所有数据访问通过 withRlsTransaction 绑定租户会话，由 PostgreSQL Row Level Security
 * 在数据库层强隔离（tenant_id = current_tenant_id()）。
 */
@Injectable()
export class ContractService {
  private readonly logger = new Logger(ContractService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly esign: EsignService,
    private readonly fileArtifact: FileArtifactService,
  ) {}

  // 由（建议已锁价的）报价单创建合同草稿；同一报价单幂等。
  async createFromQuotation(user: JwtPayload, dto: { quotationId?: string; terms?: Record<string, unknown> }) {
    const tenantId = this.scope(user);
    if (!dto.quotationId) throw new BadRequestException('quotationId required');
    return withRlsTransaction(this.ds, async (em) => {
      // 报价单有 store 列；经销商/门店不得基于他人报价建合同
      const q = await em.getRepository(QuotationEntity)
        .findOneBy({ id: dto.quotationId as string, tenantId, ...ownershipScope(user, { hasStore: true }) });
      if (!q) throw new NotFoundException('报价单不存在');
      const contracts = em.getRepository(ContractEntity);

      // 幂等：同一报价单不重复创建
      const existing = await contracts.findOneBy({ tenantId, quotationId: q.id });
      if (existing) return { contract: existing, created: false };

      const lock = (q.quotationLock as any) || {};
      const snapshot = (q.priceSnapshot as any) || {};
      const totalAmount = Number(
        snapshot?.costBreakdown?.grandTotal ??
        snapshot?.costBreakdown?.total ??
        (q.costBreakdown as any)?.grandTotal ??
        (q.costBreakdown as any)?.total ??
        0,
      );
      // P3: 从 lifecycle_links 查 project_id（按 quotationId 定位）
      const link = await em.getRepository(LifecycleLinkEntity)
        .findOne({ where: { tenantId, quotationId: q.id } });
      const contract = await contracts.save(contracts.create({
        tenantId,
        dealerId: user.dealerId ?? null,
        customerId: q.customerId,
        quotationId: q.id,
        projectId: link?.id ?? null,
        contractNo: this.nextContractNo(tenantId),
        totalAmount,
        status: 'draft',
        signedAt: null,
        terms: {
          ...(dto.terms ?? {}),
          fromQuotationNo: q.quotationNo,
          lockedVersion: lock?.lockedVersion ?? null,
          priceFrozen: !!lock?.locked,
        },
      }));
      return { contract, created: true };
    }, this.rls(user));
  }

  // 不依赖报价单的直接创建（线下合同录入）。
  async create(user: JwtPayload, dto: { customerId?: string; quotationId?: string; totalAmount?: number; terms?: Record<string, unknown> }) {
    const tenantId = this.scope(user);
    if (!dto.customerId) throw new BadRequestException('customerId required');
    return withRlsTransaction(this.ds, async (em) => {
      const contracts = em.getRepository(ContractEntity);
      // P3: 从 lifecycle_links 查 project_id（按 customerId 定位）
      const link = await em.getRepository(LifecycleLinkEntity)
        .findOne({ where: { tenantId, customerId: dto.customerId as string } });
      return contracts.save(contracts.create({
        tenantId,
        dealerId: user.dealerId ?? null,
        customerId: dto.customerId as string,
        quotationId: dto.quotationId ?? null,
        projectId: link?.id ?? null,
        contractNo: this.nextContractNo(tenantId),
        totalAmount: Number(dto.totalAmount ?? 0),
        status: 'draft',
        signedAt: null,
        terms: dto.terms ?? {},
      }));
    }, this.rls(user));
  }

  list(user: JwtPayload, query: Record<string, string>) {
    return withRlsTransaction(this.ds, (em) => {
      const qb = em.getRepository(ContractEntity).createQueryBuilder('c').where('c.tenantId = :t', { t: this.scope(user) });
      if (query.status)     qb.andWhere('c.status = :s',     { s: query.status });
      if (query.customerId) qb.andWhere('c.customerId = :c', { c: query.customerId });
      return qb.orderBy('c.updatedAt', 'DESC').limit(50).getMany();
    }, this.rls(user));
  }

  get(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      // 合同表仅 dealer_id（无 store）：按 dealer 归属过滤，防同租户跨经销商读取
      const contract = await em.getRepository(ContractEntity)
        .findOneBy({ id, tenantId: this.scope(user), ...ownershipScope(user) });
      if (!contract) throw new NotFoundException('合同不存在');
      return contract;
    }, this.rls(user));
  }

  // ── 生命周期迁移 ──────────────────────────────────────────────────────────

  /**
   * 发起电子签章：
   * 1. 在契约锁创建草稿并上传 PDF（若合同 terms 携带 pdfBase64）
   * 2. 调用契约锁发起接口（对接方自动盖章 + 向客户发短信通知）
   * 3. 将 esignContractId / esignStatus 写回本地合同表
   * 4. 本地状态迁移 draft → sent
   */
  async send(user: JwtPayload, id: string): Promise<ContractEntity> {
    const tenantId = this.scope(user);
    const scoped = ownershipScope(user);

    const contract = await withRlsTransaction(this.ds, async (em) => {
      const c = await em.getRepository(ContractEntity).findOneBy({ id, tenantId, ...scoped });
      if (!c) throw new NotFoundException('合同不存在');
      return c;
    }, this.rls(user));

    if (contract.status !== 'draft') {
      throw new BadRequestException(`合同已处于 ${contract.status} 状态，无法重复发起`);
    }

    const terms = (contract.terms ?? {}) as Record<string, unknown>;
    const signerName   = String(terms.signerName   ?? terms.customerName ?? '客户');
    const signerMobile = String(terms.signerMobile  ?? terms.customerMobile ?? '');
    const subject      = String(terms.subject       ?? `合同 ${contract.contractNo}`);
    const pdfBase64    = terms.pdfBase64 as string | undefined;
    const categoryId   = process.env.QIYUESUO_CATEGORY_ID;

    if (!signerMobile) {
      throw new BadRequestException('合同 terms 中缺少 signerMobile（客户手机号）');
    }

    // ① 在契约锁创建草稿
    const qysContractId = await this.esign.createDraft({ subject, signerName, signerMobile, categoryId });
    this.logger.log(`契约锁草稿已创建 qysContractId=${qysContractId} contractId=${id}`);

    // ② 若携带 PDF 则上传文档
    if (pdfBase64) {
      await this.esign.uploadDocument({
        qysContractId,
        fileName: `${contract.contractNo}.pdf`,
        fileBase64: pdfBase64,
      });
    }

    // ③ 发起合同（对接方自动盖章）
    await this.esign.initiateContract({ qysContractId });

    // ④ 写回本地
    return withRlsTransaction(this.ds, async (em) => {
      const repo = em.getRepository(ContractEntity);
      await repo.update(
        { id, tenantId, ...scoped },
        { status: 'sent', esignContractId: qysContractId, esignStatus: QYS_CONTRACT_STATUS.SIGNING },
      );
      return repo.findOneByOrFail({ id, tenantId });
    }, this.rls(user));
  }

  /**
   * 获取客户 H5 签署链接
   * 需要合同已处于 sent 状态（即已在契约锁发起）
   */
  async getSignUrl(user: JwtPayload, id: string): Promise<{ signUrl: string; expiresAt: string }> {
    const tenantId = this.scope(user);
    const scoped = ownershipScope(user);

    const contract = await withRlsTransaction(this.ds, async (em) => {
      const c = await em.getRepository(ContractEntity).findOneBy({ id, tenantId, ...scoped });
      if (!c) throw new NotFoundException('合同不存在');
      return c;
    }, this.rls(user));

    if (!contract.esignContractId) {
      throw new BadRequestException('合同尚未发起电子签章，请先调用 POST /contract/:id/send');
    }

    const terms = (contract.terms ?? {}) as Record<string, unknown>;
    const signerMobile = String(terms.signerMobile ?? terms.customerMobile ?? '');
    if (!signerMobile) throw new BadRequestException('合同 terms 中缺少 signerMobile');

    const redirectUrl = process.env.QIYUESUO_SIGN_REDIRECT_URL;
    const result = await this.esign.getSignUrl({
      qysContractId: contract.esignContractId,
      signerMobile,
      ...(redirectUrl ? { redirectUrl } : {}),
    });

    // 把最新链接记录到合同表（方便 dealer 端快速复制发送）
    await withRlsTransaction(this.ds, async (em) => {
      await em.getRepository(ContractEntity).update(
        { id, tenantId, ...scoped },
        { esignSignUrl: result.signUrl },
      );
    }, this.rls(user));

    return result;
  }

  /**
   * 契约锁 Webhook 回调处理
   * 事件 type：CONTRACT_SIGN_FINISH（全部签署完成）
   * 签名验证通过后：更新 esignStatus、本地状态迁移 sent → signed、下载已签 PDF 存 key
   * 注意：此方法不需要 JwtPayload（来自契约锁服务器，用签名鉴权）
   */
  async handleWebhook(rawBody: string, signature: string): Promise<{ ok: boolean }> {
    if (!this.esign.verifyWebhookSignature(rawBody, signature)) {
      this.logger.warn('契约锁 webhook 签名验证失败');
      return { ok: false };
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      this.logger.warn('契约锁 webhook body 解析失败');
      return { ok: false };
    }

    const eventType     = String(payload.type ?? '');
    const qysContractId = String(payload.contractId ?? '');
    if (!qysContractId) return { ok: true };  // 忽略无 contractId 的事件

    this.logger.log(`契约锁 webhook event=${eventType} qysContractId=${qysContractId}`);

    // 合同全部签署完成
    if (eventType === 'CONTRACT_SIGN_FINISH') {
      // 按 esignContractId 找到本地合同（无 RLS，后台操作）
      const repo = this.ds.getRepository(ContractEntity);
      const contract = await repo.findOneBy({ esignContractId: qysContractId });
      if (!contract) {
        this.logger.warn(`webhook: 本地找不到 esignContractId=${qysContractId}`);
        return { ok: true };
      }

      // 下载已签 PDF（base64），存到 object-storage，并记录外部往返证据
      let signedPdfKey: string | null = null;
      let signedPdfArtifactId: string | null = null;
      try {
        const pdfBase64 = await this.esign.downloadSignedPdf(qysContractId);
        const systemUser: JwtPayload = {
          tenantId: contract.tenantId,
          dealerId: contract.dealerId,
          storeId: null,
          customerId: contract.customerId,
          userId: 'system:esign-webhook',
          role: 'system',
          permissions: [],
        };
        const saved = await this.fileArtifact.saveBase64(systemUser, {
          entityType: 'delivery.contract',
          entityId: contract.id,
          filename: `${contract.contractNo}_signed.pdf`,
          mimeType: 'application/pdf',
          dataBase64: pdfBase64,
        });
        if (saved.success && saved.data) {
          signedPdfKey = saved.data.fileKey;
          signedPdfArtifactId = saved.data.id;
          this.logger.log(`已签 PDF 已存储 artifactId=${saved.data.id} key=${signedPdfKey} (base64 length=${pdfBase64.length})`);
          // 2.4：显式记录客户签收的存证闭环
          await this.recordCustomerAcceptance(contract, signedPdfArtifactId, signedPdfKey);
        } else {
          this.logger.error(`保存已签 PDF 失败 contractId=${contract.id}`);
        }
      } catch (e) {
        this.logger.error(`下载或保存已签 PDF 失败 qysContractId=${qysContractId}`, e);
      }

      await repo.update(
        { id: contract.id },
        {
          status:      'signed',
          signedAt:    new Date(),
          esignStatus: QYS_CONTRACT_STATUS.COMPLETE,
          ...(signedPdfKey ? { signedPdfKey } : {}),
        },
      );
      this.logger.log(`合同已签署 contractId=${contract.id}`);
    }

    // 合同被拒签
    if (eventType === 'CONTRACT_SIGN_REFUSE') {
      const repo = this.ds.getRepository(ContractEntity);
      const contract = await repo.findOneBy({ esignContractId: qysContractId });
      if (contract) {
        await repo.update({ id: contract.id }, { esignStatus: QYS_CONTRACT_STATUS.REFUSED });
        this.logger.log(`合同被拒签 contractId=${contract.id}`);
      }
    }

    return { ok: true };
  }

  activate(user: JwtPayload, id: string) { return this.transition(user, id, 'active'); }
  fulfill(user: JwtPayload, id: string)  { return this.transition(user, id, 'fulfilled'); }
  cancel(user: JwtPayload, id: string)   { return this.transition(user, id, 'cancelled'); }

  // 签署：迁移到 signed 并记录签署时间（仅在无电子签章的线下签署场景使用）。
  sign(user: JwtPayload, id: string, signedAt?: string) {
    return this.transition(user, id, 'signed', { signedAt: signedAt ? new Date(signedAt) : new Date() });
  }

  /** 2.4：查询客户签收存证（DeliveryRecord.checklist.customerAcceptance） */
  async getCustomerAcceptance(user: JwtPayload, id: string) {
    const tenantId = this.scope(user);
    const scoped = ownershipScope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const contract = await em.getRepository(ContractEntity)
        .findOneBy({ id, tenantId, ...scoped });
      if (!contract) throw new NotFoundException('合同不存在');
      const record = await em.getRepository(DeliveryRecordEntity)
        .findOneBy({ tenantId, contractId: id });
      return {
        contractId: contract.id,
        contractNo: contract.contractNo,
        status: contract.status,
        signedAt: contract.signedAt,
        signedPdfKey: contract.signedPdfKey,
        esignStatus: contract.esignStatus,
        customerAcceptance: (record?.checklist as any)?.customerAcceptance ?? null,
      };
    }, this.rls(user));
  }

  // 通用状态迁移：校验状态机后更新；非法迁移抛 400。
  async transition(user: JwtPayload, id: string, target: ContractStatus, extra: { signedAt?: Date } = {}) {
    const tenantId = this.scope(user);
    const scoped = ownershipScope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const contracts = em.getRepository(ContractEntity);
      const contract = await contracts.findOneBy({ id, tenantId, ...scoped });
      if (!contract) throw new NotFoundException('合同不存在');
      const current = contract.status as ContractStatus;
      if (current === target) return contract; // 幂等
      const allowed = TRANSITIONS[current] ?? [];
      if (!allowed.includes(target)) {
        throw new BadRequestException(`非法的合同状态迁移：${current} → ${target}`);
      }
      await contracts.update({ id, tenantId, ...scoped }, { status: target, ...extra });
      return contracts.findOneByOrFail({ id, tenantId });
    }, this.rls(user));
  }

  /**
   * 2.4：客户签收存证闭环。
   * 合同完成电子签后，创建/更新 DeliveryRecord，把已签 PDF artifact 与签署事件写入 checklist，
   * 并显式记录对象存储证据（source/destination/pulled hash）。
   */
  private async recordCustomerAcceptance(
    contract: ContractEntity,
    signedPdfArtifactId: string,
    signedPdfKey: string,
  ): Promise<void> {
    const systemUser: JwtPayload = {
      tenantId: contract.tenantId,
      dealerId: contract.dealerId,
      storeId: null,
      customerId: contract.customerId,
      userId: 'system:esign-webhook',
      role: 'system',
      permissions: [],
    };

    await withRlsTransaction(this.ds, async (em) => {
      const records = em.getRepository(DeliveryRecordEntity);
      let record = await records.findOneBy({ tenantId: contract.tenantId, contractId: contract.id });
      if (!record) {
        record = records.create({
          tenantId: contract.tenantId,
          contractId: contract.id,
          customerId: contract.customerId,
          status: 'scheduled',
        });
      }
      record.status = 'scheduled';
      record.checklist = {
        ...(record.checklist || {}),
        customerAcceptance: {
          acceptedAt: new Date().toISOString(),
          signedPdfArtifactId,
          signedPdfKey,
          esignContractId: contract.esignContractId,
          contractNo: contract.contractNo,
          totalAmount: contract.totalAmount,
        },
      };
      await records.save(record);
    }, this.rls(systemUser));

    // 对象存储证据链已由 FileArtifactService.saveBase64 自动记录（upload 证据含 SHA-256）。
    // DeliveryRecord.checklist 作为客户签收存证闭环，指向已签 PDF artifact。
  }

  private nextContractNo(tenantId: string) {
    return `C2-${String(tenantId).slice(-6).toUpperCase()}-${Date.now()}`;
  }

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId, role: user.role };
  }
}
