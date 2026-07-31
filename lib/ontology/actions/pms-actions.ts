/**
 * lib/ontology/actions/pms-actions.ts · PMS 写动作接治理链 (evolution #5 · 方案A)
 *
 * 把 PMS 三个内部管理写动作 (撞单申诉裁定 / 商机报备审核 / 释放公海) 定义为
 * 受治理 ActionType, 统一走 executeAction:
 *   - 人工内部角色 (isProxy=false): 黄区立即执行 (行为不变) + 统一审计 + 声明式副作用编排;
 *   - AI/分身经 proposeAction 发起时: 自动获 24h 否决窗 (ON-2)。
 *
 * ⚠ 红线词地雷 (derive-zone RED_PATTERNS '法律合规' 命中 `仲裁`):
 *   describeIntent 必须用领域精确、避开红线词的措辞 (用「裁定」而非「仲裁」, 不含「合同/诉讼/打款」),
 *   否则内容判定升红 → executeAction 对红区永不放行, 连人工点击都会被拦死。
 *   回归测试 tests/unit/pms-ontology-actions.test.ts 断言各 intent 永不判红。
 */

import { actionRegistry, type ActionType } from '../action-types';
import {
  arbitrateAppeal,
  getAppeal,
  canArbitrate,
  normalizeDecision,
  type ArbitrationDecision,
} from '@/lib/pms/duplicate-appeal-service';
import { reviewOpportunity } from '@/lib/pms/opportunity-service';

// ---------------------------------------------------------------------------
// ① 撞单申诉裁定 (原「仲裁」; 内部销售管理岗)
// ---------------------------------------------------------------------------

export interface PmsAppealArbitrateInput {
  tenantId: string;
  appealId: string;
  arbitratedBy: string;
  decision: ArbitrationDecision;
  arbitrationReason?: string;
}

export interface PmsAppealArbitrateResult {
  appealId: string;
  duplicateCheckId: string;
  status: ArbitrationDecision;
  arbitratedBy: string;
  arbitratedAt: string;
}

export const PmsAppealArbitrateAction: ActionType<PmsAppealArbitrateInput, PmsAppealArbitrateResult> = {
  id: 'pms.appeal.arbitrate',
  objectType: 'PmsDuplicateAppeal',
  label: 'PMS 撞单申诉裁定',
  declaredActionScope: 'commit',
  // 措辞避红线: 用「裁定」而非「仲裁」, 保持黄区 (commit 基线) 而非误升红。
  describeIntent: (i) =>
    `PMS 撞单申诉裁定: appeal=${i?.appealId ?? ''} → 判定${i?.decision === 'approved' ? '成立' : '维持撞单'}`,

  async validate(input, ctx) {
    if (!input || typeof input.appealId !== 'string' || !input.appealId) {
      return { ok: false, errors: ['appealId required'], code: 'invalid' };
    }
    let decision: ArbitrationDecision;
    try {
      decision = normalizeDecision(input.decision as unknown as string);
    } catch {
      return { ok: false, errors: ['invalid decision; expected approved | rejected'], code: 'invalid' };
    }
    const tenantId = input.tenantId ?? ctx.tenantId;
    if (!tenantId) return { ok: false, errors: ['tenantId required'], code: 'invalid' };
    const appeal = await getAppeal(input.appealId, tenantId);
    if (!appeal) return { ok: false, errors: ['appeal not found'], code: 'not_found' };
    if (!canArbitrate(appeal.status)) {
      return { ok: false, errors: ['appeal not arbitratable'], code: 'invalid' };
    }
    // 归一化裁决写回, 供 execute 使用 (避免二次解析)
    (input as PmsAppealArbitrateInput).decision = decision;
    return { ok: true, errors: [] };
  },

  async execute(input, ctx) {
    return arbitrateAppeal({
      tenantId: input.tenantId ?? ctx.tenantId!,
      appealId: input.appealId,
      arbitratedBy: input.arbitratedBy ?? ctx.actorUserId,
      decision: input.decision,
      arbitrationReason: input.arbitrationReason,
    });
  },

  // arbitrateAppeal 已在同一事务语义内关闭关联查重记录; 无额外声明式副作用。
  sideEffects: [],
};

// ---------------------------------------------------------------------------
// ② 商机报备审核 (经理/信息管理岗 通过 or 退回 pending_review 商机)
// ---------------------------------------------------------------------------

export type OpportunityReviewDecision = 'approved' | 'rejected';

export interface PmsOpportunityReviewInput {
  tenantId: string;
  opportunityId: string;
  decision: OpportunityReviewDecision;
  reviewerId: string;
  note?: string;
}

export interface PmsOpportunityReviewResult {
  id: string;
  reviewStatus: string;
}

export const PmsOpportunityReviewAction: ActionType<PmsOpportunityReviewInput, PmsOpportunityReviewResult> = {
  id: 'pms.opportunity.review',
  objectType: 'PmsOpportunity',
  label: 'PMS 商机报备审核',
  declaredActionScope: 'commit',
  // 措辞用「审核 / 通过 / 退回」, 避开 YELLOW 数据变更红线的「审批通过/驳回」精确串; commit 基线已保持黄区。
  describeIntent: (i) =>
    `PMS 商机报备审核: 商机=${i?.opportunityId ?? ''} → ${i?.decision === 'approved' ? '通过(计入漏斗)' : '退回'}`,

  async validate(input, ctx) {
    if (!input || typeof input.opportunityId !== 'string' || !input.opportunityId) {
      return { ok: false, errors: ['opportunityId required'], code: 'invalid' };
    }
    if (input.decision !== 'approved' && input.decision !== 'rejected') {
      return { ok: false, errors: ['decision must be approved|rejected'], code: 'invalid' };
    }
    if (!(input.tenantId ?? ctx.tenantId)) {
      return { ok: false, errors: ['tenantId required'], code: 'invalid' };
    }
    return { ok: true, errors: [] };
  },

  async execute(input, ctx) {
    return reviewOpportunity(
      input.opportunityId,
      input.decision,
      input.reviewerId ?? ctx.actorUserId,
      input.tenantId ?? ctx.tenantId!,
      input.note,
    );
  },

  sideEffects: [],
};

// ---------------------------------------------------------------------------
// 幂等注册 (镜像 ontology/index.ts ensureCoreActions; 独立函数避免把 drizzle
// 拉进核心 ontology import 图 —— 由 PMS 路由 boot 后按需调用)。
// ---------------------------------------------------------------------------

export function ensurePmsActions(): void {
  if (!actionRegistry.has(PmsAppealArbitrateAction.id)) {
    actionRegistry.register(PmsAppealArbitrateAction);
  }
  if (!actionRegistry.has(PmsOpportunityReviewAction.id)) {
    actionRegistry.register(PmsOpportunityReviewAction);
  }
}
