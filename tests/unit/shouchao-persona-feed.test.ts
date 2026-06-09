/**
 * 搭子手抄 → 工作分身 · "喂给分身"端到端闭环验证
 *
 * 按"防假闭环"纪律: 不只测 retrieveSharedNotesForPersona 返回值, 要断言
 * 经过生产唯一治理出口 governedChat → 授权笔记内容真出现在送进 LLM 的 messages[0]。
 *
 * 覆盖:
 *   - 开启"喂给分身": 笔记内容 + 个人语料声明 真注入 LLM system prompt
 *   - 撤回授权: 内容不再出现 (闸门可逆)
 *   - 隔离: 他人授权的笔记绝不串进本人的分身 prompt
 *   - 红线优先: 个人语料带"不得突破企业红线"的治理框
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { governedChat } from '../../lib/governance/governed-chat';
import { setStore } from '../../lib/storage/repository';
import { createInMemoryStore } from '../../lib/storage/memory-store';
import { createNote, setSharedToPersona } from '../../lib/shouchao/service';
import type { ChatRequest, ChatResponse } from '../../lib/taf/provider/types';

const ALICE = 'user_alice';
const BOB = 'user_bob';
const TENANT = 'default';
const G = globalThis as unknown as { __tandem_router__?: unknown };

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

/** 跑一次工作分身对话, 返回送进 LLM 的 system prompt 文本 */
async function personaSystemPromptFor(actorUserId: string, intent: string): Promise<string> {
  const calls = installFakeRouter();
  const r = await governedChat({
    actorUserId,
    intent,
    basePersonaPrompt: '【分身底座】你是该员工的工作搭子',
    messages: [{ role: 'user', content: intent }],
    agentKind: 'persona',
    skipOutputGuard: true,
  });
  expect(r.ok).toBe(true);
  expect(calls.length).toBe(1);
  const sys = calls[0].messages[0];
  expect(sys.role).toBe('system');
  return String(sys.content);
}

beforeEach(() => {
  setStore(createInMemoryStore());
});

afterEach(() => {
  delete G.__tandem_router__;
});

describe('喂给分身 · 端到端注入', () => {
  it('开启授权 → 笔记内容真出现在工作分身的 system prompt', async () => {
    const marker = '我是夜猫子习惯晚上专注做难题';
    const n = await createNote({ ownerId: ALICE, tenantId: TENANT, title: '工作偏好', content: marker });
    await setSharedToPersona(ALICE, n.id, true);

    const sys = await personaSystemPromptFor(ALICE, '帮我安排今天的工作节奏');
    expect(sys).toContain('个人手抄语料');
    expect(sys).toContain(marker);
    // 治理框: 个人语料不得突破企业红线
    expect(sys).toContain('不得据此突破企业红线');
  });

  it('未开启授权 → 笔记不进 prompt (默认关)', async () => {
    const marker = '这是一条没授权的私密笔记XYZ';
    await createNote({ ownerId: ALICE, tenantId: TENANT, content: marker });
    const sys = await personaSystemPromptFor(ALICE, '随便聊聊');
    expect(sys).not.toContain(marker);
    expect(sys).not.toContain('个人手抄语料');
  });

  it('撤回授权 → 笔记不再出现 (闸门可逆)', async () => {
    const marker = '一度授权过的内容ABC';
    const n = await createNote({ ownerId: ALICE, tenantId: TENANT, content: marker });
    await setSharedToPersona(ALICE, n.id, true);
    expect(await personaSystemPromptFor(ALICE, '聊聊')).toContain(marker);

    await setSharedToPersona(ALICE, n.id, false);
    expect(await personaSystemPromptFor(ALICE, '聊聊')).not.toContain(marker);
  });

  it('隔离 → 他人授权的笔记绝不串进本人的分身', async () => {
    const bobMarker = 'BOB的私人笔记不该泄漏给ALICE';
    const bobNote = await createNote({ ownerId: BOB, tenantId: TENANT, content: bobMarker });
    await setSharedToPersona(BOB, bobNote.id, true);

    const aliceSys = await personaSystemPromptFor(ALICE, '帮我看看');
    expect(aliceSys).not.toContain(bobMarker);
  });
});
