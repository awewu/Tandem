/**
 * Anti-regression tests — AI 课程生成 (真 LLM 接入, 替换原 route stub)
 *
 * 锁死:
 *   - parseLessonJson 严格校验 (恰好 5 题 / 每题 4 选项 / correctIdx 0-3)
 *   - generateLesson 成功路径: 注入 fake router 返回合规 JSON → isStub=false + modelUsed
 *   - generateLesson 兜底路径: 无 provider / LLM 抛错 / 解析失败 → isStub=true, 仍给 generated (不断闭环)
 *   - 租户隔离: 跨 tenant 素材取不到 → 返回 null (route 转 404)
 */

import { describe, it, expect } from 'vitest';
import {
  parseLessonJson,
  resolveSourceText,
  generateLesson,
  type GenerateLessonDeps,
} from '@/lib/learning/generate';
import type { GenerateLessonInput } from '@/lib/learning/types';

function validLessonJson(): string {
  return JSON.stringify({
    lecture: '## 概念\n这是讲解.\n## 实操\n步骤.\n## 边界\n注意.',
    questions: Array.from({ length: 5 }, (_, i) => ({
      question: `题 ${i + 1}?`,
      options: ['A', 'B', 'C', 'D'],
      correctAnswerIdx: i % 4,
      explanation: '依据素材.',
    })),
    summaryCard: ['要点1', '要点2', '要点3'],
  });
}

function fakeStore(rec: Record<string, unknown> | null): GenerateLessonDeps['store'] {
  const repo = { get: async (_id: string) => rec as never };
  return { memories: repo, materials: repo, documents: repo } as never;
}

function fakeRouter(content: string, opts?: { throw?: boolean }): GenerateLessonDeps['router'] {
  return {
    listProviders: () => ['fake'],
    chat: async () => {
      if (opts?.throw) throw new Error('llm down');
      return { message: { role: 'assistant', content }, model: 'fake-model' } as never;
    },
  } as never;
}

const baseInput: GenerateLessonInput = {
  sourceId: 'mem-1',
  sourceType: 'memory',
  userId: 'u1',
  category: 'sop' as never,
};

describe('parseLessonJson', () => {
  it('合规 JSON → 解析出 5 题', () => {
    const r = parseLessonJson(validLessonJson());
    expect(r).not.toBeNull();
    expect(r!.questions).toHaveLength(5);
    expect(r!.questions.every((q) => q.options.length === 4)).toBe(true);
    expect(r!.questions.every((q) => q.correctAnswerIdx >= 0 && q.correctAnswerIdx <= 3)).toBe(true);
  });

  it('剥离 markdown 代码块围栏', () => {
    const r = parseLessonJson('```json\n' + validLessonJson() + '\n```');
    expect(r).not.toBeNull();
  });

  it('题数不足 5 → null', () => {
    const bad = JSON.parse(validLessonJson());
    bad.questions = bad.questions.slice(0, 3);
    expect(parseLessonJson(JSON.stringify(bad))).toBeNull();
  });

  it('correctAnswerIdx 越界的题被丢弃, 不足 5 → null', () => {
    const bad = JSON.parse(validLessonJson());
    bad.questions[0].correctAnswerIdx = 9;
    expect(parseLessonJson(JSON.stringify(bad))).toBeNull();
  });

  it('空/垃圾输入 → null', () => {
    expect(parseLessonJson('')).toBeNull();
    expect(parseLessonJson('not json')).toBeNull();
  });
});

describe('resolveSourceText · 租户隔离', () => {
  it('同租户素材可取', async () => {
    const store = fakeStore({ title: 'T', body: 'BODY', tenantId: 'default' });
    const r = await resolveSourceText(baseInput, store, 'default');
    expect(r).toEqual({ title: 'T', text: 'BODY' });
  });

  it('跨租户素材取不到 → null', async () => {
    const store = fakeStore({ title: 'T', body: 'BODY', tenantId: 'other' });
    const r = await resolveSourceText(baseInput, store, 'default');
    expect(r).toBeNull();
  });

  it('素材不存在 → null', async () => {
    const r = await resolveSourceText(baseInput, fakeStore(null), 'default');
    expect(r).toBeNull();
  });
});

describe('generateLesson', () => {
  it('成功路径: 真 router 返回合规 JSON → isStub=false + modelUsed', async () => {
    const res = await generateLesson(baseInput, {
      store: fakeStore({ title: 'SOP-1', body: '内容', tenantId: 'default' }),
      router: fakeRouter(validLessonJson()),
      tenantId: 'default',
    });
    expect(res).not.toBeNull();
    expect(res!.isStub).toBe(false);
    expect(res!.modelUsed).toBe('fake-model');
    expect(res!.generated.questions).toHaveLength(5);
  });

  it('LLM 抛错 → 回退兜底 (isStub=true, 仍给 generated)', async () => {
    const res = await generateLesson(baseInput, {
      store: fakeStore({ title: 'SOP-1', body: '内容', tenantId: 'default' }),
      router: fakeRouter('', { throw: true }),
      tenantId: 'default',
    });
    expect(res!.isStub).toBe(true);
    expect(res!.fallbackReason).toBe('llm_error');
    expect(res!.generated.questions).toHaveLength(5);
  });

  it('解析失败 → 回退兜底 (parse_failed)', async () => {
    const res = await generateLesson(baseInput, {
      store: fakeStore({ title: 'SOP-1', body: '内容', tenantId: 'default' }),
      router: fakeRouter('garbage not json'),
      tenantId: 'default',
    });
    expect(res!.isStub).toBe(true);
    expect(res!.fallbackReason).toBe('parse_failed');
  });

  it('无 provider → 兜底 (no_provider)', async () => {
    const noProvider = { listProviders: () => [], chat: async () => ({}) } as never;
    const res = await generateLesson(baseInput, {
      store: fakeStore({ title: 'SOP-1', body: '内容', tenantId: 'default' }),
      router: noProvider,
      tenantId: 'default',
    });
    expect(res!.isStub).toBe(true);
    expect(res!.fallbackReason).toBe('no_provider');
  });

  it('素材不存在 → null (route 转 404)', async () => {
    const res = await generateLesson(baseInput, {
      store: fakeStore(null),
      router: fakeRouter(validLessonJson()),
      tenantId: 'default',
    });
    expect(res).toBeNull();
  });
});
