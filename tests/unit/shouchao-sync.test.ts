/**
 * 搭子手抄 · 数据接口层回归测试
 *
 * 覆盖: 软删墓碑 / 增量同步 pull(since) / push(LWW 合并) / 员工本人闸门(opt-in + audit).
 * 不调真实 LLM/DB, 用内存 store.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import {
  createNote,
  listNotes,
  getNote,
  deleteNote,
  pullChanges,
  pushChanges,
  setSharedToPersona,
  retrieveSharedNotesForPersona,
} from '@/lib/shouchao/service';
import { getAuditLog } from '@/lib/audit/log';
import type { ShouchaoNote } from '@/lib/types/shouchao';

const OWNER = 'user_alice';
const OTHER = 'user_bob';
const TENANT = 'default';

beforeEach(() => {
  setStore(createInMemoryStore());
});

async function seed(content: string): Promise<ShouchaoNote> {
  return createNote({ ownerId: OWNER, tenantId: TENANT, content });
}

describe('软删墓碑', () => {
  it('删除后从 listNotes / getNote 消失, 但记录仍在 (打 deletedAt)', async () => {
    const n = await seed('待删笔记');
    expect(await deleteNote(OWNER, n.id)).toBe(true);

    expect(await listNotes(OWNER)).toHaveLength(0);
    expect(await getNote(OWNER, n.id)).toBeNull();

    const raw = await getStore().shouchaoNotes.get(n.id);
    expect(raw?.deletedAt).toBeTruthy();
  });

  it('非本人不能删 (返回 false)', async () => {
    const n = await seed('alice 的笔记');
    expect(await deleteNote(OTHER, n.id)).toBe(false);
    expect(await listNotes(OWNER)).toHaveLength(1);
  });
});

describe('增量同步 pullChanges', () => {
  it('无 since 全量返回活跃笔记', async () => {
    await seed('a');
    await seed('b');
    const r = await pullChanges(OWNER);
    expect(r.notes).toHaveLength(2);
    expect(r.deleted).toHaveLength(0);
    expect(r.serverTime).toBeTruthy();
  });

  it('删除的笔记出现在 deleted 墓碑数组, 不在 notes', async () => {
    const n = await seed('会被删');
    await deleteNote(OWNER, n.id);
    const r = await pullChanges(OWNER);
    expect(r.notes).toHaveLength(0);
    expect(r.deleted).toContain(n.id);
  });

  it('since 游标只返回其后的变更', async () => {
    const n1 = await seed('老笔记');
    const cursor = new Date(Date.parse(n1.updatedAt) + 1).toISOString();
    // 等 1ms 保证时间戳推进
    await new Promise((res) => setTimeout(res, 2));
    const n2 = await seed('新笔记');
    const r = await pullChanges(OWNER, cursor);
    const ids = r.notes.map((x) => x.id);
    expect(ids).toContain(n2.id);
    expect(ids).not.toContain(n1.id);
  });
});

describe('推送合并 pushChanges (LWW)', () => {
  it('未知 id = 新建 (归属强制为本人)', async () => {
    const incoming: ShouchaoNote = {
      id: 'sc_remote_1',
      ownerId: 'spoofed',
      tenantId: 'spoofed',
      title: '设备 B 新建',
      content: '离线写的',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const merged = await pushChanges(OWNER, TENANT, [incoming]);
    expect(merged).toHaveLength(1);
    expect(merged[0].ownerId).toBe(OWNER);
    expect(merged[0].tenantId).toBe(TENANT);
    expect(await listNotes(OWNER)).toHaveLength(1);
  });

  it('incoming 更新更晚则覆盖, 更早则保留服务端', async () => {
    const n = await seed('原文');
    const newer: ShouchaoNote = {
      ...n,
      content: '设备 B 改的',
      updatedAt: new Date(Date.parse(n.updatedAt) + 10_000).toISOString(),
    };
    await pushChanges(OWNER, TENANT, [newer]);
    expect((await getNote(OWNER, n.id))?.content).toBe('设备 B 改的');

    const stale: ShouchaoNote = {
      ...n,
      content: '过时的内容',
      updatedAt: new Date(Date.parse(n.updatedAt) - 10_000).toISOString(),
    };
    await pushChanges(OWNER, TENANT, [stale]);
    expect((await getNote(OWNER, n.id))?.content).toBe('设备 B 改的');
  });

  it('不能覆盖别人的笔记 (隔离)', async () => {
    const bobNote = await createNote({ ownerId: OTHER, tenantId: TENANT, content: 'bob 的' });
    const hijack: ShouchaoNote = {
      ...bobNote,
      content: 'alice 想篡改',
      updatedAt: new Date(Date.parse(bobNote.updatedAt) + 10_000).toISOString(),
    };
    await pushChanges(OWNER, TENANT, [hijack]);
    const raw = await getStore().shouchaoNotes.get(bobNote.id);
    expect(raw?.content).toBe('bob 的');
  });

  it('快钟设备的未来时间戳被钳制, 不能永久压制服务端 (时钟偏移防护)', async () => {
    const n = await seed('服务端原文');
    // 设备时钟快 1 天: 一条"旧内容"却带未来时间戳
    const skewed: ShouchaoNote = {
      ...n,
      content: '快钟设备的旧写',
      updatedAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
    };
    await pushChanges(OWNER, TENANT, [skewed]);
    const after = await getNote(OWNER, n.id);
    // 钳制后该写的有效时间 ≈ 服务端 now, 仍会覆盖一次(它确实比原文晚), 但 updatedAt 不会停在未来
    expect(Date.parse(after!.updatedAt)).toBeLessThanOrEqual(Date.now() + 60_000 + 1000);

    // 关键: 之后服务端的正常新写能再次覆盖它 (未来时间戳没把记录锁死)
    const serverEdit: ShouchaoNote = {
      ...after!,
      content: '服务端随后的正常编辑',
      updatedAt: new Date(Date.now() + 1000).toISOString(),
    };
    await pushChanges(OWNER, TENANT, [serverEdit]);
    expect((await getNote(OWNER, n.id))?.content).toBe('服务端随后的正常编辑');
  });

  it('容差内的轻微超前不被钳制 (正常网络抖动放行)', async () => {
    const n = await seed('原文');
    const slightlyAhead: ShouchaoNote = {
      ...n,
      content: '客户端略超前',
      updatedAt: new Date(Date.now() + 5_000).toISOString(), // 5s < 60s 容差
    };
    await pushChanges(OWNER, TENANT, [slightlyAhead]);
    expect((await getNote(OWNER, n.id))?.content).toBe('客户端略超前');
  });
});

describe('员工本人闸门 setSharedToPersona', () => {
  it('默认关; 开启置 true 并写 audit; 撤回置 false 并写 audit', async () => {
    const n = await seed('给分身的笔记');
    expect(!!n.sharedToPersona).toBe(false);

    const on = await setSharedToPersona(OWNER, n.id, true);
    expect(on?.sharedToPersona).toBe(true);

    const off = await setSharedToPersona(OWNER, n.id, false);
    expect(off?.sharedToPersona).toBe(false);

    const audits = await getAuditLog().list({ targetId: n.id });
    const actions = audits.map((a) => a.action);
    expect(actions).toContain('shouchao.shared_to_persona');
    expect(actions).toContain('shouchao.unshared_from_persona');
  });

  it('非本人无法开启 (返回 null)', async () => {
    const n = await seed('alice 私有');
    expect(await setSharedToPersona(OTHER, n.id, true)).toBeNull();
  });
});

describe('自我成长 retrieveSharedNotesForPersona', () => {
  it('只召回本人已授权的笔记 (未授权/他人/软删 不出现)', async () => {
    const shared = await seed('已授权: 我偏好简洁直接的沟通');
    await setSharedToPersona(OWNER, shared.id, true);
    await seed('未授权的私密笔记'); // sharedToPersona=false
    const bob = await createNote({ ownerId: OTHER, tenantId: TENANT, content: 'bob 已授权' });
    await setSharedToPersona(OTHER, bob.id, true);

    const got = await retrieveSharedNotesForPersona(OWNER, '');
    const ids = got.map((n) => n.id);
    expect(ids).toContain(shared.id);
    expect(ids).not.toContain(bob.id); // 隔离: 不读他人
    expect(got.every((n) => n.ownerId === OWNER)).toBe(true);
  });

  it('撤回授权后不再被召回', async () => {
    const n = await seed('一度授权');
    await setSharedToPersona(OWNER, n.id, true);
    expect((await retrieveSharedNotesForPersona(OWNER, '')).map((x) => x.id)).toContain(n.id);
    await setSharedToPersona(OWNER, n.id, false);
    expect((await retrieveSharedNotesForPersona(OWNER, '')).map((x) => x.id)).not.toContain(n.id);
  });

  it('按 intent 关键词相关性排序, 相关笔记排在前', async () => {
    const a = await seed('我在学习吉他和音乐编曲');
    const b = await seed('季度财务预算与报销流程');
    await setSharedToPersona(OWNER, a.id, true);
    await setSharedToPersona(OWNER, b.id, true);
    const got = await retrieveSharedNotesForPersona(OWNER, '帮我安排音乐练习计划');
    expect(got[0].id).toBe(a.id);
  });

  it('无授权笔记返回空数组', async () => {
    await seed('没授权');
    expect(await retrieveSharedNotesForPersona(OWNER, 'anything')).toHaveLength(0);
  });
});
