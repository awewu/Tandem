/**
 * tests/unit/document-review.test.ts · DOC-3 + CA-13 第六接入点 锁
 *
 *   1. LLM 真跑过 → recordDecision({context:'document_review', refId, refType:'document'})
 *   2. LLM 抛错 → 返回降级 review (llmRan=false), 不调 recordDecision
 *   3. LLM 返回非法 JSON → llmRan=false, 不调 recordDecision (输出不可信)
 *   4. 净化器: 越界 score 夹到 1-5, 非法 action 过滤, 数组 ≤ 5
 *   5. 文档不存在 → 返回 null
 *   6. audit 总是写 (含降级 path)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage } from '@/lib/taf/provider/types';

const { chatMock, recordDecisionMock, auditMock } = vi.hoisted(() => ({
  chatMock: vi.fn() as ReturnType<typeof vi.fn>,
  recordDecisionMock: vi.fn(async (_input: Record<string, unknown>) => null),
  auditMock: vi.fn(async (_action: string, _actor: string, _options?: Record<string, unknown>) => undefined),
}));

vi.mock('@/lib/boot', () => ({
  getRouter: vi.fn(() => ({ chat: chatMock })),
}));

vi.mock('@/lib/persona/company-brain-decision', () => ({
  recordDecision: recordDecisionMock,
}));

vi.mock('@/lib/audit/log', () => ({
  audit: auditMock,
}));

import { setStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createAppContext } from '@/lib/repositories/app-context-factory';
import { reviewDocument } from '@/lib/persona/document-review';
import type { Document } from '@/lib/types/feishu-catchup';

function makeDoc(over: Partial<Document> = {}): Document {
  return {
    id: 'doc1',
    title: 'Q2 项目复盘',
    content: '本季度交付了三个功能, 但用户反馈延迟较高. 计划下季度优化基础设施.',
    type: 'doc',
    ownerId: 'u1',
    tenantId: 'default',
    permissions: {},
    version: 1,
    isLocked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

function chatResp(content: string) {
  return {
    id: 'resp1',
    message: { role: 'assistant' as const, content } satisfies ChatMessage,
    finishReason: 'stop' as const,
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: 'kimi-k2',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setStore(createInMemoryStore());
});

describe('reviewDocument · 主路径 (LLM 真跑过 → CA-13)', () => {
  it('LLM 真跑过 → 解析评审 + recordDecision 喂 CA-13', async () => {
    await createAppContext().documentRepo.create(makeDoc());
    chatMock.mockResolvedValueOnce(
      chatResp(
        JSON.stringify({
          summary: '复盘 Q2 三个功能 + 基础设施优化计划',
          clarityScore: 4,
          clarityFeedback: '叙述清晰, 但缺数据支撑',
          missingPoints: ['具体用户反馈数据', '基础设施优化目标量化'],
          risks: ['延迟没有量化基线, 难以验证改进'],
          suggestedActions: ['revise', 'promote_to_memory'],
          rationale: '内容有沉淀价值但需补量化数据再升 Memory',
        }),
      ),
    );

    const review = await reviewDocument({ documentId: 'doc1', requesterId: 'u1' });

    expect(review).not.toBeNull();
    expect(review!.llmRan).toBe(true);
    expect(review!.clarityScore).toBe(4);
    expect(review!.missingPoints).toHaveLength(2);
    expect(review!.risks).toHaveLength(1);
    expect(review!.suggestedActions).toEqual(['revise', 'promote_to_memory']);

    // CA-13 喂料
    expect(recordDecisionMock).toHaveBeenCalledTimes(1);
    const call = recordDecisionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.context).toBe('document_review');
    expect(call.refId).toBe('doc1');
    expect(call.refType).toBe('document');
    expect(call.tokensIn).toBe(100);
    expect(call.tokensOut).toBe(50);

    // audit 也写了
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0]?.[0]).toBe('document_review.generated');
  });
});

describe('reviewDocument · 降级路径 (不喂 CA-13)', () => {
  it('LLM 抛错 → llmRan=false, 不调 recordDecision, audit 仍写', async () => {
    await createAppContext().documentRepo.create(makeDoc());
    chatMock.mockRejectedValueOnce(new Error('upstream timeout'));

    const review = await reviewDocument({ documentId: 'doc1', requesterId: 'u1' });

    expect(review).not.toBeNull();
    expect(review!.llmRan).toBe(false);
    expect(review!.summary).toContain('降级');

    expect(recordDecisionMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledTimes(1);
    const opts = auditMock.mock.calls[0]?.[2] as { metadata: { llmRan: boolean } } | undefined;
    expect(opts?.metadata.llmRan).toBe(false);
  });

  it('LLM 返回非法 JSON → llmRan=false, 不调 recordDecision (输出不可信)', async () => {
    await createAppContext().documentRepo.create(makeDoc());
    chatMock.mockResolvedValueOnce(chatResp('这不是 JSON, 模型胡说'));

    const review = await reviewDocument({ documentId: 'doc1', requesterId: 'u1' });

    expect(review!.llmRan).toBe(false);
    expect(recordDecisionMock).not.toHaveBeenCalled();
  });
});

describe('reviewDocument · 净化器', () => {
  it('越界 clarityScore 夹到 1-5, 非法 action 过滤, 数组 ≤ 5', async () => {
    await createAppContext().documentRepo.create(makeDoc());
    chatMock.mockResolvedValueOnce(
      chatResp(
        JSON.stringify({
          summary: 'OK',
          clarityScore: 99, // 越界
          clarityFeedback: 'OK',
          missingPoints: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], // > 5
          risks: ['r1'],
          suggestedActions: ['promote_to_memory', 'INVALID_ACTION', 'archive'], // 中间非法
          rationale: 'OK',
        }),
      ),
    );

    const r = await reviewDocument({ documentId: 'doc1', requesterId: 'u1' });
    expect(r!.clarityScore).toBe(5); // clamp
    expect(r!.missingPoints).toHaveLength(5); // truncated
    expect(r!.suggestedActions).toEqual(['promote_to_memory', 'archive']);
  });

  it('clarityScore 缺失 → 默认 3 (中性)', async () => {
    await createAppContext().documentRepo.create(makeDoc());
    chatMock.mockResolvedValueOnce(chatResp(JSON.stringify({ summary: 'no score' })));
    const r = await reviewDocument({ documentId: 'doc1', requesterId: 'u1' });
    expect(r!.clarityScore).toBe(3);
  });
});

describe('reviewDocument · 边界', () => {
  it('文档不存在 → null', async () => {
    const r = await reviewDocument({ documentId: 'nope', requesterId: 'u1' });
    expect(r).toBeNull();
    expect(chatMock).not.toHaveBeenCalled();
  });

  it('refId/refType 一一对位 (admin 看板要靠这两个字段跳到原文档)', async () => {
    await createAppContext().documentRepo.create(makeDoc({ id: 'doc-traceable' }));
    chatMock.mockResolvedValueOnce(
      chatResp(JSON.stringify({ summary: 'x', clarityScore: 3, suggestedActions: [] })),
    );
    await reviewDocument({ documentId: 'doc-traceable', requesterId: 'u1' });
    const call = recordDecisionMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.refId).toBe('doc-traceable');
    expect(call.refType).toBe('document');
  });
});
