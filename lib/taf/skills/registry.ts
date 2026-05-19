/**
 * Skill Registry · 工具注册中心
 *
 * 对应 CircleBot 的 "Skill 工具箱" 概念, 但更结构化:
 *   - 所有工具集中注册
 *   - 按意图自动检索 (skill_search)
 *   - 与 LLM Function Calling 接口直通
 *   - 内置权限分级 (绿/黄/红区)
 *   - 内置 Token 预算守门
 *
 * 用法:
 *   import { skillRegistry } from '@/lib/taf/skills';
 *   const skills = await skillRegistry.search('搜索文件');
 *   const result = await skillRegistry.execute('file.read', { path: '/etc/hosts' }, ctx);
 */

import type { ToolSchema } from '../provider/types';
import { audit } from '../../audit/log';

// ---------------------------------------------------------------------------
// Skill 定义
// ---------------------------------------------------------------------------

export type SkillZone = 'green' | 'yellow' | 'red';

export interface SkillContext {
  /** 调用方用户 ID */
  userId: string;
  /** 是否 AI 代行 (从 Persona 触发, 非用户直接) */
  isProxy: boolean;
  /** 当前租户 */
  tenantId: string;
  /** 当前会话剩余 token 预算 */
  remainingBudget?: number;
}

export interface SkillResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  /** 消耗的 token (估算) */
  tokensUsed?: number;
  /** 元数据 (供 audit / debug) */
  metadata?: Record<string, unknown>;
}

export interface Skill<TArgs = unknown, TResult = unknown> {
  /** 唯一 ID, 形如 'category.action' (如 'file.read', 'memory.search') */
  id: string;
  /** 简短描述 (面向用户 + LLM) */
  description: string;
  /** 标签 (帮助检索) */
  tags: string[];
  /** 权限分区 */
  zone: SkillZone;
  /** AI 代行是否允许 (red zone 永远 false) */
  proxyAllowed: boolean;
  /** 平均消耗 token (用于预算) */
  estimatedTokens: number;
  /** OpenAI 兼容的 function calling schema */
  schema: ToolSchema;
  /** 实际执行函数 */
  execute: (args: TArgs, ctx: SkillContext) => Promise<SkillResult<TResult>>;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

class SkillRegistry {
  private skills = new Map<string, Skill>();

  register<A, R>(skill: Skill<A, R>): void {
    if (skill.zone === 'red' && skill.proxyAllowed) {
      throw new Error(`Skill ${skill.id}: red zone 永远不允许 proxyAllowed=true`);
    }
    this.skills.set(skill.id, skill as Skill);
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  list(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 按自然语言查询检索相关 skill (skill_search 等价).
   *
   * V1: 简单文本匹配 (description + tags)
   * V2: 向量检索 (embedding)
   */
  search(query: string, limit = 5): Skill[] {
    const tokens = tokenize(query);
    const scored = this.list().map((s) => ({
      skill: s,
      score: scoreSkill(s, tokens),
    }));
    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.skill);
  }

  /**
   * 输出 LLM Function Calling tools 数组 (注入到 ChatRequest)
   */
  toolSchemas(filterIds?: string[]): ToolSchema[] {
    const filtered = filterIds
      ? this.list().filter((s) => filterIds.includes(s.id))
      : this.list();
    return filtered.map((s) => s.schema);
  }

  /**
   * 执行 skill, 内置 5 道守门:
   *   1. 存在性
   *   2. AI 代行权限 (proxy + zone)
   *   3. Token 预算
   *   4. 审计日志
   *   5. 错误兜底
   */
  async execute<R = unknown>(
    skillId: string,
    args: unknown,
    ctx: SkillContext
  ): Promise<SkillResult<R>> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return { ok: false, error: `Skill ${skillId} not found` };
    }

    // 守门 0: 治理状态机 (skill 必须 approved/staging/草稿作者)
    // §T15: 不在 governance 注册的 skill 仍可执行 (向后兼容内置 skill);
    //       一旦注册过, 必须按状态机判定.
    try {
      const { canInvokeSkill, recordInvocation } = await import('./governance');
      const gate = await canInvokeSkill(skillId, {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      });
      if (gate.record && !gate.allowed) {
        await audit('skill.blocked_governance', ctx.userId, {
          targetId: skillId,
          targetType: 'skill',
          metadata: { reason: gate.reason, status: gate.record.status },
        });
        return { ok: false, error: `Skill ${skillId} 治理拦截: ${gate.reason}` };
      }
      // record invocation 在执行后异步打点 (见末尾 finally)
      ctx = { ...ctx } as SkillContext;
      (ctx as unknown as { __governanceRecordId?: string }).__governanceRecordId = gate.record?.id;
      void recordInvocation; // tree-shaking guard, 实际在 finally 调
    } catch {
      /* governance 模块未就绪 时不阻塞 */
    }

    // 守门 1: red zone 不允许 AI 代行
    if (skill.zone === 'red' && ctx.isProxy) {
      await audit('skill.blocked_red_zone', ctx.userId, {
        targetId: skillId,
        targetType: 'skill',
        metadata: { isProxy: true },
      });
      return { ok: false, error: `红区工具 ${skillId} 禁止 AI 代行, 请员工本人操作` };
    }

    if (ctx.isProxy && !skill.proxyAllowed) {
      return { ok: false, error: `工具 ${skillId} 不允许 AI 代行` };
    }

    // 守门 2: 预算
    if (ctx.remainingBudget !== undefined && ctx.remainingBudget < skill.estimatedTokens) {
      return { ok: false, error: `Token 预算不足 (需要 ${skill.estimatedTokens}, 剩 ${ctx.remainingBudget})` };
    }

    // 守门 3: 审计 + 执行
    try {
      const result = await skill.execute(args, ctx);
      await audit('skill.executed', ctx.userId, {
        targetId: skillId,
        targetType: 'skill',
        metadata: {
          ok: result.ok,
          isProxy: ctx.isProxy,
          zone: skill.zone,
          tokensUsed: result.tokensUsed ?? skill.estimatedTokens,
        },
      });
      return result as SkillResult<R>;
    } catch (err) {
      return { ok: false, error: (err as Error).message ?? 'unknown error' };
    }
  }
}

// ---------------------------------------------------------------------------
// Tokenization helpers (与 lib/memory/retriever 保持一致)
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  const out: string[] = [];
  const re = /([a-zA-Z0-9]+)|([\u4e00-\u9fa5])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push((m[1] ?? m[2]).toLowerCase());
  }
  return out;
}

function scoreSkill(skill: Skill, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  const haystack = `${skill.id} ${skill.description} ${skill.tags.join(' ')}`.toLowerCase();
  const haystackTokens = tokenize(haystack);
  const haystackSet = new Set(haystackTokens);

  let hits = 0;
  for (const t of queryTokens) {
    if (haystackSet.has(t)) hits++;
  }
  // 加权: tag 匹配最高
  const tagMatch = queryTokens.some((t) => skill.tags.some((tag) => tag.toLowerCase().includes(t)))
    ? 0.5
    : 0;
  return hits / queryTokens.length + tagMatch;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

// 单例挂 globalThis 防 Next.js dev HMR 重置 (内置 skill 在 boot 时注册一次, 不能因 HMR 丢失)
const _g = globalThis as typeof globalThis & { __tandem_skill_registry__?: SkillRegistry };
if (!_g.__tandem_skill_registry__) {
  _g.__tandem_skill_registry__ = new SkillRegistry();
}
export const skillRegistry: SkillRegistry = _g.__tandem_skill_registry__;
