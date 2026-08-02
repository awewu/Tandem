/**
 * IM 定时日报 / 群机器人测试 (§Sprint3)
 *
 * 覆盖 (确定性, 不打网络 LLM):
 *   - alreadyPostedToday: 当天已有机器人日报 → true; 昨天/他人 → false
 *   - isDigestableChannel: dm/announcement/已归档 → false; 工作群 → true
 *   - runDailyDigest: dm 不计入扫描; 安静群 (消息<阈值) skippedTooQuiet;
 *     当天已发过 skippedAlreadyPosted (均不触发 LLM)
 *   - spawnDecisionRoomFromText: 频道不存在 → throw
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setStore, getStore } from '@/lib/storage/repository';
import { createInMemoryStore } from '@/lib/storage/memory-store';
import { createChannel, sendMessage, spawnDecisionRoomFromText } from '@/lib/im/service';
import {
  runDailyDigest,
  alreadyPostedToday,
  isDigestableChannel,
  formatDigestBody,
  DIGEST_BOT_ID,
} from '@/lib/im/daily-digest';
import type { SummarizeChannelOutput } from '@/lib/im/summary';
import type { ImChannel, ImMessage } from '@/lib/types/im';

beforeEach(() => {
  setStore(createInMemoryStore());
});

function msg(partial: Partial<ImMessage>): ImMessage {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    channelId: 'c1',
    senderId: partial.senderId ?? 'u1',
    senderKind: partial.senderKind ?? 'user',
    body: partial.body ?? 'hi',
    mentions: [],
    createdAt: partial.createdAt ?? new Date().toISOString(),
    deletedAt: partial.deletedAt,
  };
}

function chan(partial: Partial<ImChannel>): ImChannel {
  return {
    id: 'c1',
    type: partial.type ?? 'group',
    name: partial.name ?? '群',
    visibility: 'public',
    memberIds: ['u1'],
    createdBy: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: partial.archivedAt,
    ...partial,
  };
}

describe('alreadyPostedToday', () => {
  const now = new Date('2026-02-01T10:00:00.000Z');

  it('当天有机器人日报 → true', () => {
    const messages = [msg({ senderId: DIGEST_BOT_ID, createdAt: '2026-02-01T08:00:00.000Z' })];
    expect(alreadyPostedToday(messages, now)).toBe(true);
  });

  it('昨天的机器人日报 → false', () => {
    const messages = [msg({ senderId: DIGEST_BOT_ID, createdAt: '2026-01-31T23:00:00.000Z' })];
    expect(alreadyPostedToday(messages, now)).toBe(false);
  });

  it('当天但非机器人 → false', () => {
    const messages = [msg({ senderId: 'u1', createdAt: '2026-02-01T09:00:00.000Z' })];
    expect(alreadyPostedToday(messages, now)).toBe(false);
  });

  it('已撤回的机器人日报 → false', () => {
    const messages = [msg({ senderId: DIGEST_BOT_ID, createdAt: '2026-02-01T08:00:00.000Z', deletedAt: '2026-02-01T08:01:00.000Z' })];
    expect(alreadyPostedToday(messages, now)).toBe(false);
  });
});

describe('isDigestableChannel', () => {
  it('工作群 → true', () => {
    expect(isDigestableChannel(chan({ type: 'group' }))).toBe(true);
    expect(isDigestableChannel(chan({ type: 'department' }))).toBe(true);
    expect(isDigestableChannel(chan({ type: 'project' }))).toBe(true);
  });

  it('dm / announcement → false', () => {
    expect(isDigestableChannel(chan({ type: 'dm' }))).toBe(false);
    expect(isDigestableChannel(chan({ type: 'announcement' }))).toBe(false);
  });

  it('已归档 → false', () => {
    expect(isDigestableChannel(chan({ type: 'group', archivedAt: new Date().toISOString() }))).toBe(false);
  });
});

describe('runDailyDigest', () => {
  it('dm 不计入扫描, 只扫工作群', async () => {
    await createChannel({ type: 'group', name: '工作群', memberIds: ['u1', 'u2'], createdBy: 'u1' });
    await createChannel({ type: 'dm', name: '', memberIds: ['u1', 'u2'], createdBy: 'u1' });

    const out = await runDailyDigest('default');
    expect(out.channelsScanned).toBe(1);
  });

  it('安静群 (消息 < 阈值) → skippedTooQuiet, 不发日报', async () => {
    const c = await createChannel({ type: 'group', name: '安静群', memberIds: ['u1', 'u2'], createdBy: 'u1' });
    await sendMessage({ channelId: c.id, senderId: 'u1', body: '就一句' });

    const out = await runDailyDigest('default');
    expect(out.digestsPosted).toBe(0);
    expect(out.skippedTooQuiet).toBe(1);
  });

  it('当天已发过 → skippedAlreadyPosted (幂等)', async () => {
    const c = await createChannel({ type: 'group', name: '群', memberIds: ['u1', 'u2'], createdBy: 'u1' });
    // 预置一条今天的机器人日报
    await sendMessage({ channelId: c.id, senderId: DIGEST_BOT_ID, senderKind: 'system', body: '📋 今日群日报' });

    const out = await runDailyDigest('default');
    expect(out.skippedAlreadyPosted).toBe(1);
    expect(out.digestsPosted).toBe(0);
  });

  it('租户隔离: 只扫本租户的群', async () => {
    await createChannel({ type: 'group', name: 'A', memberIds: ['u1'], createdBy: 'u1', tenantId: 'default' });
    await createChannel({ type: 'group', name: 'B', memberIds: ['u1'], createdBy: 'u1', tenantId: 'other' });

    const out = await runDailyDigest('default');
    expect(out.channelsScanned).toBe(1);
    void getStore;
  });
});

describe('formatDigestBody', () => {
  const out: SummarizeChannelOutput = {
    ok: true,
    aiGenerated: true,
    scope: 'today',
    messageCount: 12,
    participantCount: 4,
    rangeStart: null,
    rangeEnd: null,
    summary: {
      overview: '今天讨论了发布计划。',
      topics: [{ title: '发布时间', detail: '定在周五' }],
      decisions: ['周五上线'],
      todos: [{ owner: '张三', task: '写发布说明', ownerId: 'u1' }],
      questions: ['灰度比例未定'],
    },
  };

  it('含条数/人数头 + 各分区, 且不含 markdown 星号', () => {
    const body = formatDigestBody(out);
    expect(body).toContain('📋 今日群日报 · 12 条 · 4 人');
    expect(body).toContain('〔核心讨论〕');
    expect(body).toContain('〔已达成〕');
    expect(body).toContain('〔待跟进〕');
    expect(body).toContain('• [张三] 写发布说明');
    expect(body).toContain('〔未决〕');
    expect(body).not.toContain('**');
  });

  it('空分区不出现对应标题', () => {
    const empty: SummarizeChannelOutput = {
      ...out,
      summary: { overview: '只有概览。', topics: [], decisions: [], todos: [], questions: [] },
    };
    const body = formatDigestBody(empty);
    expect(body).toContain('只有概览。');
    expect(body).not.toContain('〔核心讨论〕');
    expect(body).not.toContain('〔待跟进〕');
  });
});

describe('spawnDecisionRoomFromText', () => {
  it('频道不存在 → throw', async () => {
    await expect(
      spawnDecisionRoomFromText({ channelId: 'nope', triggeredBy: 'u1', title: '议题' }),
    ).rejects.toThrow(/channel gone/);
  });
});
