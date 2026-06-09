/**
 * tests/unit/company-brain-perception-cache.test.ts · S2 感知短 TTL 缓存锁
 *
 * 验证 companyBrainPerceptionPass 的 45s LRU 缓存: 相近追问命中缓存跳过 ~4s tool-loop,
 * 但 (a) 不同 query 重跑 (b) clearPerceptionCache 失效 (c) 失败感知不入缓存
 * (d) 命中时 dataBlock 拼回**当前** baseSystemPrompt (而非缓存旧 base)。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ runToolLoop: vi.fn() }));

vi.mock('@/lib/agent-runtime/tool-loop', () => ({
  runToolLoop: h.runToolLoop,
}));

import {
  companyBrainPerceptionPass,
  clearPerceptionCache,
} from '@/lib/persona/company-brain-perception';

const OKR_QUERY = '公司 OKR 进度怎么样';
const BASE = '你是中央 AI 基线 prompt';

function okLoop() {
  return {
    toolInvocations: [{ name: 'okr.read', ok: true, result: 'O1/KR1 进度 80%' }],
    roundsExecuted: 1,
  };
}

beforeEach(() => {
  clearPerceptionCache();
  h.runToolLoop.mockReset();
  h.runToolLoop.mockResolvedValue(okLoop());
});

describe('S2 · 感知短 TTL 缓存', () => {
  it('同一 query 第二次命中缓存, 不重跑 tool-loop', async () => {
    const r1 = await companyBrainPerceptionPass(OKR_QUERY, BASE);
    expect(r1.perceived).toBe(true);
    expect(h.runToolLoop).toHaveBeenCalledTimes(1);

    const r2 = await companyBrainPerceptionPass(OKR_QUERY, BASE);
    expect(r2.perceived).toBe(true);
    expect(h.runToolLoop).toHaveBeenCalledTimes(1); // 仍是 1 = 命中缓存
    expect(r2.log.triggerReason).toContain('cached');
    expect(r2.revisedSystemPrompt).toContain('O1/KR1 进度 80%');
  });

  it('归一化命中: 大小写/空白差异视为同一 query', async () => {
    await companyBrainPerceptionPass(OKR_QUERY, BASE);
    const r2 = await companyBrainPerceptionPass(`  ${OKR_QUERY}  `, BASE);
    expect(h.runToolLoop).toHaveBeenCalledTimes(1);
    expect(r2.log.triggerReason).toContain('cached');
  });

  it('不同 query 重跑 tool-loop', async () => {
    await companyBrainPerceptionPass(OKR_QUERY, BASE);
    await companyBrainPerceptionPass('部门决议落地情况如何', BASE);
    expect(h.runToolLoop).toHaveBeenCalledTimes(2);
  });

  it('命中时 dataBlock 拼回当前 baseSystemPrompt (非缓存旧 base)', async () => {
    await companyBrainPerceptionPass(OKR_QUERY, BASE);
    const r2 = await companyBrainPerceptionPass(OKR_QUERY, '全新的 base prompt XYZ');
    expect(r2.revisedSystemPrompt.startsWith('全新的 base prompt XYZ')).toBe(true);
    expect(r2.revisedSystemPrompt).toContain('O1/KR1 进度 80%');
  });

  it('clearPerceptionCache 后失效, 重新跑 tool-loop', async () => {
    await companyBrainPerceptionPass(OKR_QUERY, BASE);
    clearPerceptionCache();
    await companyBrainPerceptionPass(OKR_QUERY, BASE);
    expect(h.runToolLoop).toHaveBeenCalledTimes(2);
  });

  it('失败感知 (0 工具结果) 不入缓存', async () => {
    h.runToolLoop.mockResolvedValue({ toolInvocations: [], roundsExecuted: 1 });
    const r1 = await companyBrainPerceptionPass(OKR_QUERY, BASE);
    expect(r1.perceived).toBe(false);
    await companyBrainPerceptionPass(OKR_QUERY, BASE);
    expect(h.runToolLoop).toHaveBeenCalledTimes(2); // 未缓存 → 重跑
  });

  it('非内部数据 query 不触发感知 (gate 拦截), 不跑 tool-loop', async () => {
    const r = await companyBrainPerceptionPass('今天天气真好', BASE);
    expect(r.perceived).toBe(false);
    expect(h.runToolLoop).not.toHaveBeenCalled();
  });
});
