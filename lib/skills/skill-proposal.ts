/**
 * §CA-9 / 路径 9 · Skill 自动生成提议层 (V1 骨架)
 *
 * 器官 #14 · 习惯沉淀
 *
 * 设计 (CENTRAL-AI-ARCHITECTURE §五缺器官 #14 + OKR-DRIVEN 18 器官):
 *   "Memory 4 层是知识, 但'这个决策该怎么做' 这种可执行习惯 (Skill) 不在体系内.
 *    AI 自动观察 Decision Log 高频模式 → SkillProposal → promotion-flow 签批 → 入'团队 Skill 库'."
 *
 * 跟现有 Skill 体系的关系:
 *   - 现有: lib/skills/registry.ts (Anthropic SKILL.md 兼容, 启动从 skills/<id>/SKILL.md 加载)
 *   - 现有: lib/taf/skills/registry.ts (TAF Skill, 内置 6 个工具)
 *   - 本文件: 不动现有, 加"AI 提议 → Owner 签批 → 入库"的元层
 *
 * 流程:
 *   1. pattern-detector.ts 扫 DecisionCard, 找重复模式 (≥3 张相似 DC)
 *   2. 本文件 generateSkillProposal() 调 LLM 把模式翻译成 Skill 草稿
 *   3. SkillProposal 落地 (KvStore collection='skill_proposal')
 *   4. Owner / Steward 在 admin 看板审批 → 写入 skills/<id>/SKILL.md (V2)
 *   5. boot 重新加载 skill registry, 新 Skill 上线
 *
 * V1 (本文件): 1-4 步, 第 5 步 (写文件 + reload) 留给 V2
 */

import type { CompanyBrainDecisionContext } from '@/lib/types/company-brain';
import { getStore } from '@/lib/storage/repository';
import { logger } from '@/lib/infra/logger';
import { audit } from '@/lib/audit/log';

/** SkillProposal 状态机 */
export type SkillProposalStatus =
  | 'draft'      // AI 刚生成, 等待审视
  | 'reviewing'  // Owner / Steward 在审
  | 'approved'   // 已批, 等待写入 skills/<id>/ (V2)
  | 'rejected'   // 已拒
  | 'published'; // (V2) 已写文件, registry 已重载

export interface SkillProposalPattern {
  /** 候选 skill id (snake_case, AI 起的) */
  proposedId: string;
  /** 一句话描述 (AI 起的) */
  description: string;
  /** 触发条件 (例: '客户投诉 + 产品类') */
  triggerConditions: string[];
  /** 类比的 DecisionCard ID 列表 (≥3 张相似的) */
  evidenceDecisionCardIds: string[];
  /** 类比的 context (im_reply / decision_card / ...) */
  affectedContext: CompanyBrainDecisionContext;
  /** 频率 (出现次数) */
  frequency: number;
}

export interface SkillProposalDraft {
  /** SKILL.md 的 YAML frontmatter (allowedRoles / permissions) */
  frontmatter: {
    name: string;
    description: string;
    allowedRoles?: string[];
    permissions?: string[];
  };
  /** SKILL.md body (markdown) */
  body: string;
  /** 内置工具调用清单 (例: 推荐 LLM 用 memory.search + okr.read) */
  recommendedSkillIds: string[];
}

export interface SkillProposal {
  id: string;
  createdAt: string;
  tenantId: string;
  /** AI 检测到的模式 */
  pattern: SkillProposalPattern;
  /** AI 草拟的 SKILL.md 内容 */
  draft: SkillProposalDraft;
  /** 状态机 */
  status: SkillProposalStatus;
  /** 创建方 (V1: 'system'; V2: 也可手动 'admin1') */
  proposedBy: string;
  /** 签批 */
  reviewedBy?: string;
  reviewedAt?: string;
  reviewReason?: string;
  /** approved 后写入 skills/<id>/ 的最终路径 (V2) */
  publishedPath?: string;
  /** approved 时间 */
  publishedAt?: string;
}

