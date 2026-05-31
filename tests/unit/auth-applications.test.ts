/**
 * AuthApplications · 外部人员注册申请审批流测试
 *
 * 覆盖:
 *   - 提交校验 (邮箱/姓名/理由长度)
 *   - 重复 pending 阻塞
 *   - 已是用户阻塞
 *   - approve → 生成单次邀请码 + 状态推进
 *   - reject → 状态推进
 *   - 重复审批阻塞
 *   - 列表过滤
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  submitApplication,
  approveApplication,
  rejectApplication,
  listApplications,
  ApplicationError,
} from '@/lib/auth/applications';

beforeAll(() => setStore(createInMemoryStore()));

beforeEach(() => setStore(createInMemoryStore()));

const VALID_REASON = '我司是 Tandem 长期合作的渠道伙伴, 需要进入文档协作通道完成 Q3 产品对接.';

describe('submitApplication', () => {
  it('成功提交, 状态 pending, 写入 IP/UA', async () => {
    const app = await submitApplication({
      email: 'partner@external.io',
      name: '张三',
      reason: VALID_REASON,
      organization: 'External Co.',
      deviceInfo: { ip: '203.0.113.1', userAgent: 'TestUA/1.0' },
    });
    expect(app.status).toBe('pending');
    expect(app.email).toBe('partner@external.io');
    expect(app.ip).toBe('203.0.113.1');
    expect(app.userAgent).toBe('TestUA/1.0');
    expect(app.tenantId).toBe('default');
  });

  it('拒绝邮箱格式错误', async () => {
    await expect(
      submitApplication({ email: 'not-an-email', name: '张', reason: VALID_REASON }),
    ).rejects.toBeInstanceOf(ApplicationError);
  });

  it('拒绝姓名为空', async () => {
    await expect(
      submitApplication({ email: 'a@b.io', name: '   ', reason: VALID_REASON }),
    ).rejects.toMatchObject({ code: 'name_required' });
  });

  it('拒绝过短理由', async () => {
    await expect(
      submitApplication({ email: 'a@b.io', name: '张', reason: '太短' }),
    ).rejects.toMatchObject({ code: 'reason_too_short' });
  });

  it('拒绝过长理由', async () => {
    await expect(
      submitApplication({ email: 'a@b.io', name: '张', reason: 'x'.repeat(2000) }),
    ).rejects.toMatchObject({ code: 'reason_too_long' });
  });

  it('阻塞重复 pending 申请', async () => {
    await submitApplication({ email: 'dup@x.io', name: '张', reason: VALID_REASON });
    await expect(
      submitApplication({ email: 'dup@x.io', name: '张', reason: VALID_REASON }),
    ).rejects.toMatchObject({ code: 'duplicate_pending' });
  });

  it('阻塞已是 Tandem 用户的邮箱', async () => {
    const store = getStore();
    await store.auth.users.create({
      email: 'member@x.io',
      name: '老用户',
      roles: ['employee'],
      tenantId: 'default',
    });
    await expect(
      submitApplication({ email: 'member@x.io', name: '张', reason: VALID_REASON }),
    ).rejects.toMatchObject({ code: 'already_member' });
  });
});

describe('approveApplication', () => {
  it('通过审批 → 生成 invite (与邮箱绑定, 1 次, 默认 guest 角色)', async () => {
    const app = await submitApplication({
      email: 'p@e.io',
      name: '李',
      reason: VALID_REASON,
    });
    const result = await approveApplication({
      applicationId: app.id,
      approverId: 'admin-1',
    });
    expect(result.application.status).toBe('approved');
    expect(result.application.grantedRoles).toEqual(['guest']);
    expect(result.inviteCode).toMatch(/^[A-Z0-9-]+$/);
    expect(new Date(result.inviteExpiresAt).getTime()).toBeGreaterThan(Date.now());

    // 验证 invite 已存在 store 且与邮箱绑定
    const store = getStore();
    const all = await store.auth.invites.list({ invitedById: 'admin-1' });
    expect(all).toHaveLength(1);
    expect(all[0].email).toBe('p@e.io');
    expect(all[0].maxUses).toBe(1);
    expect(all[0].presetRoles).toEqual(['guest']);
  });

  it('支持自定义 grantedRoles', async () => {
    const app = await submitApplication({
      email: 'p2@e.io',
      name: '王',
      reason: VALID_REASON,
    });
    const result = await approveApplication({
      applicationId: app.id,
      approverId: 'admin-1',
      grantedRoles: ['partner', 'contractor'],
    });
    expect(result.application.grantedRoles).toEqual(['partner', 'contractor']);
  });

  it('拒绝重复审批', async () => {
    const app = await submitApplication({
      email: 'p3@e.io',
      name: '钱',
      reason: VALID_REASON,
    });
    await approveApplication({ applicationId: app.id, approverId: 'admin-1' });
    await expect(
      approveApplication({ applicationId: app.id, approverId: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'not_pending' });
  });

  it('应用不存在 → 404', async () => {
    await expect(
      approveApplication({ applicationId: 'nope', approverId: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'not_found', httpStatus: 404 });
  });
});

describe('rejectApplication', () => {
  it('拒绝 → 状态 rejected, 不生成 invite', async () => {
    const app = await submitApplication({
      email: 'r@e.io',
      name: '赵',
      reason: VALID_REASON,
    });
    const updated = await rejectApplication({
      applicationId: app.id,
      approverId: 'admin-1',
      decisionNote: '信息不充分',
    });
    expect(updated.status).toBe('rejected');
    expect(updated.decisionNote).toBe('信息不充分');

    const store = getStore();
    const invites = await store.auth.invites.list();
    expect(invites).toHaveLength(0);
  });

  it('拒绝后无法再 approve', async () => {
    const app = await submitApplication({
      email: 'r2@e.io',
      name: '孙',
      reason: VALID_REASON,
    });
    await rejectApplication({ applicationId: app.id, approverId: 'admin-1' });
    await expect(
      approveApplication({ applicationId: app.id, approverId: 'admin-1' }),
    ).rejects.toMatchObject({ code: 'not_pending' });
  });
});

describe('listApplications', () => {
  it('按 status 过滤 + 按 createdAt 倒序', async () => {
    const a = await submitApplication({ email: 'a@e.io', name: 'A', reason: VALID_REASON });
    await new Promise((r) => setTimeout(r, 5));
    const b = await submitApplication({ email: 'b@e.io', name: 'B', reason: VALID_REASON });
    await rejectApplication({ applicationId: a.id, approverId: 'admin-1' });

    const pending = await listApplications({ status: 'pending' });
    expect(pending.map((x) => x.email)).toEqual(['b@e.io']);

    const rejected = await listApplications({ status: 'rejected' });
    expect(rejected.map((x) => x.email)).toEqual(['a@e.io']);

    const all = await listApplications();
    // 倒序 (b 后提交)
    expect(all[0].email).toBe('b@e.io');
    expect(all).toHaveLength(2);
  });
});
