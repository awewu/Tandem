/**
 * Audit Log · 审计日志
 *
 * 用途: 不可篡改记录所有关键事件 (议事室决议 / Persona 升级 / Memory 签批 / 数据导出 / etc)
 *
 * 等保二级 + GDPR / PIPL 合规所需.
 */

import { createHash } from 'crypto';
import { desc, eq, and } from 'drizzle-orm';

export type AuditAction =
  // 议事室
  | 'convergence.start'
  | 'convergence.option_picked'
  | 'convergence.commit'
  | 'convergence.escalate'
  | 'convergence.veto'
  // Persona
  | 'persona.create'
  | 'persona.upgrade'
  | 'persona.admin_set_stage'
  | 'persona.downgrade'
  | 'persona.proxy_action'
  | 'persona.proxy_drafted'
  | 'persona.proxy_executed'
  | 'persona.proxy_vetoed'
  | 'persona.proxy_expired'
  // Persona Constitution (B-027 · 价值观锚 / 防漂移层)
  | 'persona.constitution.rule_added'      // 添加一条不可妥协原则
  | 'persona.constitution.rule_archived'   // 归档某条规则 (软删)
  // Memory
  | 'memory.promotion_proposed'
  | 'memory.promotion_signed'
  | 'memory.promotion_approved'
  | 'memory.promotion_rejected'
  | 'memory.promotion_escalated'
  | 'memory.promotion_overdue_lv3'
  | 'memory.downgrade_proposed'
  | 'memory.downgrade_decided'
  | 'memory.entry_revised'
  | 'memory.entry_archived'
  // Data ownership
  | 'data.export_origin'
  | 'data.delete_personal'
  | 'data.anonymize_persona'
  // User account / consent (PIPL §13/§14, GDPR Art 7)
  | 'user.privacy_consent'
  | 'user.privacy_withdraw'
  // 决议事件
  | 'decision_card.create'
  | 'decision_card.update'
  | 'decision_card.veto'
  // OKR Anchor 度量 (V1.5 · OKR-DRIVEN §三第4条)
  | 'decision_card.anchored'              // anchored: 议事直接锚到 KR
  | 'decision_card.unanchored_created'    // unanchored_with_reason: 进 Steward 月审
  // CompanyBrain Decision 闭环 (CA-13)
  | 'company_brain.decision_recorded'     // 中央 AI 输出落地 CompanyBrainDecision
  | 'company_brain.feedback_submitted'    // 用户/治理委员会对中央 AI 输出反馈 (adopted/modified/overruled/ignored)
  // Governance · OKR 主航道偏离 (§B-015, 灵魂层第 2 条)
  | 'governance.okr_drift_detected'       // checkOkrDrift 判定 DRIFT_SUSPECTED, 写入治理审计
  // Skill Gateway · 4 道闸 (P4, MANIFESTO §19)
  | 'skill_gateway.checked'               // 4 道闸调用留痕 (PASS / SOFT_WARN / HARD_BLOCK)
  | 'skill_gateway.blocked'               // 任一闸 HARD_BLOCK 时单独高亮 (Steward 月审重点)
  // Ontology Action Type · 声明式受治理写动作 (ON-1, docs/ONTOLOGY-CENTRAL-BRAIN.md)
  | 'ontology.action_executed'            // executeAction 主写成功 + 副作用编排完成
  | 'ontology.action_blocked'             // 校验(submission criteria)或动作闸(zone)拦截
  // Output Guard · 输出矫正镜片 (中央 AI / 分身回答后置闸)
  | 'output_guard.checked'                // 每次审完留痕 (PASS / SOFT_DRIFT / HARD_CONFLICT)
  | 'output_guard.revised'                // HARD_CONFLICT 后 LLM 重写一次
  // Academy · 学院架构 (2026-05-29, docs/ACADEMY-METAPHOR-2026-05-29.md)
  | 'academy.course_created'              // HR 创建课程
  | 'academy.lesson_generated'            // AI 起草课程 (真 LLM, lib/learning/generate.ts)
  | 'academy.course_published'            // Steward 双签批通过, 课程上架
  | 'academy.course_archived'             // 课程归档
  | 'academy.course_assigned'             // HR/上级派课 (CourseAssignment)
  | 'academy.enrollment_created'          // 学员选课/被派
  | 'academy.lesson_attempted'            // 提交答题 (走 closure.ts 闭环)
  | 'academy.certification_earned'        // 颁证 (含解锁 delegation level)
  | 'academy.certification_expired'       // 季度复训过期
  | 'academy.delegation_unlocked'         // 通过必修, 解锁 L1/L2/L3
  | 'academy.delegation_locked'           // 必修过期, 锁权限
  | 'academy.mcp_token_issued'            // 个人 AI 接入 token 颁发
  | 'academy.mcp_token_revoked'           // token 撤销
  | 'academy.mcp_call'                    // MCP 工具调用 (走 Skill Gateway)
  | 'academy.proficiency_claimed'         // 校友自学申请 (学分置换, Steward 月审)
  | 'academy.proficiency_claim_decided'   // Steward 审完: approved / rejected
  // 自研身份系统 · 外部人员申请审批 (T4)
  | 'auth.application.submit'             // 外部人员公开提交申请
  | 'auth.application.approve'            // Owner/Admin 审批通过 (生成单次邀请码)
  | 'auth.application.reject'             // Owner/Admin 拒绝申请
  // 上下游组织 (企业微信式供应链模型 · 2026-06-09)
  | 'org.downstream.created'              // 上游建下游组织 (经销商/供应商/门店)
  | 'org.downstream.invited'             // 上游给下游组织发邀请码 (绑定 orgId + membershipType)
  | 'org.downstream.suspended'           // 上游停用下游组织
  // 三省六部项目治理 (Phase 2 · docs/GOVERNANCE-THREE-DEPARTMENTS-2026-05-30.md)
  | 'governance.project_created'          // 新战略项目 (复制模板)
  | 'governance.project_updated'          // 项目元信息变更 / 状态切换
  | 'governance.project_deleted'          // 项目删除 (非 default)
  | 'governance.template_saved'           // 三省六部结构保存
  // 通用审批单 (采购/请假等)
  | 'approval.created'                     // 提交审批单
  | 'approval.approved'                    // 审批人/admin 通过
  | 'approval.rejected'                    // 审批人/admin 驳回
  // 系统
  | 'system.provider_health_failed'
  | 'system.provider_switch'
  // Skill / Agent (CircleBot 对齐)
  | 'skill.executed'
  | 'skill.blocked_red_zone'
  | 'skill.blocked_data_scope'             // §19.3 数据边界拦截 (跨用户/越级访问)
  | 'skill.registry.reloaded'
  // Persona 拿捏闭环
  | 'persona.proxy_action_created'
  | 'persona.proxy_action_vetoed'
  | 'persona.proxy_action_confirmed'
  | 'persona_feedback_submitted'
  | 'skill.blocked_governance'
  | 'agent.spawned'
  | 'agent.completed'
  | 'budget.exceeded'
  | 'email.security_conflict_detected'
  // BossAI · Tandem AI 老板的搭子 (全局浮窗入口)
  | 'boss_ai.ask'                // 同事提问
  | 'boss_ai.answer'             // 中央 AI 回答完成
  | 'boss_ai.rate_limited'       // 触发限流 (突发或日上限)
  | 'im.rate_limited'            // IM 发消息触发限流 (spam guard)
  | 'persona_brief.options_generated' // 3+1 通用化 · 主分身 brief 4 选项产出
  | 'persona_brief.option_picked'     // 员工挑了 A/B/C/D 哪一个
  // 文档板块 (charter §四 DOC-3 · 2026-06-09)
  | 'document_review.generated'  // 中央 AI 评审文档 (CA-13 document_review 接入点)
  // KPI 体系 (CHARTER-KPI-TTI §2)
  | 'kpi.cycle_created'
  | 'kpi.cycle_activated'        // targetValue 锁死时刻
  | 'kpi.cycle_closed'           // 年终关闭
  | 'kpi.subject_changed'        // 科目主数据 CRUD
  | 'kpi.target_set'             // 通道 A: target/weight 设置
  | 'kpi.target_locked'          // 周期 active 后 target 不可改
  | 'kpi.actuals_imported_erp'   // 通道 B: ERP 自动采集
  | 'kpi.actuals_manual_entry'   // 通道 C: 财务/HR/内勤人工补录
  | 'kpi.scope_locked'           // bonus/monitor frozen
  | 'kpi.excel_imported'         // Excel 批量导入
  | 'kpi.excel_exported'         // Excel 导出
  | 'kpi.bonus_calculated'       // 奖金试算 (draft)
  | 'kpi.bonus_committed'        // 奖金下发 (final)
  | 'kpi.year_end_close'         // 绩效奖金年终关闭
  // 搭子手抄 · 员工本人闸门 (个人笔记 → 工作分身, opt-in, 可撤回)
  | 'shouchao.shared_to_persona'          // 本人开启: 某条笔记授权喂给工作分身
  | 'shouchao.unshared_from_persona'      // 本人撤回: 关闭授权 / 从分身语料移除
  // BSC 战略地图因果链 (B-019)
  | 'kpi.causal_link.create'     // 建因果链
  | 'kpi.causal_link.update'     // 改 strength/hypothesis
  | 'kpi.causal_link.validate'   // 年终复盘验证假设
  | 'kpi.causal_link.delete';    // 删因果链

