/**
 * D-02 · 多维表格 AI 列 compute 单测
 *
 * 验证:
 *   1. 占位符 {{字段名}} 正确替换为本行字段值
 *   2. 只计算 ai_compute 列, 不动 text/number
 *   3. 写回 row.data[colId] 是 BitableAiCellValue (__ai=true, status, value, model)
 *   4. LLM 抛错 → status='error' 不阻断其它列
 *   5. onlyColIds 子集过滤
 *   6. 多列并发完成后所有结果都写回 (race condition 测试)
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { computeAiCellsForRow } from '@/lib/services/bitable-ai-compute';
import { isAiCellValue } from '@/lib/types/bitable';
import type { TandemRouter } from '@/lib/taf/router';
import type { ChatRequest, ChatResponse } from '@/lib/taf/provider/types';
import type { BitableTable, BitableColumn } from '@/lib/types/bitable';

beforeAll(() => {
  setStore(createInMemoryStore());
});

beforeEach(async () => {
  const store = getStore();
  for (const t of await store.bitableTables.list()) await store.bitableTables.delete(t.id);
});

function makeRouter(impl: (prompt: string) => string | Promise<string>): Pick<TandemRouter, 'chat'> {
  const chat = async (req: ChatRequest): Promise<ChatResponse> => {
    const userMsg = req.messages.find((m) => m.role === 'user')?.content ?? '';
    const text = await impl(typeof userMsg === 'string' ? userMsg : '');
    return {
      id: 't1',
      message: { role: 'assistant', content: text },
      finishReason: 'stop',
      model: 'mock-fast-v1',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    };
  };
  return { chat: vi.fn(chat) };
}

async function seedTable(cols: BitableColumn[], rowData: Record<string, unknown>): Promise<BitableTable> {
  const now = new Date().toISOString();
  const store = getStore();
  return await store.bitableTables.create({
    name: 'T',
    ownerId: 'u1',
    tenantId: 'default',
    columns: cols,
    rows: [{ id: 'row1', data: rowData, createdAt: now, updatedAt: now }],
    createdAt: now,
    updatedAt: now,
  });
}

const COLS: BitableColumn[] = [
  { id: 'c_name', name: '姓名', type: 'text' },
  { id: 'c_kr', name: 'KR', type: 'text' },
  { id: 'c_cur', name: '当前值', type: 'number' },
  { id: 'c_target', name: '目标值', type: 'number' },
  {
    id: 'c_eval',
    name: '进展评估',
    type: 'ai_compute',
    aiPrompt: '员工 {{姓名}} 的 {{KR}} 进展: 当前 {{当前值}}, 目标 {{目标值}}. 1 句评估.',
  },
];

describe('computeAiCellsForRow', () => {
  it('替换占位符 + 写回 ai_compute 列 + status=ok', async () => {
    const router = makeRouter((prompt) => {
      expect(prompt).toContain('员工 张三');
      expect(prompt).toContain('提升 LTV');
      expect(prompt).toContain('当前 60');
      expect(prompt).toContain('目标 100');
      return '进展达 60%, 与时间过半符合, 风险偏低.';
    });

    const t = await seedTable(COLS, {
      c_name: '张三',
      c_kr: '提升 LTV',
      c_cur: 60,
      c_target: 100,
    });

    const result = await computeAiCellsForRow(t.id, 'row1', undefined, 'u1', router);
    expect(result).toMatchObject({ computed: 1, ok: 1, failed: 0 });

    const fresh = await getStore().bitableTables.get(t.id);
    const cell = fresh!.rows[0].data['c_eval'];
    expect(isAiCellValue(cell)).toBe(true);
    if (isAiCellValue(cell)) {
      expect(cell.status).toBe('ok');
      expect(cell.value).toContain('进展达 60%');
      expect(cell.model).toBe('mock-fast-v1');
      expect(cell.computedAt).toBeTruthy();
    }
  });

  it('非 ai_compute 列原值不动', async () => {
    const router = makeRouter(() => 'ok');
    const t = await seedTable(COLS, {
      c_name: '李四',
      c_kr: 'NPS',
      c_cur: 30,
      c_target: 50,
    });
    await computeAiCellsForRow(t.id, 'row1', undefined, 'u1', router);
    const fresh = await getStore().bitableTables.get(t.id);
    expect(fresh!.rows[0].data['c_name']).toBe('李四');
    expect(fresh!.rows[0].data['c_cur']).toBe(30);
  });

  it('LLM 抛错 → cell.status=error, 不抛, 不阻断其它', async () => {
    const router = makeRouter((p) => {
      if (p.includes('crash')) throw new Error('rate-limited');
      return 'fine';
    });
    const cols: BitableColumn[] = [
      { id: 'c_a', name: 'a', type: 'text' },
      { id: 'c_ai1', name: 'eval1', type: 'ai_compute', aiPrompt: 'go {{a}} crash' },
      { id: 'c_ai2', name: 'eval2', type: 'ai_compute', aiPrompt: 'go {{a}} all good' },
    ];
    const t = await seedTable(cols, { c_a: 'x' });
    const result = await computeAiCellsForRow(t.id, 'row1', undefined, 'u1', router);
    expect(result.computed).toBe(2);
    expect(result.ok).toBe(1);
    expect(result.failed).toBe(1);

    const fresh = await getStore().bitableTables.get(t.id);
    const c1 = fresh!.rows[0].data['c_ai1'];
    const c2 = fresh!.rows[0].data['c_ai2'];
    expect(isAiCellValue(c1) && c1.status).toBe('error');
    expect(isAiCellValue(c2) && c2.status).toBe('ok');
    if (isAiCellValue(c1)) expect(c1.error).toContain('rate-limited');
  });

  it('onlyColIds 子集 → 不在集合内的 ai 列不计算', async () => {
    const router = makeRouter(() => 'computed');
    const cols: BitableColumn[] = [
      { id: 'c_a', name: 'a', type: 'text' },
      { id: 'c_x', name: 'x', type: 'ai_compute', aiPrompt: '{{a}} x' },
      { id: 'c_y', name: 'y', type: 'ai_compute', aiPrompt: '{{a}} y' },
    ];
    const t = await seedTable(cols, { c_a: 'hi' });
    const result = await computeAiCellsForRow(t.id, 'row1', ['c_x'], 'u1', router);
    expect(result.computed).toBe(1);
    expect(result.cells.map((c) => c.colId)).toEqual(['c_x']);

    const fresh = await getStore().bitableTables.get(t.id);
    expect(isAiCellValue(fresh!.rows[0].data['c_x'])).toBe(true);
    expect(fresh!.rows[0].data['c_y']).toBeUndefined();
  });

  it('无 ai 列 → computed=0, 不调 LLM', async () => {
    const chat = vi.fn();
    const router = { chat } as unknown as Pick<TandemRouter, 'chat'>;
    const t = await seedTable(
      [{ id: 'c_a', name: 'a', type: 'text' }],
      { c_a: 'plain' },
    );
    const result = await computeAiCellsForRow(t.id, 'row1', undefined, 'u1', router);
    expect(result.computed).toBe(0);
    expect(chat).not.toHaveBeenCalled();
  });

  it('row 不存在 → 抛 row not found', async () => {
    const router = makeRouter(() => 'never');
    const t = await seedTable(COLS, { c_name: 'x' });
    await expect(
      computeAiCellsForRow(t.id, 'no-such-row', undefined, 'u1', router),
    ).rejects.toThrow(/row not found/);
  });
});
