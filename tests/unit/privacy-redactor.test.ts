/**
 * Unit Test · EVO-7 PII Redactor 框架
 *
 * 启用: npm i -D vitest && npx vitest run tests/unit/privacy-redactor
 */

import { describe, it, expect } from 'vitest';
import {
  buildRedactor,
  redactList,
  resolveScope,
  redactFreeText,
} from '@/lib/privacy/redactor';
import {
  redactAuthUser,
  strip1on1ForRequester,
  strip360SubmissionForViewer,
  type RedactableUser,
} from '@/lib/privacy/redactors-domain';

const ctxBase = {
  viewerId: 'alice',
  viewerRoles: ['employee'],
  viewerTenantId: 'tenant-1',
  ownerTenantId: 'tenant-1',
  demo: false,
};

describe('EVO-7 · resolveScope', () => {
  it('viewer 是数据主人之一 → self', () => {
    expect(resolveScope(ctxBase, ['alice', 'bob'])).toBe('self');
  });
  it('viewer 不是主人 + 同租户 + 非 admin → tenant', () => {
    expect(resolveScope(ctxBase, ['bob', 'carol'])).toBe('tenant');
  });
  it('viewer 是 admin → admin (即使非主人)', () => {
    expect(
      resolveScope({ ...ctxBase, viewerRoles: ['admin'] }, ['bob']),
    ).toBe('admin');
  });
  it('viewer 是 steward (HR/数据管家) → admin', () => {
    expect(
      resolveScope({ ...ctxBase, viewerRoles: ['steward'] }, ['bob']),
    ).toBe('admin');
  });
  it("旧 'hr' 字面量已收敛, 不再具特权 → tenant", () => {
    expect(
      resolveScope({ ...ctxBase, viewerRoles: ['hr'] }, ['bob']),
    ).toBe('tenant');
  });
  it('viewer 跨租户 → public', () => {
    expect(
      resolveScope({ ...ctxBase, ownerTenantId: 'tenant-2' }, ['bob']),
    ).toBe('public');
  });
  it('demo 模式 → admin (放宽)', () => {
    expect(resolveScope({ ...ctxBase, demo: true }, ['bob'])).toBe('admin');
  });
});

describe('EVO-7 · redactAuthUser', () => {
  const user: RedactableUser = {
    id: 'bob',
    email: 'bob@corp.com',
    name: '鲍勃',
    roles: ['employee'],
    departmentId: 'dept-tech',
    lastLoginIp: '203.0.113.5',
    lockedUntil: null,
    failedLoginCount: 2,
  };

  it('self scope: 看自己, email 保留, 但 lastLoginIp 永远不暴露给 UI', () => {
    const out = redactAuthUser(user, 'self', ctxBase);
    expect(out.email).toBe('bob@corp.com');
    expect(out.lastLoginIp).toBeNull();
  });

  it('admin scope: 看全, 但 lastLoginIp 也不通过 UI (走审计日志)', () => {
    const out = redactAuthUser(user, 'admin', ctxBase);
    expect(out.email).toBe('bob@corp.com');
    expect(out.lastLoginIp).toBeNull();
  });

  it('tenant scope: 同事看不到 email/IP/锁定状态', () => {
    const out = redactAuthUser(user, 'tenant', ctxBase);
    expect(out.email).toBe('');
    expect(out.lastLoginIp).toBeNull();
    expect(out.lockedUntil).toBeNull();
    expect(out.failedLoginCount).toBeNull();
    expect(out.name).toBe('鲍勃'); // 姓名保留
  });

  it('public scope: 跨租户, 所有敏感字段抹掉', () => {
    const out = redactAuthUser(user, 'public', ctxBase);
    expect(out.email).toBe('');
    expect(out.lastLoginIp).toBeNull();
  });
});

