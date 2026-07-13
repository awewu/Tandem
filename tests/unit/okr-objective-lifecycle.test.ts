import { describe, it, expect } from 'vitest';
import {
  canTransition,
  applyTransition,
  availableActions,
  isPreActive,
  STATUS_LABEL,
  TRANSITIONS,
  findLifecycleAction,
  authorizeStatusChange,
} from '@/lib/okr/objective-lifecycle';
import { mapObjectiveStatus, clientObjStatusToServer } from '@/lib/store/okr-sync';
import type { ObjectiveStatus as ServerObjectiveStatus } from '@/lib/types/okr-tti';
import type { ObjectiveStatus } from '@/lib/store/okr';

describe('objective-lifecycle · 审批漏斗状态机', () => {
  it('owner 可从 draft 提交审批, approver 不能提交', () => {
    expect(canTransition('submit', 'draft', 'owner')).toBe(true);
    expect(canTransition('submit', 'draft', 'approver')).toBe(false);
  });

  it('approver 可通过/打回待审批, owner 不能', () => {
    expect(canTransition('approve', 'submitted', 'approver')).toBe(true);
    expect(canTransition('reject', 'submitted', 'approver')).toBe(true);
    expect(canTransition('approve', 'submitted', 'owner')).toBe(false);
    expect(canTransition('reject', 'submitted', 'owner')).toBe(false);
  });

  it('非法来源状态被拒绝 (例如 active 不能再 submit)', () => {
    expect(canTransition('submit', 'active', 'owner')).toBe(false);
    expect(canTransition('approve', 'draft', 'approver')).toBe(false);
  });

  it('approve/reject 落点正确', () => {
    expect(applyTransition('approve')).toBe('active');
    expect(applyTransition('reject')).toBe('draft');
    expect(applyTransition('submit')).toBe('submitted');
  });

  it('archive 可从 draft/active/paused 触发, 不能从 completed', () => {
    expect(canTransition('archive', 'draft', 'owner')).toBe(true);
    expect(canTransition('archive', 'active', 'owner')).toBe(true);
    expect(canTransition('archive', 'paused', 'owner')).toBe(true);
    expect(canTransition('archive', 'completed', 'owner')).toBe(false);
  });

  it('complete 可从 active/paused 触发', () => {
    expect(canTransition('complete', 'active', 'owner')).toBe(true);
    expect(canTransition('complete', 'paused', 'owner')).toBe(true);
    expect(canTransition('complete', 'draft', 'owner')).toBe(false);
  });

  it('active⇄paused 双向', () => {
    expect(canTransition('pause', 'active', 'owner')).toBe(true);
    expect(canTransition('resume', 'paused', 'owner')).toBe(true);
  });

  it('availableActions: submitted 对 approver 给出 approve+reject', () => {
    expect(availableActions('submitted', 'approver').sort()).toEqual(['approve', 'reject']);
  });

  it('availableActions: draft 对 owner 给出 submit+archive', () => {
    expect(availableActions('draft', 'owner').sort()).toEqual(['archive', 'submit']);
  });

  it('isPreActive 仅 draft/submitted 为真', () => {
    expect(isPreActive('draft')).toBe(true);
    expect(isPreActive('submitted')).toBe(true);
    expect(isPreActive('active')).toBe(false);
    expect(isPreActive('completed')).toBe(false);
  });

  it('每个状态都有中文标签', () => {
    const all: ObjectiveStatus[] = ['draft', 'submitted', 'active', 'paused', 'completed', 'archived'];
    for (const s of all) expect(STATUS_LABEL[s]).toBeTruthy();
  });

  it('TRANSITIONS 表自洽: 每条规则 from/to 不同', () => {
    for (const rule of Object.values(TRANSITIONS)) {
      expect(rule.from).not.toBe(rule.to);
      expect(rule.actors.length).toBeGreaterThan(0);
    }
  });
});

