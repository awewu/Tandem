/**
 * D-01 · 文档 @ 引用 resolver + LLM router preprocessMessages 集成测试
 *
 * 验证:
 *   1. 无 mention 时 resolver 立即返回 (0 IO)
 *   2. 命中文档时, inline 文本被替换 + appendix 包含原文 + 命中详情正确
 *   3. 文档不存在时, 标记 found=false + inline 给出"未找到"提示
 *   4. 超过单文件 budget 时 truncated=true + 标注 "[已截断]"
 *   5. TandemRouter.chat 内部 preprocessMessages 把 mention 展开到 system 消息
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  resolveDocumentMentions,
  hasDocumentMention,
} from '@/lib/documents/resolve-mentions';
import { TandemRouter } from '@/lib/taf/router';
import type { ChatMessage, ChatRequest, ChatResponse, LLMProvider } from '@/lib/taf/provider/types';

beforeAll(() => {
  setStore(createInMemoryStore());
});

beforeEach(async () => {
  const store = getStore();
  for (const d of await store.documents.list()) await store.documents.delete(d.id);
});

async function seedDoc(id: string, title: string, content: string) {
  const store = getStore();
  await store.documents.create({
    id,
    title,
    content,
    type: 'doc',
    ownerId: 'u1',
    tenantId: 'default',
    permissions: { read: ['u1'], write: ['u1'] },
    version: 1,
    isLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any);
}

describe('hasDocumentMention', () => {
  it('无 mention → false', () => {
    expect(hasDocumentMention('hello world')).toBe(false);
    expect(hasDocumentMention('@OKR-Q1')).toBe(false);
  });
  it('有 mention → true', () => {
    expect(hasDocumentMention('看 [[doc:abc|文件]] 给建议')).toBe(true);
    expect(hasDocumentMention('[[doc:xyz]]')).toBe(true);
  });
});

describe('resolveDocumentMentions', () => {
  it('无 mention → 原样返回, 0 IO', async () => {
    const r = await resolveDocumentMentions('普通文本, 没有引用');
    expect(r.inlineText).toBe('普通文本, 没有引用');
    expect(r.appendix).toBe('');
    expect(r.mentions).toHaveLength(0);
  });

  it('命中文档 → inline 替换 + appendix 含原文', async () => {
    await seedDoc('doc1', '合同.pdf', '本合同金额为 100 万元, 履约期 12 个月.');
    const r = await resolveDocumentMentions('请基于 [[doc:doc1|合同.pdf]] 给出风险点');
    expect(r.inlineText).toContain('(见附录 1: 合同.pdf)');
    expect(r.inlineText).not.toContain('[[doc:doc1');
    expect(r.appendix).toContain('## 用户引用的文档原文');
    expect(r.appendix).toContain('本合同金额为 100 万元');
    expect(r.mentions).toHaveLength(1);
    expect(r.mentions[0]).toMatchObject({ id: 'doc1', found: true, truncated: false });
  });

  it('多个 mention → 多个附录, 按出现顺序编号', async () => {
    await seedDoc('a', 'A 文档', 'A 的内容');
    await seedDoc('b', 'B 文档', 'B 的内容');
    const r = await resolveDocumentMentions('对比 [[doc:a|A]] 和 [[doc:b|B]] 哪个好');
    expect(r.inlineText).toContain('(见附录 1: A 文档)');
    expect(r.inlineText).toContain('(见附录 2: B 文档)');
    expect(r.appendix).toContain('A 的内容');
    expect(r.appendix).toContain('B 的内容');
    expect(r.mentions).toHaveLength(2);
  });

  it('文档不存在 → found=false, inline 给"未找到"', async () => {
    const r = await resolveDocumentMentions('看 [[doc:missing|消失的文件]] 评论');
    expect(r.inlineText).toContain('(文档 消失的文件 未找到)');
    expect(r.appendix).toBe('');
    expect(r.mentions[0]).toMatchObject({ id: 'missing', found: false });
  });

  it('超长文档 → truncated=true + "[已截断]" 标注', async () => {
    const big = 'x'.repeat(10_000);
    await seedDoc('big', 'big.txt', big);
    const r = await resolveDocumentMentions('总结 [[doc:big|big.txt]]');
    expect(r.mentions[0].truncated).toBe(true);
    expect(r.appendix).toContain('[已截断, 原文 10000 字]');
    expect(r.mentions[0].charCount).toBeLessThanOrEqual(8200);
  });
});

describe('TandemRouter.preprocessMessages (集成)', () => {
  // 简易 echo provider, 抓取收到的 req 用于断言
  function makeEchoProvider(): LLMProvider & { getCaptured: () => ChatRequest | null } {
    let captured: ChatRequest | null = null;
    const provider: LLMProvider = {
      name: 'echo',
      capabilities: {
        chat: true,
        functionCalling: false,
        streaming: true,
        jsonMode: false,
        vision: false,
        maxContextTokens: 8192,
      },
      async chat(req: ChatRequest): Promise<ChatResponse> {
        captured = req;
        return {
          id: 'echo-1',
          message: { role: 'assistant', content: 'ok' },
          finishReason: 'stop',
          model: 'echo-v1',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      },
      async *chatStream() {
        yield { delta: { content: '' } };
      },
      async countTokens(text: string) {
        return text.length;
      },
      async healthCheck() {
        return { healthy: true };
      },
    };
    return Object.assign(provider, { getCaptured: () => captured });
  }

  it('user message 含 mention → preprocess 后注入 system 附录, mention 替换为短标签', async () => {
    await seedDoc('d1', '风险评估.md', '关键风险: 现金流缺口 200 万');

    const provider = makeEchoProvider();
    const router = new TandemRouter();
    router.registerProvider(provider);

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是一个分析师.' },
      { role: 'user', content: '基于 [[doc:d1|风险评估.md]] 给出 3 条结论' },
    ];

    await router.chat({ messages, forceProvider: 'echo' });

    const cap = provider.getCaptured();
    expect(cap).not.toBeNull();
    const sys = cap!.messages.find((m) => m.role === 'system')!;
    expect(sys.content).toContain('现金流缺口 200 万');
    const user = cap!.messages.find((m) => m.role === 'user')!;
    expect(user.content).toContain('(见附录 1: 风险评估.md)');
    expect(user.content).not.toContain('[[doc:d1');
  });

  it('无 mention → req.messages 不变, 0 注入', async () => {
    const provider = makeEchoProvider();
    const router = new TandemRouter();
    router.registerProvider(provider);

    const messages: ChatMessage[] = [{ role: 'user', content: '你好' }];
    await router.chat({ messages, forceProvider: 'echo' });

    const cap = provider.getCaptured()!;
    expect(cap.messages).toHaveLength(1);
    expect(cap.messages[0].content).toBe('你好');
  });

  it('无 system 但 user 有 mention → 自动 unshift 一条 system 附录', async () => {
    await seedDoc('d2', 'memo.txt', '本季度策略: 收缩成本.');

    const provider = makeEchoProvider();
    const router = new TandemRouter();
    router.registerProvider(provider);

    await router.chat({
      messages: [{ role: 'user', content: '[[doc:d2|memo.txt]] 同意吗' }],
      forceProvider: 'echo',
    });

    const cap = provider.getCaptured()!;
    expect(cap.messages[0].role).toBe('system');
    expect(cap.messages[0].content).toContain('收缩成本');
  });
});
