/**
 * deriveActionZone 单元测试 (闸④ C1 · 组织主权内容判定)
 *
 * 核心断言: zone 不只信 caller 声明, 而是 max(声明, 内容) + 委托级别升级。
 */

import { describe, it, expect } from 'vitest';
import { deriveActionZone } from '../../lib/skill-gateway/derive-zone';

describe('deriveActionZone · 声明判定基线', () => {
  it('read_only + 无害内容 → green', () => {
    const r = deriveActionZone({ intent: '总结一下昨天的周报', declaredActionScope: 'read_only' });
    expect(r.zone).toBe('green');
    expect(r.exceedsDelegation).toBe(false);
  });

  it('create_draft + 无害内容 → green', () => {
    const r = deriveActionZone({ intent: '帮我起草一份内部会议纪要草稿', declaredActionScope: 'create_draft' });
    expect(r.zone).toBe('green');
  });

  it('声明 commit → 至少 yellow', () => {
    const r = deriveActionZone({ intent: '更新一下任务状态', declaredActionScope: 'commit' });
    expect(r.zone).toBe('yellow');
  });

  it('声明 send_external → red', () => {
    const r = deriveActionZone({ intent: '随便发点东西', declaredActionScope: 'send_external' });
    expect(r.zone).toBe('red');
  });
});

describe('deriveActionZone · 内容判定升级 (声明说了不算)', () => {
  it('声明 read_only 但内容是"发送给客户报价" → red (内容覆盖声明)', () => {
    const r = deriveActionZone({ intent: '把这份报价发送给客户', declaredActionScope: 'read_only' });
    expect(r.zone).toBe('red');
    expect(r.matchedCategories.some((c) => c.startsWith('red:'))).toBe(true);
  });

  it('声明 read_only 但内容涉及薪资 → red', () => {
    const r = deriveActionZone({ intent: '帮我算一下张三的调薪方案', declaredActionScope: 'read_only' });
    expect(r.zone).toBe('red');
    expect(r.matchedCategories).toContain('red:薪资');
  });

  it('声明 read_only 但内容涉及裁员 → red', () => {
    const r = deriveActionZone({ intent: '起草一份裁员名单建议', declaredActionScope: 'read_only' });
    expect(r.zone).toBe('red');
  });

  it('声明 read_only 但内容是"修改预算" → yellow', () => {
    const r = deriveActionZone({ intent: '帮我修改本季度的预算计划', declaredActionScope: 'read_only' });
    expect(r.zone).toBe('yellow');
    expect(r.matchedCategories.some((c) => c.startsWith('yellow:'))).toBe(true);
  });

  it('普通"回复客户咨询"不应误判为 red (收紧后)', () => {
    const r = deriveActionScopeBenign();
    expect(r.zone).toBe('green');
  });
});

function deriveActionScopeBenign() {
  return deriveActionZone({ intent: '回复客户关于产品功能的咨询问题', declaredActionScope: 'read_only' });
}

describe('deriveActionZone · 委托级别越权升红', () => {
  it('observe_only 的 persona 做 commit → 越权升 red', () => {
    const r = deriveActionZone({
      intent: '更新项目进度数据',
      declaredActionScope: 'commit',
      delegationLevel: 'observe_only',
    });
    expect(r.zone).toBe('red');
    expect(r.exceedsDelegation).toBe(true);
  });

  it('soft_opinion 的 persona 做 commit → 越权升 red', () => {
    const r = deriveActionZone({
      intent: '修改一下排期',
      declaredActionScope: 'commit',
      delegationLevel: 'soft_opinion',
    });
    expect(r.zone).toBe('red');
    expect(r.exceedsDelegation).toBe(true);
  });

  it('commit_short 的 persona 做 commit → 保持 yellow (在授权内)', () => {
    const r = deriveActionZone({
      intent: '更新任务状态',
      declaredActionScope: 'commit',
      delegationLevel: 'commit_short',
    });
    expect(r.zone).toBe('yellow');
    expect(r.exceedsDelegation).toBe(false);
  });

  it('cross_company 的 persona 做 commit → 保持 yellow', () => {
    const r = deriveActionZone({
      intent: '更新跨企业协作任务',
      declaredActionScope: 'commit',
      delegationLevel: 'cross_company',
    });
    expect(r.zone).toBe('yellow');
    expect(r.exceedsDelegation).toBe(false);
  });

  it('green 动作不受委托级别影响 (read_only 即使 observe_only 也 green)', () => {
    const r = deriveActionZone({
      intent: '看一下数据',
      declaredActionScope: 'read_only',
      delegationLevel: 'observe_only',
    });
    expect(r.zone).toBe('green');
    expect(r.exceedsDelegation).toBe(false);
  });
});
