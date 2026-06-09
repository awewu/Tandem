/**
 * governedChat 闭环断言测试 (P1-M4 · 唯一强制治理出口)
 *
 * 按"防假闭环"纪律 (内存 7b67ce8c): 不只测函数返回, 要断言
 *   - 输入闸 HARD_BLOCK 真拦截 (不进 LLM)
 *   - 动作闸红区真拦截
 *   - 治理后的 systemPrompt 真注入到 LLM messages[0] (企业受控声明 + persona prompt)
 *   - autonomous fail-closed: 基线闸故障 = 拦截, 非放行
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { governedChat } from '../../lib/governance/governed-chat';
import { getStore, setStore } from '../../lib/storage/repository';
import { createInMemoryStore } from '../../lib/storage/memory-store';
import type { MemoryEntry, MemoryOwnershipLevel } from '../../lib/types/memory';
import type { ChatRequest, ChatResponse } from '../../lib/taf/provider/types';

const ACTOR = 'user_alice';
const G = globalThis as unknown as { __tandem_router__?: unknown };

/** 捕获式假 router: 记录最近一次 chat() 的 messages, 返回固定答复 */
function installFakeRouter(answer = '这是一个无害的测试回答, 足够长以通过最小长度检查。') {
  const calls: ChatRequest[] = [];
  const fake = {
    async chat(req: ChatRequest): Promise<ChatResponse> {
      calls.push(req);
      return {
        id: 'fake_1',
        message: { role: 'assistant', content: answer },
        finishReason: 'stop',
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        model: 'fake-model',
      };
    },
    chatStream: async function* () {
      /* unused */
    },
    listProviders: () => ['fake-model'],
    healthCheckAll: async () => ({}),
  };
  G.__tandem_router__ = fake;
  return calls;
}

async function seedMemory(p: {
  id: string;
  title: string;
  body: string;
  ownershipLevel: MemoryOwnershipLevel;
  type?: MemoryEntry['type'];
}): Promise<void> {
  const store = getStore();
  const now = new Date().toISOString();
  await store.memories.create({
    id: p.id,
    type: p.type ?? 'sop',
    title: p.title,
    body: p.body,
    status: 'active',
    signers: [],
    referenceCount: 0,
    ownershipLevel: p.ownershipLevel,
    createdAt: now,
    updatedAt: now,
  } as MemoryEntry);
}

beforeAll(() => {
  setStore(createInMemoryStore());
});

beforeEach(async () => {
  setStore(createInMemoryStore());
  installFakeRouter();
});

afterEach(() => {
  delete G.__tandem_router__;
});

describe('governedChat · 输入闸', () => {
  it('命中公司级红线 → ok=false, blocked.stage=input, 不进 LLM', async () => {
    await seedMemory({
      id: 'm-redline',
      title: '客户数据出境',
      body: '客户数据出境严禁',
      ownershipLevel: 'company',
      type: 'redline',
    });
    const calls = installFakeRouter();
    const r = await governedChat({
      actorUserId: ACTOR,
      intent: '客户数据出境',
      basePersonaPrompt: '你是销售搭子',
      messages: [{ role: 'user', content: '客户数据出境' }],
      agentKind: 'persona',
      skipOutputGuard: true,
    });
    expect(r.ok).toBe(false);
    expect(r.blocked?.stage).toBe('input');
    expect(calls.length).toBe(0); // HARD_BLOCK 绝不进 LLM
  });
});

describe('governedChat · systemContent 真注入', () => {
  it('治理后的 systemPrompt 真出现在 LLM messages[0] (企业受控声明 + persona prompt)', async () => {
    const calls = installFakeRouter();
    const r = await governedChat({
      actorUserId: ACTOR,
      intent: '帮我总结一下今天的工作',
      basePersonaPrompt: '【独特标记】你是工程搭子小柯',
      messages: [{ role: 'user', content: '帮我总结一下今天的工作' }],
      agentKind: 'persona',
      skipOutputGuard: true,
    });
    expect(r.ok).toBe(true);
    expect(r.answer).toBeTruthy();
    expect(calls.length).toBe(1);
    const sys = calls[0].messages[0];
    expect(sys.role).toBe('system');
    expect(String(sys.content)).toContain('企业受控声明');
    expect(String(sys.content)).toContain('【独特标记】你是工程搭子小柯');
    // 原始 user 消息仍在
    expect(calls[0].messages.some((m) => m.role === 'user')).toBe(true);
  });
});

describe('governedChat · 动作闸 (闸④ 内容判定)', () => {
  it('动作内容涉及对外发送 → 红区 HARD_BLOCK, blocked.stage=action, 不进 LLM', async () => {
    const calls = installFakeRouter();
    const r = await governedChat({
      actorUserId: ACTOR,
      intent: '把最终报价发送给客户并承诺折扣',
      basePersonaPrompt: '你是销售搭子',
      messages: [{ role: 'user', content: '把最终报价发送给客户' }],
      agentKind: 'persona',
      action: { dataScope: 'personal', declaredActionScope: 'read_only' },
      skipOutputGuard: true,
    });
    expect(r.ok).toBe(false);
    expect(r.blocked?.stage).toBe('action');
    expect(r.gates.action?.zone).toBe('red');
    expect(calls.length).toBe(0);
  });

  it('绿区动作 (read_only 无害内容) → 通过, 进 LLM', async () => {
    const calls = installFakeRouter();
    const r = await governedChat({
      actorUserId: ACTOR,
      intent: '看一下本周任务列表',
      basePersonaPrompt: '你是搭子',
      messages: [{ role: 'user', content: '看一下本周任务列表' }],
      agentKind: 'persona',
      action: { dataScope: 'personal', declaredActionScope: 'read_only' },
      skipOutputGuard: true,
    });
    expect(r.ok).toBe(true);
    expect(r.gates.action?.zone).toBe('green');
    expect(calls.length).toBe(1);
  });
});

describe('governedChat · autonomous fail-closed', () => {
  it('基线闸故障 (store 抛错 → checkId 空) + autonomous → 拦截, 不放行', async () => {
    // 安装一个会抛错的 store, 让 checkBaseline 内部失败 → checkId='' (闸未成功执行)
    setStore({
      memories: { list: async () => { throw new Error('boom'); } },
    } as never);
    const calls = installFakeRouter();
    const r = await governedChat({
      actorUserId: ACTOR,
      intent: '自动执行某个任务',
      messages: [{ role: 'user', content: '自动执行某个任务' }],
      agentKind: 'autonomous',
      // failMode 不传, autonomous 默认 fail-closed
      skipOutputGuard: true,
    });
    expect(r.ok).toBe(false);
    expect(r.blocked?.stage).toBe('input');
    expect(r.gates.input.failed).toBe(true);
    expect(calls.length).toBe(0); // fail-closed 不进 LLM
  });

  it('同样基线闸故障但 persona (fail-open) → 放行进 LLM', async () => {
    setStore({
      memories: { list: async () => { throw new Error('boom'); } },
    } as never);
    const calls = installFakeRouter();
    const r = await governedChat({
      actorUserId: ACTOR,
      intent: '帮我看看资料',
      basePersonaPrompt: '你是搭子',
      messages: [{ role: 'user', content: '帮我看看资料' }],
      agentKind: 'persona', // fail-open
      skipOutputGuard: true,
    });
    expect(r.ok).toBe(true);
    expect(r.gates.input.failed).toBe(true); // 闸确实故障了
    expect(calls.length).toBe(1); // 但 fail-open 仍放行
  });
});