export interface AuditEntry {
  id: string;
  action: AuditAction;
  /** 触发用户 (可能是 system) */
  actorId: string;
  /** 受影响实体 ID */
  targetId?: string;
  /** 类型 (如 'decision_card', 'persona', ...) */
  targetType?: string;
  /** 自由 metadata */
  metadata?: Record<string, unknown>;
  /** 不可篡改时间戳 */
  timestamp: string;
  /** 链式哈希 (前一条 hash + 本条 payload) */
  hash: string;
  prevHash?: string;
  /** 多租户 (可选; 默认 'default') */
  tenantId?: string;
}

/**
 * 持久化开关 · 仅在 DATABASE_URL 配置时启用 Drizzle 持久化.
 * 缺失时回退为纯内存模式 (适合 e2e / dev 无 DB 环境).
 */
const PERSIST_ENABLED = !!process.env.DATABASE_URL;

/**
 * B5: 内存 entries 环形缓冲上限. 防长 uptime 进程内 entries 数组无界增长.
 * DB 模式下 entries 仅作 prevHash 快取 + 离线 fallback, DB 才是真相源, 裁剪安全.
 * 纯内存模式 (dev/e2e) 下裁剪会丢更老的条目 (verify 仅覆盖近 N 条), 可接受.
 * 在 append 时读 env (AUDIT_MEMORY_MAX 覆盖, floor 100), 默认 10000.
 */
