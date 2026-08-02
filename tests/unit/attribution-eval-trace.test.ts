/**
 * tests/unit/attribution-eval-trace.test.ts · #11 归因 pass 进入 eval 台
 *
 * 验证: runAttributionPass 执行后会落一条 kind='attribution' 的 eval trace,
 *       且规则 grader 能给出 budget-sane 评分。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { runAttributionPass } from '@/lib/persona/attribution';

describe('runAttributionPass · eval trace', () => {
  beforeEach(() => {
    setStore(createInMemoryStore());
  });

  it('empty run emits an attribution eval trace', async () => {
    const summary = await runAttributionPass({ tenantId: 'default', windowDays: 30 });
    expect(summary.windowDays).toBe(30);

    const traces = await getStore().evalTraces.list();
    expect(traces).toHaveLength(1);
    const trace = traces[0];
    expect(trace.kind).toBe('attribution');
    expect(trace.tenantId).toBe('default');
    expect(trace.actorUserId).toBe('__company__');
    expect(trace.finalOutputSummary).toContain('"samples"');
    const budgetGrade = trace.grades?.find((g) => g.graderId === 'budget-sane');
    expect(budgetGrade).toBeDefined();
    expect(budgetGrade?.pass).toBe(true);
  });
});
