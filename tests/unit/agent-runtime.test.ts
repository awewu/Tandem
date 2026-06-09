/**
 * §CA-5/CA-6/CA-7/CA-9 · Agent Runtime + Skill 自动生成 单测
 *
 * 三件器官 (#12/#13/#14) 的 V1 骨架验证.
 * 不调真实 LLM (mock TandemRouter), 仅验证 runtime 行为.
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { getStore, setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import type { DecisionCard } from '@/lib/types/decision-card';

beforeAll(() => {
  setStore(createInMemoryStore());
});

// ---------------------------------------------------------------------------
// #12 · multi-step ReAct (mock router)
// ---------------------------------------------------------------------------

describe('§CA-5 · runMultiStep · 主循环精细化', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('LLM 第 1 步直接给 finalAnswer → 1 步收敛, finishedNaturally=true', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          id: 'fake',
          message: {
            role: 'assistant',
            content: JSON.stringify({
              thought: '上下文已足够',
              finalAnswer: '答案是 42',
              finished: true,
            }),
          },
          finishReason: 'stop',
          usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
          model: 'mock',
        }),
      }),
    }));

    const { runMultiStep } = await import('@/lib/agent-runtime/multi-step');
    const r = await runMultiStep({
      systemPrompt: 'You are a tester.',
      userQuery: '你好',
      actorUserId: 'u1',
      maxSteps: 3,
    });
    expect(r.finishedNaturally).toBe(true);
    expect(r.finalAnswer).toBe('答案是 42');
    expect(r.stepsExecuted).toBe(1);
    expect(r.totalTokensUsed).toBe(130);
  });

  it('LLM 输出非 JSON → 解析失败时降级为原文返回, finishedNaturally=false', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          id: 'fake',
          message: { role: 'assistant', content: '这不是 JSON' },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock',
        }),
      }),
    }));

    const { runMultiStep } = await import('@/lib/agent-runtime/multi-step');
    const r = await runMultiStep({
      systemPrompt: 'sys',
      userQuery: 'q',
      actorUserId: 'u1',
      maxSteps: 2,
    });
    expect(r.finishedNaturally).toBe(false);
    expect(r.finalAnswer).toContain('这不是 JSON');
  });

  it('maxSteps 强制收敛: LLM 一直 thought 不给 finalAnswer', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          id: 'fake',
          message: {
            role: 'assistant',
            content: JSON.stringify({ thought: '想想看' }),
          },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
          model: 'mock',
        }),
      }),
    }));

    const { runMultiStep } = await import('@/lib/agent-runtime/multi-step');
    const r = await runMultiStep({
      systemPrompt: 'sys',
      userQuery: 'q',
      actorUserId: 'u1',
      maxSteps: 2,
    });
    expect(r.finishedNaturally).toBe(false);
    expect(r.stepsExecuted).toBe(2);
    expect(r.finalAnswer).toContain('maxSteps');
  });
});

// ---------------------------------------------------------------------------
// #13 · tool-loop · 执行肢体
// ---------------------------------------------------------------------------

describe('§CA-6/7 · runToolLoop · 执行肢体 (Tool Calling)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('LLM 不调工具, 直接给文本回复 → finishedNaturally=true', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          id: 'fake',
          message: { role: 'assistant', content: '不需要工具' },
          finishReason: 'stop',
          usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
          model: 'mock',
        }),
      }),
    }));

    const { runToolLoop } = await import('@/lib/agent-runtime/tool-loop');
    const r = await runToolLoop({
      systemPrompt: 'sys',
      userQuery: 'hi',
      toolset: [],
      actorUserId: 'u1',
    });
    expect(r.finishedNaturally).toBe(true);
    expect(r.finalMessage).toBe('不需要工具');
    expect(r.toolInvocations.length).toBe(0);
  });

  it('LLM 调白名单外的工具 → 拒绝执行 + tool result 喂回 LLM (V1 stub: LLM 第二轮直接给文本)', async () => {
    let callCount = 0;
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              id: 'fake1',
              message: {
                role: 'assistant',
                content: '',
                toolCalls: [
                  {
                    id: 'tc1',
                    type: 'function' as const,
                    function: { name: 'evil.tool', arguments: '{}' },
                  },
                ],
              },
              finishReason: 'tool_calls',
              usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
              model: 'mock',
            };
          }
          return {
            id: 'fake2',
            message: { role: 'assistant', content: '工具不可用, 我直接答' },
            finishReason: 'stop',
            usage: { promptTokens: 60, completionTokens: 8, totalTokens: 68 },
            model: 'mock',
          };
        },
      }),
    }));

    const { runToolLoop } = await import('@/lib/agent-runtime/tool-loop');
    const r = await runToolLoop({
      systemPrompt: 'sys',
      userQuery: 'q',
      toolset: ['memory.search'], // 不含 evil.tool
      actorUserId: 'u1',
      maxRounds: 3,
    });
    expect(r.toolInvocations.length).toBe(1);
    expect(r.toolInvocations[0].ok).toBe(false);
    expect(r.toolInvocations[0].error).toBe('tool_not_allowed');
    expect(r.finishedNaturally).toBe(true);
    expect(r.finalMessage).toContain('工具不可用');
  });

  it('maxRounds 强制收敛: LLM 一直想调工具', async () => {
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => ({
          id: 'fake',
          message: {
            role: 'assistant',
            content: '',
            toolCalls: [
              {
                id: `tc_${Date.now()}`,
                type: 'function' as const,
                function: { name: 'memory.search', arguments: '{"query":"x"}' },
              },
            ],
          },
          finishReason: 'tool_calls',
          usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
          model: 'mock',
        }),
      }),
    }));

    const { runToolLoop } = await import('@/lib/agent-runtime/tool-loop');
    const r = await runToolLoop({
      systemPrompt: 'sys',
      userQuery: 'q',
      toolset: [], // memory.search 不在白名单, 每轮被拒
      actorUserId: 'u1',
      maxRounds: 2,
    });
    expect(r.finishedNaturally).toBe(false);
    expect(r.roundsExecuted).toBe(2);
    expect(r.finalMessage).toContain('maxRounds');
  });

  // 回归: skill id 带点 (okr.health_digest) → 下发须 sanitize 成 okr_health_digest
  //   (OpenAI/DeepSeek 规范禁止点), 模型回传下划线名须能还原回真实 skill id 并执行。
  //   2026-06-08 真模型探针发现的"精致的假"bug: 不还原则每个 tool_call 被判
  //   tool_not_allowed, 中央AI 永远查不到真值。
  it('dotted skill id 下发 sanitize + 回传下划线名还原执行 (S1/S2 真接通)', async () => {
    let sentToolName: string | undefined;
    let executedSkillId: string | undefined;
    let callCount = 0;

    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async (req: { tools?: Array<{ function: { name: string } }> }) => {
          callCount++;
          // 捕获下发给模型的工具名 (应已 sanitize)
          if (req.tools?.[0]) sentToolName = req.tools[0].function.name;
          if (callCount === 1) {
            return {
              id: 'fake',
              message: {
                role: 'assistant',
                content: '',
                // 模型回传下划线形式 (DeepSeek 把点归一化)
                toolCalls: [
                  {
                    id: 'tc1',
                    type: 'function' as const,
                    function: { name: 'okr_health_digest', arguments: '{"level":"company"}' },
                  },
                ],
              },
              finishReason: 'tool_calls',
              usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
              model: 'mock',
            };
          }
          return {
            id: 'fake',
            message: { role: 'assistant', content: '查到了真值' },
            finishReason: 'stop',
            usage: { promptTokens: 60, completionTokens: 8, totalTokens: 68 },
            model: 'mock',
          };
        },
      }),
    }));

    vi.doMock('@/lib/taf/skills/registry', () => ({
      skillRegistry: {
        get: (id: string) =>
          id === 'okr.health_digest'
            ? {
                schema: {
                  type: 'function' as const,
                  function: {
                    name: 'okr.health_digest',
                    description: 'OKR 健康度',
                    parameters: { type: 'object', properties: {} },
                  },
                },
              }
            : undefined,
        execute: async (id: string) => {
          executedSkillId = id;
          return { ok: true, data: { atRisk: 1 } };
        },
      },
    }));

    const { runToolLoop } = await import('@/lib/agent-runtime/tool-loop');
    const r = await runToolLoop({
      systemPrompt: 'sys',
      userQuery: '公司 OKR 进度?',
      toolset: ['okr.health_digest'],
      actorUserId: '__company__',
      maxRounds: 3,
    });

    // 下发的工具名已 sanitize (无点)
    expect(sentToolName).toBe('okr_health_digest');
    // 模型回传的下划线名被还原回真实 skill id 并真执行
    expect(executedSkillId).toBe('okr.health_digest');
    expect(r.toolInvocations).toHaveLength(1);
    expect(r.toolInvocations[0].name).toBe('okr.health_digest');
    expect(r.toolInvocations[0].ok).toBe(true);
    expect(r.finishedNaturally).toBe(true);
  });

  // 2026-06-08 深挖#3: reasoning-pass 实测同一 loop 内 memory.search 被重复调 4+ 次 (浪费 DB/token)。
  //   tool-loop 加同参数去重缓存: 重复 (skill+args) 不再执行, 复用缓存结果 + 标 cached=true。
  it('同参数重复 tool_call → 只执行一次, 复用缓存 (cached=true)', async () => {
    let executeCount = 0;
    let callCount = 0;
    vi.doMock('@/lib/boot', () => ({
      getRouter: () => ({
        chat: async () => {
          callCount++;
          // 第 1、2 轮都用相同参数调 memory.search; 第 3 轮收敛
          if (callCount <= 2) {
            return {
              id: 'fake',
              message: {
                role: 'assistant',
                content: '',
                toolCalls: [
                  {
                    id: `tc_${callCount}`,
                    type: 'function' as const,
                    function: { name: 'memory_search', arguments: '{"query":"风险","limit":5}' },
                  },
                ],
              },
              usage: { totalTokens: 10 },
              finishReason: 'tool_calls' as const,
            };
          }
          return {
            id: 'fake',
            message: { role: 'assistant', content: '收敛' },
            usage: { totalTokens: 5 },
            finishReason: 'stop' as const,
          };
        },
      }),
    }));

    vi.doMock('@/lib/taf/skills/registry', () => ({
      skillRegistry: {
        get: (id: string) =>
          id === 'memory.search'
            ? {
                id,
                description: 'search',
                zone: 'green',
                schema: {
                  type: 'function' as const,
                  function: { name: 'memory.search', description: 'd', parameters: { type: 'object', properties: {} } },
                },
              }
            : undefined,
        execute: async () => {
          executeCount++;
          return { ok: true, data: [{ id: 'm1' }] };
        },
      },
    }));

    const { runToolLoop } = await import('@/lib/agent-runtime/tool-loop');
    const r = await runToolLoop({
      systemPrompt: 'sys',
      userQuery: 'q',
      toolset: ['memory.search'],
      actorUserId: 'u1',
      maxRounds: 4,
    });

    // 两轮都调了工具 → 2 条 invocation, 但实际 execute 只跑 1 次 (第二次命中缓存)
    expect(r.toolInvocations).toHaveLength(2);
    expect(executeCount).toBe(1);
    expect(r.toolInvocations[0].cached).toBeFalsy();
    expect(r.toolInvocations[1].cached).toBe(true);
    expect(r.toolInvocations[1].result).toContain('缓存结果');
    expect(r.finishedNaturally).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// #13 · MCP bridge stub
// ---------------------------------------------------------------------------

describe('§CA-6 · MCP Bridge V1 Stub', () => {
  it('注册 MCP server + invokeMcp 返回 not-implemented', async () => {
    const { registerMcpServer, invokeMcp, listMcpServers, unregisterMcpServer } =
      await import('@/lib/agent-runtime/mcp-bridge');

    registerMcpServer({
      name: 'linear-test',
      description: 'Linear MCP',
      transport: 'sse',
      endpoint: 'http://localhost:9999',
      tools: [
        {
          type: 'function',
          function: {
            name: 'list_issues',
            description: 'List issues',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      enabled: true,
    });

    expect(listMcpServers().length).toBeGreaterThanOrEqual(1);

    const r = await invokeMcp('linear-test.list_issues', {}, { actorUserId: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('V1 stub');
    expect(r.serverName).toBe('linear-test');

    unregisterMcpServer('linear-test');
  });

  it('invokeMcp 不存在的 server → 报错', async () => {
    const { invokeMcp } = await import('@/lib/agent-runtime/mcp-bridge');
    const r = await invokeMcp('nope.tool', {}, { actorUserId: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('not registered');
  });

  it('invalid tool id (无 dot) → 报错', async () => {
    const { invokeMcp } = await import('@/lib/agent-runtime/mcp-bridge');
    const r = await invokeMcp('badid', {}, { actorUserId: 'u1' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('invalid');
  });

  it('getAllMcpTools 返回带 server prefix 的 schemas', async () => {
    const { registerMcpServer, getAllMcpTools, unregisterMcpServer } = await import(
      '@/lib/agent-runtime/mcp-bridge'
    );
    registerMcpServer({
      name: 'gh',
      description: 'GitHub',
      transport: 'http',
      endpoint: 'http://x',
      tools: [
        {
          type: 'function',
          function: { name: 'list_repos', description: '...', parameters: { type: 'object', properties: {} } },
        },
      ],
      enabled: true,
    });
    const tools = getAllMcpTools();
    const found = tools.find((t) => t.function.name.startsWith('gh__'));
    expect(found).toBeDefined();
    unregisterMcpServer('gh');
  });
});

// ---------------------------------------------------------------------------
// #14 · pattern-detector + skill-proposal · 习惯沉淀
// ---------------------------------------------------------------------------

async function seedDecisionCards(cards: Array<Partial<DecisionCard> & { id: string; title: string }>) {
  const store = getStore();
  for (const c of cards) {
    const full: DecisionCard = {
      id: c.id,
      schemaVersion: 'tandem.v1',
      title: c.title,
      decisionClass: 'simple',
      convergenceState: 'COMMIT',
      elapsedSeconds: 600,
      primaryKrId: c.primaryKrId,
      noKrReason: c.noKrReason,
      relatedKr: [],
      relatedTti: [],
      options: [],
      selected: undefined,
      originRefs: [],
      memoryRefs: [],
      actionItems: [],
      vetoes: [],
      createdBy: c.createdBy ?? 'u1',
      createdAt: c.createdAt ?? new Date().toISOString(),
      tenantId: c.tenantId ?? 'default',
      watermark: { isProxy: false },
    } as DecisionCard;
    await store.decisionCards.create(full);
  }
}

async function clearDecisionCards() {
  const store = getStore();
  for (const c of await store.decisionCards.list()) {
    await store.decisionCards.delete(c.id);
  }
  for (const p of await store.skillProposals.list()) {
    await store.skillProposals.delete(p.id);
  }
}

describe('§CA-9 · pattern-detector + skill-proposal · 习惯沉淀', () => {
  beforeEach(clearDecisionCards);

  it('< minFrequency 张 DC → 不出 pattern', async () => {
    await seedDecisionCards([
      { id: 'dc1', title: '随便议事', primaryKrId: 'kr_x' },
      { id: 'dc2', title: '另一个', primaryKrId: 'kr_y' },
    ]);
    const { detectPatterns } = await import('@/lib/skills/pattern-detector');
    const out = await detectPatterns({ minFrequency: 3 });
    expect(out.length).toBe(0);
  });

  it('同一 KR ≥ 3 张 → 检测出 kr_recurring 模式', async () => {
    await seedDecisionCards([
      { id: 'dc1', title: '客户投诉处理 1', primaryKrId: 'kr_retention' },
      { id: 'dc2', title: '客户投诉处理 2', primaryKrId: 'kr_retention' },
      { id: 'dc3', title: '客户投诉处理 3', primaryKrId: 'kr_retention' },
      { id: 'dc4', title: '别的事', primaryKrId: 'kr_other' },
    ]);
    const { detectPatterns } = await import('@/lib/skills/pattern-detector');
    const out = await detectPatterns({ minFrequency: 3 });
    expect(out.length).toBeGreaterThanOrEqual(1);
    const krPattern = out.find((p) => p.proposedId.startsWith('kr_recurring__'));
    expect(krPattern).toBeDefined();
    expect(krPattern!.frequency).toBe(3);
    expect(krPattern!.evidenceDecisionCardIds).toContain('dc1');
  });

  it('generateSkillProposal 启发式 → 写入 skillProposals + status=draft', async () => {
    const { generateSkillProposal } = await import('@/lib/skills/skill-proposal');
    const proposal = await generateSkillProposal({
      pattern: {
        proposedId: 'test_skill',
        description: '测试用 skill',
        triggerConditions: ['cond1'],
        evidenceDecisionCardIds: ['dc1', 'dc2', 'dc3'],
        affectedContext: 'meeting_advice',
        frequency: 3,
      },
      useLlm: false,
    });
    expect(proposal).not.toBeNull();
    expect(proposal!.status).toBe('draft');
    expect(proposal!.draft.body).toContain('test_skill');
    expect(proposal!.draft.recommendedSkillIds).toContain('memory.search');

    const store = getStore();
    const saved = await store.skillProposals.get(proposal!.id);
    expect(saved).not.toBeNull();
    expect(saved!.id).toBe(proposal!.id);
  });

  it('reviewSkillProposal approve → status=approved + reviewedBy', async () => {
    const { generateSkillProposal, reviewSkillProposal } = await import(
      '@/lib/skills/skill-proposal'
    );
    const proposal = await generateSkillProposal({
      pattern: {
        proposedId: 'review_test',
        description: '审批测试',
        triggerConditions: [],
        evidenceDecisionCardIds: ['dc1', 'dc2', 'dc3'],
        affectedContext: 'meeting_advice',
        frequency: 3,
      },
      useLlm: false,
    });
    expect(proposal).not.toBeNull();
    const reviewed = await reviewSkillProposal(proposal!.id, true, 'owner1', '看起来合理');
    expect(reviewed).not.toBeNull();
    expect(reviewed!.status).toBe('approved');
    expect(reviewed!.reviewedBy).toBe('owner1');
    expect(reviewed!.reviewReason).toBe('看起来合理');
  });

  it('reviewSkillProposal 不存在 → null', async () => {
    const { reviewSkillProposal } = await import('@/lib/skills/skill-proposal');
    const r = await reviewSkillProposal('skp_nope', true, 'u1');
    expect(r).toBeNull();
  });
});
