/**
 * tests/unit/daily-focus.test.ts
 *
 * 锁 lib/persona/daily-focus.ts 纯函数 buildDailyFocus:
 *   - 空信号 → 0 项 + 无下一步 + 友好摘要
 *   - OKR 高风险信号 → actNow + okr_risk, 下一步为复盘
 *   - 逾期行动项 (:initiative:) → overdue_action + actNow
 *   - 否决窗 <12h → actNow/medium; >12h → low/非 actNow; 已过窗 → 丢弃
 *   - 只取本人为主体的风险信号 (subjectUserId 过滤)
 *   - 排序: actNow 优先 → severity 高优先
 *   - MAX_ITEMS 截断
 *   - markdown 分"需立即处理 / 其余关注"两段, 含 severity 标签
 */

import { describe, expect, it } from 'vitest';

import { buildDailyFocus, type DailyFocusInput } from '@/lib/persona/daily-focus';
import type { WorkRiskSignal, WorkRiskSeverity } from '@/lib/work-risk/types';

const NOW = 1_000_000_000_000;
const HOUR = 60 * 60 * 1000;

function riskSignal(p: Partial<WorkRiskSignal> & { id: string }): WorkRiskSignal {
  return {
    source: 'okr',
    subjectUserId: 'u1',
    subjectName: 'A',
    severity: 'medium' as WorkRiskSeverity,
    title: '风险信号',
    detail: '细节',
    evidence: { visibility: 'full', label: 'OKR' },
    ...p,
  };
}

function baseInput(p: Partial<DailyFocusInput> = {}): DailyFocusInput {
  return {
    userId: 'u1',
    now: NOW,
    riskSignals: [],
    vetoClosing: [],
    pendingSignatures: [],
    ttiInProgress: [],
    personaUpgrade: null,
    ...p,
  };
}

