import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BimProjectEntity } from './bim.entity';
import { QuotationEntity } from '../quote/quote.entity';
import { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { TenantScope } from '../common/tenant-context';
import { ownershipScope } from '../common/scope';
import { ContractEntity, DeliveryRecordEntity } from '../delivery/delivery.entity';
import { LifecycleLinkEntity } from '../lifecycle/lifecycle.entity';
import { CustomerEntity } from '../crm/crm.entity';
import { DesignReleaseEntity } from '../design/design.entity';
import { DesignSyncEntity } from './design-sync.entity';
import { LifecycleState } from '../lifecycle/lifecycle-states';
import { buildAcceptanceChecklist, extractDevices } from './bom-acceptance';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

const STAGE_ORDER = ['inherited', 'drawing', 'bom_confirmed', 'construction', 'acceptance', 'iot_delivered'];

// P1-1：BOM 逐设备提取与验收清单生成已下沉至纯函数 `bom-acceptance.ts`（可单测）。

@Injectable()
export class BimService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  private scope(user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('缺少租户上下文');
    return user.tenantId;
  }

  private rls(user: JwtPayload): TenantScope {
    return { tenantId: this.scope(user), actorId: user.userId ?? undefined, role: user.role };
  }

  // dealer/store 归属过滤：RLS 仅兜 tenant，bim_projects 有 dealer_id/store_id，
  // 故所有「按 id」读写须叠加归属谓词，防同租户跨经销商/门店 IDOR。
  private owned(user: JwtPayload) {
    return ownershipScope(user, { hasStore: true });
  }

  // ── 1. 从报价单自动承接（签单触发） ───────────────────────────────────────
  // W-BIM-0 · 批 A/B：创建 BIM 项目的同时，写入 contract + lifecycle_link + delivery_records，
  // 使 v_bim_project_delivery 视图具备真实关联数据。
  async inheritFromQuotation(user: JwtPayload, quotationId: string) {
    const tenantId = this.scope(user);
    const result = await withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(BimProjectEntity);
      const quotations = em.getRepository(QuotationEntity);
      const contracts = em.getRepository(ContractEntity);
      const lifecycleLinks = em.getRepository(LifecycleLinkEntity);
      const deliveryRecords = em.getRepository(DeliveryRecordEntity);
      const q = await quotations.findOneByOrFail({ id: quotationId, tenantId, ...this.owned(user) });

      // 幂等：同一报价单不重复创建
      const existing = await projects.findOneBy({ tenantId, quotationId });
      if (existing) return { project: existing, created: false, q, contract: null, lifecycleLink: null, deliveryRecord: null };

      // P3: 先解析 lifecycle link（应已由 CRM 签单 advanceInTx 创建），用于给 contract/BIM project 注入 project_id
      let lifecycleLink = await lifecycleLinks.findOneBy({ tenantId, quotationId: q.id });
      if (!lifecycleLink) {
        lifecycleLink = await lifecycleLinks.findOneBy({ tenantId, customerId: q.customerId });
      }
      if (!lifecycleLink) {
        lifecycleLink = lifecycleLinks.create({ tenantId, customerId: q.customerId });
      }

      // 1) 确保合同已存在（可能已由 ContractController 创建）
      let contract = await contracts.findOneBy({ tenantId, quotationId: q.id });
      if (!contract) {
        const lock = (q.quotationLock as any) || {};
        const snapshot = (q.priceSnapshot as any) || {};
        const totalAmount = Number(
          snapshot?.costBreakdown?.grandTotal ??
          snapshot?.costBreakdown?.total ??
          (q.costBreakdown as any)?.grandTotal ??
          (q.costBreakdown as any)?.total ??
          0,
        );
        contract = await contracts.save(contracts.create({
          tenantId,
          dealerId: user.dealerId ?? null,
          customerId: q.customerId,
          quotationId: q.id,
          projectId: lifecycleLink.id ?? null,
          contractNo: this.nextContractNo(tenantId),
          totalAmount,
          status: 'draft',
          signedAt: null,
          terms: {
            fromQuotationNo: q.quotationNo,
            lockedVersion: lock?.lockedVersion ?? null,
            priceFrozen: !!lock?.locked,
          },
        }));
      }

      // 2) 创建 BIM 项目
      // P1-1：验收清单按实际 BOM(q.items) 逐设备生成，BOM 为空才回退按系统族的模板。
      const checklist: any = buildAcceptanceChecklist(q.items as any[], q.systemFamilies || []);
      // 回填客户名（BIM 看板/详情按客户名展示；缺失则回退报价编号）
      const customer = await em.getRepository(CustomerEntity).findOneBy({ tenantId, id: q.customerId });
      const proj = await projects.save(projects.create({
        tenantId, dealerId: user.dealerId, storeId: user.storeId,
        customerId: q.customerId,
        projectId: lifecycleLink.id ?? null,
        quotationId, quotationNo: q.quotationNo,
        status: 'inherited',
        customerName: customer?.name ?? null,
        city: (q.project as any)?.city ?? customer?.city ?? null,
        project: q.project,
        bom: q.items,
        costBreakdown: q.costBreakdown,
        systemFamilies: q.systemFamilies,
        acceptanceChecklist: checklist,
        assignedTo: user.userId,
      }));

      // 3) 更新 lifecycle_link（回填 contractId / bimProjectId）
      lifecycleLink.bimProjectId = proj.id;
      lifecycleLink.contractId = contract.id;
      lifecycleLink.quotationId = q.id;
      lifecycleLink.dealerId = user.dealerId ?? lifecycleLink.dealerId ?? null;
      lifecycleLink.storeId = user.storeId ?? lifecycleLink.storeId ?? null;
      const inheritedLifecycleStage = this.bimStageToLifecycleStage('inherited')!;
      lifecycleLink.stage = inheritedLifecycleStage;
      lifecycleLink.projectState = inheritedLifecycleStage;
      lifecycleLink = await lifecycleLinks.save(lifecycleLink);

      // 4) 创建 delivery_record（以 contract 为键，幂等）
      let deliveryRecord = await deliveryRecords.findOneBy({ tenantId, contractId: contract.id });
      if (!deliveryRecord) {
        deliveryRecord = await deliveryRecords.save(deliveryRecords.create({
          tenantId,
          contractId: contract.id,
          customerId: q.customerId,
          bimProjectId: proj.id,
          status: 'scheduled',
          checklist: { acceptanceChecklist: checklist },
        }));
      } else if (!deliveryRecord.bimProjectId) {
        deliveryRecord.bimProjectId = proj.id;
        deliveryRecord.checklist = { ...(deliveryRecord.checklist || {}), acceptanceChecklist: checklist };
        deliveryRecord = await deliveryRecords.save(deliveryRecord);
      }

      // 5) M12 · 登记 design → BIM 项目 派生关系（真相源同步账本）。
      // 报价来自设计项目时（project.designProjectId 存在），把本 BIM 项目登记为
      // 该 design 版本的派生产物（in_sync）。后续 design 放行(design.released)会把它置 stale，
      // 让设计变更能驱动深化产物重做。幂等：同 design+artifact 不重复登记。
      const designProjectId = (q.project as any)?.designProjectId as string | undefined;
      if (designProjectId) {
        const syncLinks = em.getRepository(DesignSyncEntity);
        const existing = await syncLinks.findOneBy({ tenantId, designId: designProjectId, artifactId: proj.id });
        if (!existing) {
          // 版本锚点：优先取该 design 最新「已放行」release 的 id（与 design.released 事件的
          // releaseId 对齐），使后续放行能精确置 stale；无 released 则回退最新任意 release，
          // 再无 release 记录才回退 'v1'。
          const releaseRepo = em.getRepository(DesignReleaseEntity);
          const releasedRelease = await releaseRepo.findOne({
            where: { tenantId, projectId: designProjectId, status: 'released' },
            order: { releasedAt: 'DESC', createdAt: 'DESC' },
          });
          const anyRelease = releasedRelease ?? await releaseRepo.findOne({
            where: { tenantId, projectId: designProjectId },
            order: { createdAt: 'DESC' },
          });
          const designVersion = anyRelease?.id ?? 'v1';
          await syncLinks.save(syncLinks.create({
            tenantId,
            designId: designProjectId,
            designVersion,
            artifactId: proj.id,
            artifactVersion: q.quotationNo ?? 'v1',
            syncState: 'in_sync',
            changeProposal: null,
          }));
        }
      }

      return { project: proj, created: true, q, contract, lifecycleLink, deliveryRecord };
    }, this.rls(user));

    // 通知后场：推送 webhook（若配置了 BIM_WEBHOOK_URL）。事务提交后再发，不阻断主流程
    const webhookUrl = process.env.BIM_WEBHOOK_URL;
    if (webhookUrl && result.created) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'bim.project.created',
          projectId: result.project.id,
          quotationNo: result.project.quotationNo,
          customerName: (result.q as any).customerName,
          systemFamilies: result.project.systemFamilies,
          createdBy: user.userId,
          createdAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => {/* 静默失败，不阻断主流程 */});
    }

    return { project: result.project, created: result.created };
  }

  // ── 2. 项目列表 / 详情 ────────────────────────────────────────────────────
  // W-BIM-0 · 批 A：从 v_bim_project_delivery 视图读取，保持旧端点返回格式。
  // 若视图未就绪或行无数据，则回退到实体表。
  list(user: JwtPayload, query: Record<string, string>) {
    return withRlsTransaction(this.ds, async (em) => {
      const tenantId = this.scope(user);
      const params: any[] = [tenantId];
      const storeFilter = user.storeId ? `AND p.store_id = $2` : user.dealerId ? `AND p.dealer_id = $2` : '';
      if (user.storeId) params.push(user.storeId);
      else if (user.dealerId) params.push(user.dealerId);
      const statusFilter = query.status ? `AND p.status = $${params.length + 1}` : '';
      if (query.status) params.push(query.status);
      const rows: any[] = await em.query(
        `SELECT * FROM rhautt_nexus.v_bim_project_delivery p
          WHERE p.tenant_id = $1 ${storeFilter} ${statusFilter}
          ORDER BY p.created_at DESC
          LIMIT 50`,
        params
      );
      if (rows.length === 0) {
        const qb = em.getRepository(BimProjectEntity).createQueryBuilder('p').where('p.tenantId = :t', { t: tenantId });
        if (query.status) qb.andWhere('p.status = :s', { s: query.status });
        if (user.storeId)       qb.andWhere('p.storeId = :s',  { s: user.storeId });
        else if (user.dealerId) qb.andWhere('p.dealerId = :d', { d: user.dealerId });
        return qb.orderBy('p.createdAt', 'DESC').limit(50).getMany();
      }
      return rows.map(r => this.mapViewRowToProject(r, em));
    }, this.rls(user));
  }

  async get(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const owned = this.owned(user);
      const params: any[] = [id, this.scope(user), owned.dealerId ?? null, owned.storeId ?? null];
      const rows: any[] = await em.query(
        `SELECT * FROM rhautt_nexus.v_bim_project_delivery p
          WHERE p.id = $1 AND p.tenant_id = $2
            AND (p.dealer_id = $3 OR $3 IS NULL)
            AND (p.store_id = $4 OR $4 IS NULL)
          LIMIT 1`,
        params
      );
      if (rows.length === 0) {
        return em.getRepository(BimProjectEntity).findOneByOrFail({ id, tenantId: this.scope(user), ...owned });
      }
      return this.mapViewRowToProject(rows[0], em);
    }, this.rls(user));
  }

  // ── 3. 阶段推进 ───────────────────────────────────────────────────────────
  // W-BIM-0 · 双写：BIM 阶段推进时同步更新 lifecycle_link.projectState/stage。
  async advanceStatus(user: JwtPayload, id: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(BimProjectEntity);
      const lifecycleLinks = em.getRepository(LifecycleLinkEntity);
      const p = await projects.findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) });
      const idx = STAGE_ORDER.indexOf(p.status);
      if (idx < 0 || idx >= STAGE_ORDER.length - 1) throw new BadRequestException('已是最终阶段');
      const nextStage = STAGE_ORDER[idx + 1];
      await projects.update(id, { status: nextStage });

      const lifecycleStage = this.bimStageToLifecycleStage(nextStage);
      const link = await lifecycleLinks.findOneBy({ tenantId: this.scope(user), bimProjectId: id });
      if (link && lifecycleStage) {
        link.stage = lifecycleStage;
        link.projectState = lifecycleStage;
        await lifecycleLinks.save(link);
      }

      return projects.findOneByOrFail({ id });
    }, this.rls(user));
  }

  private bimStageToLifecycleStage(bimStage: string): LifecycleState | null {
    const map: Record<string, LifecycleState> = {
      inherited: 'design-in-progress',
      drawing: 'design-in-progress',
      bom_confirmed: 'construction-planning',
      construction: 'construction-in-progress',
      acceptance: 'acceptance-pending',
      iot_delivered: 'accepted',
    };
    return map[bimStage] ?? null;
  }

  // ── 4. BOM 修改 ───────────────────────────────────────────────────────────
  async updateBom(user: JwtPayload, id: string, bom: Record<string, unknown>[]) {
    return withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(BimProjectEntity);
      await projects.findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) });
      await projects.update(id, { bom: bom as any });
      return projects.findOneByOrFail({ id });
    }, this.rls(user));
  }

  // ── 5. BOM 导出 Excel ─────────────────────────────────────────────────────
  async exportBomXlsx(user: JwtPayload, id: string): Promise<Buffer> {
    const p = await withRlsTransaction(this.ds, (em) =>
      em.getRepository(BimProjectEntity).findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) }),
    this.rls(user));
    const items: any[] = p.bom || [];

    const rows = items.map((item: any, i: number) => ({
      序号:       i + 1,
      系统:       item.systemFamily || item.category || '',
      名称:       item.name || '',
      型号:       item.model || '',
      品牌:       item.brand || '',
      单位:       item.unit || '项',
      数量:       item.quantity ?? 1,
      单价:       item.unitPrice ?? 0,
      小计:       item.total ?? (item.unitPrice ?? 0) * (item.quantity ?? 1),
      来源:       item.source || '',
    }));

    // 汇总行
    const totalRow = {
      序号: '', 系统: '', 名称: '合计', 型号: '', 品牌: '', 单位: '', 数量: '',
      单价: '', 小计: rows.reduce((s, r) => s + Number(r.小计), 0), 来源: '',
    };
    rows.push(totalRow as any);

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [3,8,20,16,10,6,6,10,12,12].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `BOM_${p.quotationNo || id.slice(0,8)}`);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  // ── 6. 出图链接 ───────────────────────────────────────────────────────────
  // W-BIM-0 · 双写：出图链接变化时同步写入 delivery_records.checklist.drawingUrl，
  // 使 delivery 域可独立生成交付清单与施工包。
  async updateDrawing(user: JwtPayload, id: string, drawingUrl: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(BimProjectEntity);
      const deliveryRecords = em.getRepository(DeliveryRecordEntity);
      await projects.findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) });
      await projects.update(id, { drawingUrl });

      const record = await deliveryRecords.findOneBy({ tenantId: this.scope(user), bimProjectId: id });
      if (record) {
        record.checklist = { ...(record.checklist || {}), drawingUrl };
        await deliveryRecords.save(record);
      }

      return projects.findOneByOrFail({ id });
    }, this.rls(user));
  }

  // ── 7. 验收打勾 ───────────────────────────────────────────────────────────
  // W-BIM-0 · 双写：BIM 验收清单变化时同步更新 delivery_records.checklist。
  async checkItem(user: JwtPayload, id: string, itemIndex: number, done: boolean) {
    return withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(BimProjectEntity);
      const deliveryRecords = em.getRepository(DeliveryRecordEntity);
      const lifecycleLinks = em.getRepository(LifecycleLinkEntity);
      const p = await projects.findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) });
      const checklist = [...(p.acceptanceChecklist || [])];
      if (itemIndex < 0 || itemIndex >= checklist.length) throw new NotFoundException('项目不存在');
      (checklist[itemIndex] as any).done = done;
      await projects.update(id, { acceptanceChecklist: checklist as any });

      const record = await deliveryRecords.findOneBy({ tenantId: this.scope(user), bimProjectId: id });
      if (record) {
        record.checklist = { ...(record.checklist || {}), acceptanceChecklist: checklist };
        await deliveryRecords.save(record);
      }

      // 全部完成 → 自动推进到 iot_delivered
      const allDone = checklist.every((c: any) => c.done);
      if (allDone && p.status === 'acceptance') {
        await projects.update(id, { status: 'iot_delivered', acceptedAt: new Date(), acceptedBy: user.userId });
        const link = await lifecycleLinks.findOneBy({ tenantId: this.scope(user), bimProjectId: id });
        if (link) {
          link.stage = 'accepted';
          link.projectState = 'accepted';
          link.acceptedAt = new Date();
          await lifecycleLinks.save(link);
        }
      }
      return projects.findOneByOrFail({ id });
    }, this.rls(user));
  }

  // ── 客户公开查询（无需登录）────────────────────────────────────────────
  // 跨租户公开查询（无登录上下文）：经 migration 007 的 SECURITY DEFINER 函数
  // rhautt_nexus.bim_public_lookup() 绕 FORCE RLS，绕过面收敛到函数体内的最小查询。
  async publicLookup(code: string) {
    // 跨租户公开查询（无登录上下文）：经 SECURITY DEFINER 函数绕 FORCE RLS，函数体仅暴露最小查询。
    const rows: Record<string, any>[] = await this.ds.query(
      'SELECT * FROM rhautt_nexus.bim_public_lookup($1)', [code],
    );
    const p = rows[0];
    if (!p) return null;
    const checklist: any[] = Array.isArray(p.acceptance_checklist) ? p.acceptance_checklist : [];
    return {
      quotationNo: p.quotation_no, status: p.status, city: p.city,
      systemFamilies: p.system_families ? String(p.system_families).split(',').filter(Boolean) : [],
      project: p.project,
      drawingUrl: p.drawing_url, acceptedAt: p.accepted_at,
      progress: checklist.length
        ? Math.round(checklist.filter((c: any) => c.done).length / checklist.length * 100)
        : 0,
    };
  }

  // ── 客户完整项目视图（从lifecycle迁移）──────────────────────────────
  async getCustomerProjectView(user: JwtPayload, id: string) {
    const p = await withRlsTransaction(this.ds, (em) =>
      em.getRepository(BimProjectEntity).findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) }),
    this.rls(user));
    const checklist = p.acceptanceChecklist as any[] || [];
    return {
      id: p.id, quotationNo: p.quotationNo, status: p.status,
      customerName: p.customerName, city: p.city,
      systemFamilies: p.systemFamilies, project: p.project,
      drawingUrl: p.drawingUrl,
      acceptedAt: p.acceptedAt, acceptedBy: p.acceptedBy,
      progress: checklist.length
        ? Math.round(checklist.filter(c => c.done).length / checklist.length * 100)
        : 0,
      checklistSummary: Object.entries(
        checklist.reduce((acc: any, c: any) => {
          acc[c.system] = { total: (acc[c.system]?.total || 0) + 1, done: (acc[c.system]?.done || 0) + (c.done ? 1 : 0) };
          return acc;
        }, {})
      ).map(([system, v]: any) => ({ system, done: v.done, total: v.total })),
      bom: p.bom,
      costBreakdown: p.costBreakdown,
    };
  }

  // ── 8. 工作台统计 ────────────────────────────────────────────────────────
  async stats(user: JwtPayload) {
    const t = this.scope(user);
    return withRlsTransaction(this.ds, async (em) => {
      const qb = em.getRepository(BimProjectEntity).createQueryBuilder('p').where('p.tenantId = :t', { t });
      if (user.storeId)       qb.andWhere('p.storeId = :s',  { s: user.storeId });
      else if (user.dealerId) qb.andWhere('p.dealerId = :d', { d: user.dealerId });
      const rows = await qb.select('p.status', 'status').addSelect('COUNT(*)', 'cnt').groupBy('p.status').getRawMany();
      const byStatus: Record<string, number> = {};
      let total = 0;
      for (const r of rows) { byStatus[r.status] = Number(r.cnt); total += Number(r.cnt); }
      const inProgress = total - (byStatus['iot_delivered'] || 0);
      return { total, inProgress, delivered: byStatus['iot_delivered'] || 0, byStatus };
    }, this.rls(user));
  }

  // ── 9. IoT 交付包 ────────────────────────────────────────────────────────
  async buildIotHandoffPackage(user: JwtPayload, id: string) {
    const p = await withRlsTransaction(this.ds, (em) =>
      em.getRepository(BimProjectEntity).findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) }),
    this.rls(user));
    const bom: any[] = p.bom as any[] || [];
    return {
      projectId: id, quotationNo: p.quotationNo, customerName: p.customerName,
      city: p.city, systemFamilies: p.systemFamilies,
      // P1-1：逐设备提取——每条真实 BOM 行都是一台设备，按 name/sku 归类系统，绝不因缺
      // systemFamily/category 而丢弃（修复 devices 恒为 0 的根因）。
      devices: extractDevices(bom),
      smartDevices: extractDevices(bom).filter((d) => d.system === '智控'),
      acceptanceChecklist: p.acceptanceChecklist,
      acceptedAt: p.acceptedAt, acceptedBy: p.acceptedBy,
      generatedAt: new Date().toISOString(),
    };
  }

  // ── 10. 回款记录 ─────────────────────────────────────────────────────────
  async updatePaid(user: JwtPayload, id: string, paidValue: number) {
    return withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(BimProjectEntity);
      await projects.findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) });
      await projects.update(id, { paidValue: paidValue as any });
      return projects.findOneByOrFail({ id });
    }, this.rls(user));
  }

  // ── 11. 指派负责人 ───────────────────────────────────────────────────────
  // W-BIM-0 · 双写：BIM 指派负责人时同步写入 lifecycle_links.assigned_to。
  async assign(user: JwtPayload, id: string, assignedTo: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const projects = em.getRepository(BimProjectEntity);
      const lifecycleLinks = em.getRepository(LifecycleLinkEntity);
      await projects.findOneByOrFail({ id, tenantId: this.scope(user), ...this.owned(user) });
      await projects.update(id, { assignedTo });

      const link = await lifecycleLinks.findOneBy({ tenantId: this.scope(user), bimProjectId: id });
      if (link) {
        link.assignedTo = assignedTo;
        await lifecycleLinks.save(link);
      }

      return projects.findOneByOrFail({ id });
    }, this.rls(user));
  }

  // ── 工具 ─────────────────────────────────────────────────────────────────
  // 临时合同编号生成，与 ContractService.nextContractNo 同规则；W-BIM-0 归位后本方法可删。
  private nextContractNo(tenantId: string) {
    return `C2-${String(tenantId).slice(-6).toUpperCase()}-${Date.now()}`;
  }

  // W-BIM-0 · 批 A：将 v_bim_project_delivery 视图的行映射为 BimProjectEntity 形状，
  // 保持旧端点返回格式不变。
  private mapViewRowToProject(row: any, em?: any): BimProjectEntity {
    const repo = em ? em.getRepository(BimProjectEntity) : this.ds.getRepository(BimProjectEntity);
    return repo.create({
      id: row.id,
      tenantId: row.tenant_id,
      dealerId: row.dealer_id,
      storeId: row.store_id,
      customerId: row.customer_id,
      quotationId: row.quotation_id,
      quotationNo: row.quotation_no,
      status: row.status,
      customerName: row.customer_name,
      city: row.city,
      project: row.project || {},
      bom: row.bom || [],
      costBreakdown: row.cost_breakdown || {},
      paidValue: row.paid_value,
      systemFamilies: typeof row.system_families === 'string' && row.system_families.length
        ? row.system_families.split(',').filter(Boolean)
        : (row.system_families || []),
      drawingUrl: row.drawing_url,
      bomXlsxUrl: row.bom_xlsx_url,
      acceptanceChecklist: row.acceptance_checklist || [],
      acceptedAt: row.accepted_at,
      acceptedBy: row.accepted_by,
      assignedTo: row.assigned_to,
      meta: row.meta || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
