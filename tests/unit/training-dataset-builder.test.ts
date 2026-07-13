/**
 * CA-11 L2 · 训练数据集构建器测试
 *
 * 覆盖: adopted→SFT / overruled+corrected→SFT+DPO / modified→SFT+DPO /
 *       pending/ignored 跳过 / implicit 默认剔除 (可开启) / 无 correctedOutput 的 overruled 跳过 /
 *       reflexion 个人教训独立 personal split (决策防火墙) / JSONL 序列化。
 * 不调真实 LLM/DB, 用内存 store。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  buildTrainingDataset,
  sftToJsonl,
  dpoToJsonl,
} from '@/lib/training/dataset-builder';
import { recordDecision, setFeedback } from '@/lib/persona/company-brain-decision';
import type { RecordDecisionInput } from '@/lib/persona/company-brain-decision';
import type { CompanyBrainFeedbackOutcome } from '@/lib/types/company-brain';
import type { MemoryEntry } from '@/lib/types/memory';

const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
});

function baseInput(overrides: Partial<RecordDecisionInput> = {}): RecordDecisionInput {
  return {
    context: 'boss_ai_reply',
    inputSummary: '本季度华东大区的回款进度如何, 有没有风险?',
    outputSummary: '华东回款按计划推进, 暂无重大风险。',
    modelUsed: 'deepseek-chat',
    providerUsed: 'deepseek',
    scenario: 'reasoning_complex',
    tokensIn: 100,
    tokensOut: 50,
    costMicroUsd: 10,
    latencyMs: 800,
    tenantId: TENANT,
    ...overrides,
  };
}

async function seedDecision(
  outcome: Exclude<CompanyBrainFeedbackOutcome, 'pending'> | 'pending',
  opts: {
    inputSummary?: string;
    outputSummary?: string;
    correctedOutput?: string;
    feedbackSource?: 'explicit' | 'implicit';
  } = {},
): Promise<string> {
  const d = await recordDecision(
    baseInput({
      ...(opts.inputSummary !== undefined ? { inputSummary: opts.inputSummary } : {}),
      ...(opts.outputSummary !== undefined ? { outputSummary: opts.outputSummary } : {}),
    }),
  );
  if (!d) throw new Error('recordDecision returned null');
  if (outcome !== 'pending') {
    await setFeedback(d.id, {
      outcome,
      feedbackBy: 'user_boss',
      correctedOutput: opts.correctedOutput,
      feedbackSource: opts.feedbackSource,
    });
  }
  return d.id;
}

describe('buildTrainingDataset · 信号映射', () => {
  it('adopted → SFT 正样本 (completion=AI 原答)', async () => {
    await seedDecision('adopted', {
      inputSummary: '给经销商 A 的返利政策该怎么定?',
      outputSummary: '按季度回款达成率阶梯返利, 90% 以上给 3 个点。',
    });
    const { sft, dpo, stats } = await buildTrainingDataset({ tenantId: TENANT });
    expect(sft).toHaveLength(1);
    expect(dpo).toHaveLength(0);
    expect(sft[0].meta.signal).toBe('adopted');
    expect(sft[0].meta.ownershipLevel).toBe('organizational');
    expect(sft[0].messages[1].content).toContain('阶梯返利');
    expect(stats.sftFromAdopted).toBe(1);
  });

  it('overruled + correctedOutput → SFT(更正) + DPO(chosen=更正, rejected=原答)', async () => {
    await seedDecision('overruled', {
      inputSummary: '要不要给客户 B 延长账期到 90 天?',
      outputSummary: '可以延长到 90 天以促成交。',
      correctedOutput: '不可延长, 客户 B 已超授信额度, 违反回款红线。',
    });
    const { sft, dpo, stats } = await buildTrainingDataset({ tenantId: TENANT });
    expect(stats.sftFromCorrection).toBe(1);
    expect(dpo).toHaveLength(1);
    expect(dpo[0].chosen).toContain('不可延长');
    expect(dpo[0].rejected).toContain('可以延长');
    expect(dpo[0].meta.outcome).toBe('overruled');
    // SFT 里对应的是更正后的正确答案
    expect(sft.find((e) => e.meta.signal === 'corrected')?.messages[1].content).toContain('不可延长');
  });

  it('modified + correctedOutput → 同样产出 SFT + DPO', async () => {
    await seedDecision('modified', {
      outputSummary: '建议全额通过该报销。',
      correctedOutput: '建议通过差旅部分, 招待费需补充审批单。',
    });
    const { dpo, stats } = await buildTrainingDataset({ tenantId: TENANT });
    expect(stats.dpoPairs).toBe(1);
    expect(dpo[0].chosen).toContain('招待费需补充审批单');
  });

  it('overruled 但无 correctedOutput → 跳过 (只知错不知对, 无正样本)', async () => {
    await seedDecision('overruled', { outputSummary: '这个方案没问题。' });
    const { sft, dpo, stats } = await buildTrainingDataset({ tenantId: TENANT });
    expect(sft).toHaveLength(0);
    expect(dpo).toHaveLength(0);
    expect(stats.skippedNoSignal).toBe(1);
  });

  it('pending / ignored → 跳过', async () => {
    await seedDecision('pending');
    await seedDecision('ignored');
    const { sft, stats } = await buildTrainingDataset({ tenantId: TENANT });
    expect(sft).toHaveLength(0);
    expect(stats.skippedPendingOrIgnored).toBe(2);
  });
});

describe('buildTrainingDataset · 隐式默许纪律', () => {
  it('implicit 反馈默认剔除', async () => {
    await seedDecision('adopted', { feedbackSource: 'implicit', outputSummary: '隐式默许的答案内容。' });
    const { sft, stats } = await buildTrainingDataset({ tenantId: TENANT });
    expect(sft).toHaveLength(0);
    expect(stats.skippedImplicit).toBe(1);
  });

  it('includeImplicit=true 时才纳入', async () => {
    await seedDecision('adopted', { feedbackSource: 'implicit', outputSummary: '隐式默许的答案内容。' });
    const { sft } = await buildTrainingDataset({ tenantId: TENANT, includeImplicit: true });
    expect(sft).toHaveLength(1);
  });
});

describe('buildTrainingDataset · 决策防火墙 (reflexion 个人教训)', () => {
  async function seedLesson(body: string): Promise<void> {
    const store = getStore();
    const now = new Date().toISOString();
    const entry: Partial<MemoryEntry> = {
      id: `mem_${Math.random().toString(36).slice(2)}`,
      type: 'lesson',
      kind: 'episodic',
      title: '自省: 账期判断',
      body,
      status: 'active',
      ownershipLevel: 'personal',
      ownerUserId: 'user_alice',
      tags: ['category:judgment'],
      createdAt: now,
      updatedAt: now,
    };
    await store.memories.create(entry as MemoryEntry);
  }

  it('默认不导出个人教训 (组织语料纯净)', async () => {
    await seedLesson('教训: 账期决策要先查授信额度。');
    const { sft, stats } = await buildTrainingDataset({ tenantId: TENANT });
    expect(stats.reflexionLessons).toBe(0);
    expect(sft.every((e) => e.meta.ownershipLevel === 'organizational')).toBe(true);
  });

  it('includeReflexionLessons=true 时导出, 且独立标 personal', async () => {
    await seedLesson('教训: 账期决策要先查授信额度。');
    const { sft, stats } = await buildTrainingDataset({
      tenantId: TENANT,
      includeReflexionLessons: true,
    });
    expect(stats.reflexionLessons).toBe(1);
    const lesson = sft.find((e) => e.meta.source === 'reflexion_lesson');
    expect(lesson).toBeDefined();
    expect(lesson!.meta.ownershipLevel).toBe('personal');
  });
});

describe('JSONL 序列化', () => {
  it('sftToJsonl / dpoToJsonl 每行一条合法 JSON', async () => {
    await seedDecision('adopted', { outputSummary: '这是一个被采纳的组织级答案示例。' });
    await seedDecision('overruled', {
      outputSummary: '这是原本被否的答案。',
      correctedOutput: '这是更正后的正确答案。',
    });
    const { sft, dpo } = await buildTrainingDataset({ tenantId: TENANT });

    const sftLines = sftToJsonl(sft).split('\n');
    expect(sftLines.length).toBe(sft.length);
    for (const line of sftLines) {
      const parsed = JSON.parse(line);
      expect(Array.isArray(parsed.messages)).toBe(true);
    }

    const dpoLines = dpoToJsonl(dpo).split('\n').filter(Boolean);
    expect(dpoLines.length).toBe(dpo.length);
    for (const line of dpoLines) {
      const parsed = JSON.parse(line);
      expect(parsed.chosen).toBeTruthy();
      expect(parsed.rejected).toBeTruthy();
    }
  });
});
