/**
 * Built-in Skills · Tandem 默认工具集
 *
 * 这些工具在 boot 时自动注册.
 * 业务模块可继续扩展 (如 lib/integrations/* 注册自己的 skill).
 */

import type { Skill } from './registry';
import { skillRegistry } from './registry';
import { getStore } from '../../storage/repository';
import { CompositeRetriever } from '../../memory/retriever';

// ---------------------------------------------------------------------------
// memory.search · 知识检索 (绿区, 代行允许)
// ---------------------------------------------------------------------------

export const MemorySearchSkill: Skill<{ query: string; limit?: number }, unknown[]> = {
  id: 'memory.search',
  description: '检索 Memory 层 (SOP / case / value / redline) 和 Materials 中相关的知识',
  tags: ['memory', '知识', '检索', 'rag', 'sop', '案例'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 500,
  schema: {
    type: 'function',
    function: {
      name: 'memory_search',
      description: '搜索公司知识库 (SOP / 案例 / 红线 / 价值观)',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '搜索关键词或自然语言问题' },
          limit: { type: 'number', description: '返回结果数, 默认 5' },
        },
        required: ['query'],
      },
    },
  },
  async execute({ query, limit = 5 }) {
    const retriever = new CompositeRetriever();
    const results = await retriever.search(query, limit);
    return { ok: true, data: results, tokensUsed: 200 + results.length * 50 };
  },
};

// ---------------------------------------------------------------------------
// decision_card.list · 列出最近决议 (绿区)
// ---------------------------------------------------------------------------

export const DecisionCardListSkill: Skill<
  { limit?: number; ownerId?: string; state?: string },
  unknown[]
> = {
  id: 'decision_card.list',
  description: '列出最近的议事决议 (DecisionCard)',
  tags: ['decision', '决议', '议事', 'card'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'decision_card_list',
      description: '列出最近 N 个议事决议',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          ownerId: { type: 'string' },
          state: { type: 'string', enum: ['DIVERGE', 'CONVERGE', 'COMMIT', 'ESCALATED', 'VETOED'] },
        },
      },
    },
  },
  async execute({ limit = 10, ownerId, state }) {
    const store = getStore();
    let cards = await store.decisionCards.list();
    if (ownerId) cards = cards.filter((c) => c.createdBy === ownerId);
    if (state) cards = cards.filter((c) => c.convergenceState === state);
    cards = cards.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
    return { ok: true, data: cards, tokensUsed: 100 };
  },
};

// ---------------------------------------------------------------------------
// okr.read · 读取 OKR (绿区)
// ---------------------------------------------------------------------------

export const OkrReadSkill: Skill<{ ownerId?: string; cycleId?: string }, unknown> = {
  id: 'okr.read',
  description: '读取员工 OKR (Objectives + KRs)',
  tags: ['okr', '目标', 'kr'],
  zone: 'green',
  proxyAllowed: true,
  estimatedTokens: 200,
  schema: {
    type: 'function',
    function: {
      name: 'okr_read',
      description: '查询某员工或某周期的 OKR',
      parameters: {
        type: 'object',
        properties: {
          ownerId: { type: 'string' },
          cycleId: { type: 'string' },
        },
      },
    },
  },
  async execute({ ownerId, cycleId }) {
    const store = getStore();
    let objs = await store.objectives.list();
    if (ownerId) objs = objs.filter((o) => o.ownerId === ownerId);
    if (cycleId) objs = objs.filter((o) => o.cycleId === cycleId);
    const allKrs = await store.keyResults.list();
    const enriched = objs.map((o) => ({ ...o, keyResults: allKrs.filter((k) => k.objectiveId === o.id) }));
    return { ok: true, data: enriched };
  },
};

// ---------------------------------------------------------------------------
// persona.get · 读取自己的 Persona (绿区)
// ---------------------------------------------------------------------------

export const PersonaGetSkill: Skill<{ userId: string }, unknown> = {
  id: 'persona.get',
  description: '查询拿捏老板分身当前阶段和成长情况',
  tags: ['persona', '分身', '拿捏老板', '阶段'],
  zone: 'green',
  proxyAllowed: false, // 元能力, 代行禁止 (避免分身自我审视)
  estimatedTokens: 100,
  schema: {
    type: 'function',
    function: {
      name: 'persona_get',
      description: '获取某员工的拿捏老板分身画像',
      parameters: {
        type: 'object',
        properties: { userId: { type: 'string' } },
        required: ['userId'],
      },
    },
  },
  async execute({ userId }) {
    const store = getStore();
    const list = await store.personas.list({ userId } as never);
    return { ok: true, data: list[0] ?? null };
  },
};

// ---------------------------------------------------------------------------
// convergence.start · 发起议事室 (黄区, 代行需主管审批 - V2)
// ---------------------------------------------------------------------------

export const ConvergenceStartSkill: Skill<
  { title: string; description?: string; ownerId: string },
  unknown
> = {
  id: 'convergence.start',
  description: '发起新的议事室 (会自动生成 3+1 选项)',
  tags: ['convergence', '议事', '发起', '决议', 'meeting'],
  zone: 'yellow',
  proxyAllowed: false, // 重大议题禁止 AI 代发起 (反 AI 欺诈)
  estimatedTokens: 2000,
  schema: {
    type: 'function',
    function: {
      name: 'convergence_start',
      description: '发起一个新议事 (17 分钟内 3+1 决策)',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '议题标题' },
          description: { type: 'string', description: '议题背景' },
          ownerId: { type: 'string', description: '发起人 ID' },
        },
        required: ['title', 'ownerId'],
      },
    },
  },
  async execute(args) {
    // 通过 internal API (避免循环依赖)
    const res = await fetch('http://localhost:3000/api/convergence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) {
      return { ok: false, error: `convergence start failed: ${res.status}` };
    }
    return { ok: true, data: await res.json(), tokensUsed: 2000 };
  },
};

// ---------------------------------------------------------------------------
// 红区示例 (永不允许 AI 代行)
// ---------------------------------------------------------------------------

export const SalaryAccessSkill: Skill<{ userId: string }, unknown> = {
  id: 'hr.salary_read',
  description: '读取员工薪资信息 (红区, AI 永远禁止)',
  tags: ['hr', 'salary', '薪资'],
  zone: 'red',
  proxyAllowed: false,
  estimatedTokens: 100,
  schema: {
    type: 'function',
    function: {
      name: 'hr_salary_read',
      description: '红区: 仅员工本人 / HR 可读, AI 禁止',
      parameters: {
        type: 'object',
        properties: { userId: { type: 'string' } },
        required: ['userId'],
      },
    },
  },
  async execute() {
    return { ok: false, error: '红区数据只能员工本人 / HR 后台读取' };
  },
};

// ---------------------------------------------------------------------------
// 注册所有内置工具
// ---------------------------------------------------------------------------

export function registerBuiltinSkills(): void {
  skillRegistry.register(MemorySearchSkill);
  skillRegistry.register(DecisionCardListSkill);
  skillRegistry.register(OkrReadSkill);
  skillRegistry.register(PersonaGetSkill);
  skillRegistry.register(ConvergenceStartSkill);
  skillRegistry.register(SalaryAccessSkill);
}