describe('buildDailyFocus', () => {
  it('空信号 → 0 项, 无下一步, 友好摘要', () => {
    const f = buildDailyFocus(baseInput());
    expect(f.itemCount).toBe(0);
    expect(f.actNowCount).toBe(0);
    expect(f.suggestedNextStep).toBeNull();
    expect(f.headline).toContain('没有需要立即处理');
    expect(f.markdown).toContain('今日聚焦');
  });

  it('OKR 高风险 → actNow + okr_risk, 下一步为复盘', () => {
    const f = buildDailyFocus(
      baseInput({
        riskSignals: [
          riskSignal({ id: 'okr:objective:o1', severity: 'high', title: '季度营收目标' }),
        ],
      }),
    );
    expect(f.itemCount).toBe(1);
    expect(f.items[0].kind).toBe('okr_risk');
    expect(f.items[0].actNow).toBe(true);
    expect(f.highCount).toBe(1);
    expect(f.suggestedNextStep).toContain('复盘');
    expect(f.headline).toContain('高风险');
  });

  it('逾期行动项 (:initiative:) → overdue_action + actNow', () => {
    const f = buildDailyFocus(
      baseInput({
        riskSignals: [
          riskSignal({ id: 'okr:initiative:i1', severity: 'medium', title: '交付里程碑' }),
        ],
      }),
    );
    expect(f.items[0].kind).toBe('overdue_action');
    expect(f.items[0].actNow).toBe(true);
  });

  it('否决窗 <12h → actNow/medium; >12h → low/非 actNow; 已过窗 → 丢弃', () => {
    const closing = buildDailyFocus(
      baseInput({ vetoClosing: [{ id: 'd1', title: '决议1', committedAtMs: NOW - 20 * HOUR }] }),
    );
    expect(closing.items[0].actNow).toBe(true);
    expect(closing.items[0].severity).toBe('medium');

    const fresh = buildDailyFocus(
      baseInput({ vetoClosing: [{ id: 'd2', title: '决议2', committedAtMs: NOW - 2 * HOUR }] }),
    );
    expect(fresh.items[0].actNow).toBe(false);
    expect(fresh.items[0].severity).toBe('low');

    const expired = buildDailyFocus(
      baseInput({ vetoClosing: [{ id: 'd3', title: '决议3', committedAtMs: NOW - 30 * HOUR }] }),
    );
    expect(expired.itemCount).toBe(0);
  });

  it('只取本人为主体的风险信号', () => {
    const f = buildDailyFocus(
      baseInput({
        riskSignals: [
          riskSignal({ id: 'okr:objective:o1', subjectUserId: 'u1' }),
          riskSignal({ id: 'okr:objective:o2', subjectUserId: 'other' }),
        ],
      }),
    );
    expect(f.itemCount).toBe(1);
    expect(f.items[0].id).toContain('o1');
  });

  it('排序: actNow 优先 → severity 高优先', () => {
    const f = buildDailyFocus(
      baseInput({
        riskSignals: [
          riskSignal({ id: 'okr:objective:low', severity: 'low', title: '低' }),
          riskSignal({ id: 'okr:objective:high', severity: 'high', title: '高' }),
        ],
        ttiInProgress: [{ id: 't1', title: 'TTI', completionRate: 0.5 }],
      }),
    );
    // 高风险 actNow 在最前, TTI (low, 非 actNow) 在后
    expect(f.items[0].title).toBe('高');
    expect(f.items[f.items.length - 1].kind).toBe('tti_advance');
  });

  it('待签字: 超 SLA → high/actNow; SLA 充裕 → medium/actNow(24h内); 无 SLA → medium/非 actNow', () => {
    const overdue = buildDailyFocus(
      baseInput({
        pendingSignatures: [
          { id: 'p1', title: '红线 SOP', level: 'company', pendingRoles: ['ceo'], slaDeadlineMs: NOW - HOUR },
        ],
      }),
    );
    expect(overdue.items[0].kind).toBe('signature_pending');
    expect(overdue.items[0].severity).toBe('high');
    expect(overdue.items[0].actNow).toBe(true);
    expect(overdue.suggestedNextStep).toContain('签');

    const soon = buildDailyFocus(
      baseInput({
        pendingSignatures: [
          { id: 'p2', title: '案例', level: 'team', pendingRoles: ['team_leader'], slaDeadlineMs: NOW + 10 * HOUR },
        ],
      }),
    );
    expect(soon.items[0].severity).toBe('medium');
    expect(soon.items[0].actNow).toBe(true);

    const noSla = buildDailyFocus(
      baseInput({
        pendingSignatures: [
          { id: 'p3', title: '无SLA', level: 'dept', pendingRoles: ['dept_leader'], slaDeadlineMs: null },
        ],
      }),
    );
    expect(noSla.items[0].severity).toBe('medium');
    expect(noSla.items[0].actNow).toBe(false);
  });

  it('分身升阶 → persona_upgrade 低优先项', () => {
    const f = buildDailyFocus(
      baseInput({ personaUpgrade: { fromStage: 'egg', toStage: 'lv1' } }),
    );
    expect(f.items.some((i) => i.kind === 'persona_upgrade')).toBe(true);
  });

  it('MAX_ITEMS 截断为 8', () => {
    const many = Array.from({ length: 12 }, (_, n) =>
      riskSignal({ id: `okr:objective:o${n}`, severity: 'low', title: `O${n}` }),
    );
    const f = buildDailyFocus(baseInput({ riskSignals: many }));
    expect(f.itemCount).toBe(12);
    expect(f.items.length).toBe(8);
  });

  it('markdown 分段 + severity 标签', () => {
    const f = buildDailyFocus(
      baseInput({
        riskSignals: [riskSignal({ id: 'okr:objective:o1', severity: 'high', title: '高风险目标' })],
        ttiInProgress: [{ id: 't1', title: '成长目标', completionRate: 0.4 }],
      }),
    );
    expect(f.markdown).toContain('## 需立即处理');
    expect(f.markdown).toContain('## 其余关注');
    expect(f.markdown).toContain('[高]');
    expect(f.markdown).toContain('[低]');
    expect(f.markdown).toContain('建议下一步');
  });
});