function maxMemoryEntries(): number {
  return Math.max(100, Number(process.env.AUDIT_MEMORY_MAX ?? 10_000));
}

/**
 * SHA-256 链式哈希. 任何条目被改动 → 该条 hash 与其后所有 prevHash 链不上.
 * 与等保二级 / GDPR / PIPL 的"不可篡改证据"要求对齐.
 */
function hashEntry(entry: Omit<AuditEntry, 'hash'>): string {
  // Use stable JSON serialization (key order is deterministic for plain objects
  // built from a fixed shape, which is our case in append()).
  const text = JSON.stringify(entry);
  return createHash('sha256').update(text).digest('hex');
}

class AuditLog {
  /** 内存近期缓存 (用于 prevHash 快速读取 + 离线 fallback) */
  private entries: AuditEntry[] = [];
  /** 按租户维护最新一条 hash + seq (跨重启从 DB 加载) */
  private tail = new Map<string, { hash: string; seq: number }>();
  private hydrated = new Set<string>();

  /** 第一次写某租户前, 从 DB 加载尾部 (prevHash + seq) */
  private async hydrateTenant(tenantId: string): Promise<void> {
    if (this.hydrated.has(tenantId)) return;
    this.hydrated.add(tenantId);
    if (!PERSIST_ENABLED) return;
    try {
      // 动态 import 避免 e2e/dev 无 DB 时启动炸
      const { db, schema } = await import('@/lib/infra/drizzle-client');
      const rows = await db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.tenantId, tenantId))
        .orderBy(desc(schema.auditLog.seq))
        .limit(1);
      if (rows[0]) {
        this.tail.set(tenantId, { hash: rows[0].hash, seq: rows[0].seq });
      }
    } catch {
      // DB 不可达 → silently fallback to memory only
    }
  }

  async append(
    action: AuditAction,
    actorId: string,
    options: {
      targetId?: string;
      targetType?: string;
      metadata?: Record<string, unknown>;
      tenantId?: string;
    } = {}
  ): Promise<AuditEntry> {
    const tenantId = options.tenantId ?? 'default';
    await this.hydrateTenant(tenantId);

    const prev = this.tail.get(tenantId);
    const nextSeq = (prev?.seq ?? 0) + 1;
    const skeleton = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      actorId,
      targetId: options.targetId,
      targetType: options.targetType,
      metadata: options.metadata,
      timestamp: new Date().toISOString(),
      prevHash: prev?.hash,
      tenantId,
    };
    const entry: AuditEntry = { ...skeleton, hash: hashEntry(skeleton) };

    this.entries.push(entry);
    // B5: 环形裁剪 — 只保留最近 N 条 (tail/prevHash 链不受影响, 链续靠 this.tail)
    const cap = maxMemoryEntries();
    if (this.entries.length > cap) {
      this.entries.splice(0, this.entries.length - cap);
    }
    this.tail.set(tenantId, { hash: entry.hash, seq: nextSeq });

    // 持久化 (best-effort, 不阻塞业务路径)
    if (PERSIST_ENABLED) {
      try {
        const { db, schema } = await import('@/lib/infra/drizzle-client');
        await db.insert(schema.auditLog).values({
          id: entry.id,
          action: entry.action,
          actorId: entry.actorId,
          targetId: entry.targetId ?? null,
          targetType: entry.targetType ?? null,
          metadata: (entry.metadata as object | undefined) ?? null,
          timestamp: new Date(entry.timestamp),
          hash: entry.hash,
          prevHash: entry.prevHash ?? null,
          tenantId,
          seq: nextSeq,
        });
      } catch (err) {
        // DB 失败 → 留在内存, 告警但不阻断业务. 真实部署应有 cron 巡检.
        // eslint-disable-next-line no-console
        console.error('[audit] persist failed:', (err as Error).message);
      }
    }

    return entry;
  }

  async list(filter?: {
    actorId?: string;
    action?: AuditAction;
    targetId?: string;
    tenantId?: string;
    limit?: number;
  }): Promise<AuditEntry[]> {
    if (PERSIST_ENABLED) {
      try {
        const { db, schema } = await import('@/lib/infra/drizzle-client');
        const conds = [] as ReturnType<typeof eq>[];
        if (filter?.actorId) conds.push(eq(schema.auditLog.actorId, filter.actorId));
        if (filter?.action) conds.push(eq(schema.auditLog.action, filter.action));
        if (filter?.targetId) conds.push(eq(schema.auditLog.targetId, filter.targetId));
        if (filter?.tenantId) conds.push(eq(schema.auditLog.tenantId, filter.tenantId));
        const where = conds.length === 0 ? undefined : conds.length === 1 ? conds[0] : and(...conds);
        const query = db
          .select()
          .from(schema.auditLog)
          .orderBy(desc(schema.auditLog.seq));
        const rows = where
          ? await query.where(where).limit(filter?.limit ?? 1000)
          : await query.limit(filter?.limit ?? 1000);
        return rows.map((r): AuditEntry => ({
          id: r.id,
          action: r.action as AuditAction,
          actorId: r.actorId,
          targetId: r.targetId ?? undefined,
          targetType: r.targetType ?? undefined,
          metadata: (r.metadata as Record<string, unknown> | null) ?? undefined,
          timestamp: r.timestamp.toISOString(),
          hash: r.hash,
          prevHash: r.prevHash ?? undefined,
          tenantId: r.tenantId,
        }));
      } catch {
        // fallthrough to memory
      }
    }
    let result = this.entries;
    if (filter?.actorId) result = result.filter((e) => e.actorId === filter.actorId);
    if (filter?.action) result = result.filter((e) => e.action === filter.action);
    if (filter?.targetId) result = result.filter((e) => e.targetId === filter.targetId);
    if (filter?.tenantId) result = result.filter((e) => (e.tenantId ?? 'default') === filter.tenantId);
    return result;
  }

  /**
   * 验证完整性 (任何篡改会让 hash 链断裂).
   * 默认验证某租户. 不传 tenantId 时仅验证 'default'.
   */
  async verify(tenantId = 'default'): Promise<{ ok: boolean; brokenAt?: number; total: number }> {
    let entries: AuditEntry[] = [];
    if (PERSIST_ENABLED) {
      try {
        const { db, schema } = await import('@/lib/infra/drizzle-client');
        const rows = await db
          .select()
          .from(schema.auditLog)
          .where(eq(schema.auditLog.tenantId, tenantId))
          .orderBy(schema.auditLog.seq);
        entries = rows.map((r): AuditEntry => ({
          id: r.id,
          action: r.action as AuditAction,
          actorId: r.actorId,
          targetId: r.targetId ?? undefined,
          targetType: r.targetType ?? undefined,
          metadata: (r.metadata as Record<string, unknown> | null) ?? undefined,
          timestamp: r.timestamp.toISOString(),
          hash: r.hash,
          prevHash: r.prevHash ?? undefined,
          tenantId: r.tenantId,
        }));
      } catch {
        entries = this.entries.filter((e) => (e.tenantId ?? 'default') === tenantId);
      }
    } else {
      entries = this.entries.filter((e) => (e.tenantId ?? 'default') === tenantId);
    }

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      // i===0 是窗口起点 (B5: 可能因 ring-buffer 裁剪 / DB 分页而非创世), 不强制 prevHash===undefined.
      // 对 i>0 仍校验与前一条的链接, 加逐条 hash 重算 → 任何篡改/重排仍会被发现.
      if (i > 0 && e.prevHash !== entries[i - 1].hash) {
        return { ok: false, brokenAt: i, total: entries.length };
      }
      const { hash: _omit, ...rest } = e;
      void _omit;
      const recomputed = hashEntry(rest);
      if (recomputed !== e.hash) {
        return { ok: false, brokenAt: i, total: entries.length };
      }
    }
    return { ok: true, total: entries.length };
  }
}

// 单例挂 globalThis 防 Next.js dev HMR 重置 (与 lib/storage/repository.ts 同一模式)
const _g = globalThis as typeof globalThis & { __tandem_audit_log__?: AuditLog };

export function getAuditLog(): AuditLog {
  if (!_g.__tandem_audit_log__) _g.__tandem_audit_log__ = new AuditLog();
  return _g.__tandem_audit_log__;
}

export async function audit(
  action: AuditAction,
  actorId: string,
  options?: {
    targetId?: string;
    targetType?: string;
    metadata?: Record<string, unknown>;
    tenantId?: string;
  }
): Promise<AuditEntry> {
  return getAuditLog().append(action, actorId, options ?? {});
}