export interface GenerateProposalInput {
  pattern: SkillProposalPattern;
  tenantId?: string;
  proposedBy?: string;
  /** 是否调 LLM 写 SKILL.md body; false 时启发式生成 (用于离线/测试) */
  useLlm?: boolean;
}

/**
 * 启发式 SKILL.md body 模板 (LLM 失败时兜底)
 */
function heuristicDraftBody(pattern: SkillProposalPattern): string {
  return [
    `# ${pattern.proposedId}`,
    '',
    `## 适用场景`,
    pattern.description,
    '',
    `**触发条件**:`,
    ...pattern.triggerConditions.map((t) => `- ${t}`),
    '',
    `## 推荐流程`,
    '1. 调 \`memory.search\` 检索相关 SOP / 历史案例',
    '2. 调 \`okr.read\` 拿当前 OKR 锚定',
    '3. 综合形成 3+1 选项, 让员工选 (D 选项强制员工写"我多看到了什么")',
    '4. COMMIT 后写入 DecisionCard, 关联 KR',
    '',
    `## 数据基础`,
    `本 Skill 由 AI 从 ${pattern.frequency} 张相似决议归纳:`,
    ...pattern.evidenceDecisionCardIds.slice(0, 5).map((id) => `- \`${id}\``),
    pattern.evidenceDecisionCardIds.length > 5
      ? `- ... 还有 ${pattern.evidenceDecisionCardIds.length - 5} 张`
      : '',
    '',
    `## 注意`,
    `这是 V1 启发式草稿. Owner / Steward 审视后, 用 LLM 优化或手写 body 再 approve.`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * 用 LLM 把 pattern 翻译成 SKILL.md draft (best-effort).
 * 失败返回 null, 调用方降级到启发式.
 */
async function llmDraftBody(pattern: SkillProposalPattern): Promise<string | null> {
  try {
    const { getRouter } = await import('@/lib/boot');
    const router = getRouter();

    const system =
      '你是 Tandem 的 "Skill 编辑器". ' +
      '任务: 把员工反复出现的决策模式翻译成一份可执行的 Skill (SKILL.md body, markdown 中文). ' +
      'SKILL.md 应包含: ## 适用场景 / ## 触发条件 / ## 推荐流程 (含调用哪些内置 skill 如 memory.search / okr.read) / ## 注意事项. ' +
      '不要写 frontmatter, 不要 code fence. 直接输出 markdown body. 长度 200-500 字.';

    const user =
      `检测到的模式:\n` +
      `- 候选 ID: ${pattern.proposedId}\n` +
      `- 描述: ${pattern.description}\n` +
      `- 触发条件: ${pattern.triggerConditions.join('; ')}\n` +
      `- 出现次数: ${pattern.frequency}\n` +
      `- 类比上下文: ${pattern.affectedContext}\n\n` +
      `请输出 SKILL.md body.`;

    // eslint-disable-next-line no-restricted-syntax -- governed-chat-exempt: skill-proposal 是 S4 反思引擎产物，系统内部生成 SKILL.md，无用户 session
    const reply = await router.chat({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      scenario: 'reasoning_complex',
      maxTokens: 1000,
    });

    const content =
      typeof reply.message.content === 'string' ? reply.message.content : '';
    if (!content || content.length < 50) return null;
    // 去除可能的 code fence
    return content
      .replace(/^```(?:markdown|md)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[skill-proposal] LLM draft failed');
    return null;
  }
}

/**
 * 生成一份 SkillProposal (永不抛错).
 *
 * 步骤:
 *   1. 拼 frontmatter
 *   2. body: useLlm=true → 调 LLM; 失败 / useLlm=false → 启发式
 *   3. 落地到 KvStore (collection='skill_proposal')
 *   4. 写 audit
 */
export async function generateSkillProposal(
  input: GenerateProposalInput,
): Promise<SkillProposal | null> {
  try {
    const { pattern } = input;
    const tenantId = input.tenantId ?? 'default';
    const proposedBy = input.proposedBy ?? 'system';

    let body: string | null = null;
    if (input.useLlm) {
      body = await llmDraftBody(pattern);
    }
    if (!body) {
      body = heuristicDraftBody(pattern);
    }

    const proposal: SkillProposal = {
      id: `skp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      tenantId,
      pattern,
      draft: {
        frontmatter: {
          name: pattern.proposedId,
          description: pattern.description,
          allowedRoles: ['employee', 'manager'],
        },
        body,
        recommendedSkillIds: ['memory.search', 'okr.read', 'decision_card.list'],
      },
      status: 'draft',
      proposedBy,
    };

    // 落到 KvStore (collection='skill_proposals')
    try {
      const store = getStore();
      await store.skillProposals.create(proposal);
    } catch (err) {
      logger.warn(
        { err: (err as Error).message },
        '[skill-proposal] persist failed (V1 仅 best-effort)',
      );
    }

    try {
      await audit('skill.executed', proposedBy, {
        targetId: proposal.id,
        targetType: 'skill_proposal',
        tenantId,
        metadata: {
          event: 'skill_proposal_drafted',
          proposedId: pattern.proposedId,
          frequency: pattern.frequency,
          evidenceCount: pattern.evidenceDecisionCardIds.length,
          useLlm: input.useLlm ?? false,
        },
      });
    } catch {
      /* audit 失败不阻塞 */
    }

    logger.info(
      {
        proposalId: proposal.id,
        proposedId: pattern.proposedId,
        frequency: pattern.frequency,
        bodyLen: body.length,
      },
      '[skill-proposal] drafted',
    );

    return proposal;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[skill-proposal] generate failed');
    return null;
  }
}

/**
 * 签批 SkillProposal.
 * approve=true → status='approved' (V1 仅标记, V2 才真写 skills/<id>/ + reload registry)
 * approve=false → status='rejected'
 */
export async function reviewSkillProposal(
  proposalId: string,
  approve: boolean,
  reviewerId: string,
  reason?: string,
): Promise<SkillProposal | null> {
  try {
    const store = getStore();
    const existing = await store.skillProposals.get(proposalId);
    if (!existing) return null;
    let updated: SkillProposal = {
      ...existing,
      status: approve ? 'approved' : 'rejected',
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      reviewReason: reason,
    };
    await store.skillProposals.update(proposalId, updated);

    // approve → 写 SKILL.md + reload registry
    if (approve) {
      try {
        const { promises: fs } = await import('node:fs');
        const path = await import('node:path');
        const { loadSkills } = await import('./registry');
        const skillDir = path.join(process.cwd(), 'skills', existing.pattern.proposedId);
        await fs.mkdir(skillDir, { recursive: true });
        const fm = existing.draft.frontmatter;
        const allowedRoles = fm.allowedRoles?.length
          ? `\nallowedRoles: ${JSON.stringify(fm.allowedRoles)}`
          : '';
        const permissions = fm.permissions?.length
          ? `\npermissions: ${JSON.stringify(fm.permissions)}`
          : '';
        const skillMd = `---\nname: "${fm.name}"\ndescription: "${fm.description.replace(/"/g, "'")}"${allowedRoles}${permissions}\n---\n\n${existing.draft.body}`;
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        await fs.writeFile(skillMdPath, skillMd, 'utf8');
        await loadSkills();
        const publishedUpdate: SkillProposal = { ...updated, status: 'published', publishedPath: skillMdPath, publishedAt: new Date().toISOString() };
        await store.skillProposals.update(proposalId, publishedUpdate);
        updated = publishedUpdate;
        logger.info({ proposalId, skillDir }, '[skill-proposal] published SKILL.md + registry reloaded');
      } catch (writeErr) {
        logger.warn({ err: (writeErr as Error).message, proposalId }, '[skill-proposal] write SKILL.md failed');
      }
    }

    try {
      await audit('skill.executed', reviewerId, {
        targetId: proposalId,
        targetType: 'skill_proposal',
        tenantId: existing.tenantId,
        metadata: {
          event: approve ? 'skill_proposal_approved' : 'skill_proposal_rejected',
          reason,
        },
      });
    } catch {
      /* audit 失败不阻塞 */
    }
    return updated;
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, proposalId },
      '[skill-proposal] review failed',
    );
    return null;
  }
}