describe('EVO-7 · 1on1 strip 向后兼容', () => {
  const meeting: any = {
    id: 'm1',
    managerId: 'manager-zhang',
    reportId: 'alice',
    privateManagerNote: 'alice 最近压力大',
    moodScore: 3,
    noteProgress: 'OKR Q2 推进良好',
  };

  it('manager 看自己的 1on1: privateManagerNote 保留', () => {
    const out = strip1on1ForRequester(meeting, 'manager-zhang');
    expect(out.privateManagerNote).toBe('alice 最近压力大');
    expect(out.moodScore).toBe(3);
  });

  it('report 员工看自己的 1on1: privateManagerNote / moodScore 抹掉', () => {
    const out = strip1on1ForRequester(meeting, 'alice');
    expect(out.privateManagerNote).toBeNull();
    expect(out.moodScore).toBeNull();
    expect(out.noteProgress).toBe('OKR Q2 推进良好'); // 共享内容仍可见
  });
});

describe('EVO-7 · 360 strip 向后兼容', () => {
  const submission: any = {
    id: 's1',
    cycleId: 'cy1',
    subjectId: 'alice',
    raterId: 'bob',
    raterType: 'peer',
    answers: [],
  };

  it('rater 看自己提交: raterId 保留', () => {
    const out = strip360SubmissionForViewer(
      submission,
      { anonymizePeers: true },
      'bob',
    );
    expect(out.raterId).toBe('bob');
  });

  it('subject 看自己被评 + 匿名开启 + peer: raterId 抹白', () => {
    const out = strip360SubmissionForViewer(
      submission,
      { anonymizePeers: true },
      'alice',
    );
    expect(out.raterId).toBe('anonymous');
  });

  it('匿名关闭: raterId 保留', () => {
    const out = strip360SubmissionForViewer(
      submission,
      { anonymizePeers: false },
      'alice',
    );
    expect(out.raterId).toBe('bob');
  });

  it('manager 类型: 即使匿名开启也保留 raterId (上下级关系明确)', () => {
    const mgr: any = { ...submission, raterType: 'manager', raterId: 'manager-zhang' };
    const out = strip360SubmissionForViewer(
      mgr,
      { anonymizePeers: true },
      'alice',
    );
    expect(out.raterId).toBe('manager-zhang');
  });
});

describe('EVO-7 · redactFreeText 兜底', () => {
  it('抹 email', () => {
    expect(redactFreeText('联系 alice@corp.com 或 bob@x.cn')).toBe(
      '联系 [email] 或 [email]',
    );
  });
  it('抹手机', () => {
    expect(redactFreeText('我的号码 13812345678')).toBe('我的号码 [phone]');
  });
  it('抹身份证', () => {
    expect(redactFreeText('身份证 110101199001011234')).toBe('身份证 [id]');
  });
  it('抹 API key', () => {
    expect(redactFreeText('key=sk-abcDEF1234567890XYZ')).toBe('key=[key]');
  });
  it('混合', () => {
    const out = redactFreeText('a@b.com 13800001111 sk-aaaaaaaaaaaaaaaa');
    expect(out).toBe('[email] [phone] [key]');
  });
  it('null/undefined 透传', () => {
    expect(redactFreeText(null)).toBeNull();
    expect(redactFreeText(undefined)).toBeNull();
  });
});

describe('EVO-7 · buildRedactor + redactList', () => {
  interface Foo {
    id: string;
    secret: string;
    publicField: string;
  }
  const r = buildRedactor<Foo>({
    secret: { hideAt: ['tenant', 'public'], placeholder: '***' },
  });

  it('字段在 hideAt 中: 抹白', () => {
    const out = r({ id: '1', secret: 's', publicField: 'p' }, 'tenant', {
      ...ctxBase,
    });
    expect(out.secret).toBe('***');
    expect(out.publicField).toBe('p');
  });

  it('字段不在 hideAt: 保留 (且返回原对象引用以节省内存)', () => {
    const input = { id: '1', secret: 's', publicField: 'p' };
    const out = r(input, 'self', { ...ctxBase });
    expect(out).toBe(input);
  });

  it('redactList wrapper', () => {
    const list: Foo[] = [
      { id: '1', secret: 'a', publicField: 'x' },
      { id: '2', secret: 'b', publicField: 'y' },
    ];
    const out = redactList(list, r, 'public', { ...ctxBase });
    expect(out.every((o) => o.secret === '***')).toBe(true);
  });
});