describe('objective-lifecycle · findLifecycleAction (from,to 反查动作)', () => {
  it('唯一映射每个合法 (from,to) 对', () => {
    expect(findLifecycleAction('draft', 'submitted')).toBe('submit');
    expect(findLifecycleAction('submitted', 'active')).toBe('approve');
    expect(findLifecycleAction('submitted', 'draft')).toBe('reject');
    expect(findLifecycleAction('active', 'paused')).toBe('pause');
    expect(findLifecycleAction('paused', 'active')).toBe('resume');
    expect(findLifecycleAction('active', 'completed')).toBe('complete');
    expect(findLifecycleAction('paused', 'completed')).toBe('complete');
    expect(findLifecycleAction('active', 'archived')).toBe('archive');
    expect(findLifecycleAction('paused', 'archived')).toBe('archive');
    expect(findLifecycleAction('draft', 'archived')).toBe('archive');
  });

  it('非法 (from,to) 对返回 null', () => {
    expect(findLifecycleAction('draft', 'active')).toBeNull();      // 跳过审批
    expect(findLifecycleAction('completed', 'active')).toBeNull();  // 完成不可复活
    expect(findLifecycleAction('active', 'submitted')).toBeNull();
    expect(findLifecycleAction('active', 'draft')).toBeNull();
    expect(findLifecycleAction('draft', 'draft' as never)).toBeNull();
  });
});

describe('objective-lifecycle · authorizeStatusChange (服务端权威校验)', () => {
  it('owner 提交草稿 → 放行', () => {
    const r = authorizeStatusChange('draft', 'submitted', ['owner']);
    expect(r).toEqual({ ok: true, action: 'submit' });
  });

  it('approver 通过待审批 → 放行', () => {
    const r = authorizeStatusChange('submitted', 'active', ['approver']);
    expect(r).toEqual({ ok: true, action: 'approve' });
  });

  it('仅 owner 身份不能自审通过 (submitted→active) → forbidden', () => {
    expect(authorizeStatusChange('submitted', 'active', ['owner'])).toEqual({
      ok: false, reason: 'forbidden',
    });
  });

  it('owner 直接跳过审批 draft→active → invalid_transition (根治绕过审批漏斗)', () => {
    expect(authorizeStatusChange('draft', 'active', ['owner', 'approver'])).toEqual({
      ok: false, reason: 'invalid_transition',
    });
  });

  it('无任何角色 → forbidden (即便迁移本身合法)', () => {
    expect(authorizeStatusChange('draft', 'submitted', [])).toEqual({
      ok: false, reason: 'forbidden',
    });
  });

  it('owner 同时是 approver 时可通过 (角色取并集)', () => {
    expect(authorizeStatusChange('submitted', 'active', ['owner', 'approver'])).toEqual({
      ok: true, action: 'approve',
    });
  });

  it('垃圾目标状态 → invalid_transition (防注入非法 status)', () => {
    expect(authorizeStatusChange('active', 'hacked' as never, ['owner'])).toEqual({
      ok: false, reason: 'invalid_transition',
    });
  });
});

describe('okr-sync · ObjectiveStatus 同步往返 (回归: draft 不再被丢失)', () => {
  // 服务端 → 客户端: 仅 abandoned 改名, 其余直通
  it('服务端 draft/submitted 正确映射到客户端 (不再被吞成 active)', () => {
    expect(mapObjectiveStatus('draft' as ServerObjectiveStatus)).toBe('draft');
    expect(mapObjectiveStatus('submitted' as ServerObjectiveStatus)).toBe('submitted');
    expect(mapObjectiveStatus('active' as ServerObjectiveStatus)).toBe('active');
    expect(mapObjectiveStatus('abandoned' as ServerObjectiveStatus)).toBe('archived');
  });

  it('客户端 draft/submitted 正确写回服务端 (回归: 不再被强制改成 active)', () => {
    expect(clientObjStatusToServer('draft')).toBe('draft');
    expect(clientObjStatusToServer('submitted')).toBe('submitted');
    expect(clientObjStatusToServer('archived')).toBe('abandoned');
    expect(clientObjStatusToServer('active')).toBe('active');
    expect(clientObjStatusToServer(undefined)).toBe('active');
  });

  it('完整往返保持不变 (draft→server→client 仍是 draft)', () => {
    const roundTrip = (s: ObjectiveStatus) => mapObjectiveStatus(clientObjStatusToServer(s));
    expect(roundTrip('draft')).toBe('draft');
    expect(roundTrip('submitted')).toBe('submitted');
    expect(roundTrip('archived')).toBe('archived');
    expect(roundTrip('active')).toBe('active');
  });
});
