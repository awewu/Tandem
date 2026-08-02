/**
 * IM 定时日报 · 群机器人 (§Sprint3 · 对标企业微信「群总结」的主动推送版)
 *
 * 每日定时扫描租户下的活跃工作群, 为当天有足够讨论的群生成「今日群日报」,
 * 以系统机器人身份发到群里 (成员回到 IM 即见红点 + 一份结构化回顾)。
 *
 * 设计要点:
 *   - 仅工作型群 (group/department/team/project/cross_dept), 跳过 dm 与 announcement。
 *   - 阈值: 当天可总结消息 >= MIN_MESSAGES 才发, 避免安静群被打扰。
 *   - 幂等: 同一天同一群不重复发 (扫近 30 条查是否已有机器人日报)。
 *   - fail-soft: 单群失败不影响其它群 (summarizeResolvedChannel 本身也降级)。
 */

import { getStore } from '../storage/repository';
import { sendMessage, getChannelMessages } from './service';
import { summarizeResolvedChannel, type SummarizeChannelOutput } from './summary';
import type { ImChannel, ImChannelType, ImMessage } from '../types/im';

/** 日报机器人 senderId (系统身份, 非真实成员) */
export const DIGEST_BOT_ID = 'im-digest-bot';

/** 触发日报的当天最少可总结消息数 */
export const MIN_DIGEST_MESSAGES = 5;

/** 参与日报的工作群类型 (dm / announcement 不发) */
const DIGEST_CHANNEL_TYPES: ImChannelType[] = ['group', 'department', 'team', 'project', 'cross_dept'];

export interface DailyDigestResult {
  tenantId: string;
  channelsScanned: number;
  digestsPosted: number;
  skippedTooQuiet: number;
  skippedAlreadyPosted: number;
}

/** 该群今天是否已发过机器人日报 (幂等守卫)。纯函数, 可测。 */
export function alreadyPostedToday(messages: ImMessage[], now: Date, botId: string = DIGEST_BOT_ID): boolean {
  const today = now.toDateString();
  return messages.some(
    (m) => m.senderId === botId && !m.deletedAt && new Date(m.createdAt).toDateString() === today,
  );
}

/** 是否为参与日报的工作群 (未归档 + 类型命中)。纯函数, 可测。 */
export function isDigestableChannel(channel: ImChannel): boolean {
  if (channel.archivedAt) return false;
  return DIGEST_CHANNEL_TYPES.includes(channel.type);
}

/**
 * 把总结拼成群内易读的纯文本日报 (不用 markdown `**`, 因 IM 气泡走 renderInline + pre-wrap)。
 * 纯函数, 可测。
 */
export function formatDigestBody(out: SummarizeChannelOutput): string {
  const s = out.summary;
  const lines: string[] = [`📋 今日群日报 · ${out.messageCount} 条 · ${out.participantCount} 人`];
  if (s.overview) lines.push('', s.overview);
  if (s.topics.length) {
    lines.push('', '〔核心讨论〕');
    for (const t of s.topics) lines.push(`• ${t.title}${t.detail ? `：${t.detail}` : ''}`);
  }
  if (s.decisions.length) {
    lines.push('', '〔已达成〕');
    for (const d of s.decisions) lines.push(`• ${d}`);
  }
  if (s.todos.length) {
    lines.push('', '〔待跟进〕');
    for (const t of s.todos) lines.push(`• [${t.owner}] ${t.task}`);
  }
  if (s.questions.length) {
    lines.push('', '〔未决〕');
    for (const q of s.questions) lines.push(`• ${q}`);
  }
  return lines.join('\n');
}

export async function runDailyDigest(tenantId: string = 'default', now: Date = new Date()): Promise<DailyDigestResult> {
  const store = getStore();
  const all = await store.imChannels.list();
  const channels = all.filter(
    (c) => (c.tenantId ?? 'default') === tenantId && isDigestableChannel(c),
  );

  const result: DailyDigestResult = {
    tenantId,
    channelsScanned: channels.length,
    digestsPosted: 0,
    skippedTooQuiet: 0,
    skippedAlreadyPosted: 0,
  };

  for (const channel of channels) {
    try {
      // 幂等: 当天已发过 → 跳过
      const recent = await getChannelMessages(channel.id, { limit: 30 });
      if (alreadyPostedToday(recent, now)) {
        result.skippedAlreadyPosted++;
        continue;
      }

      const summary = await summarizeResolvedChannel(channel, { scope: 'today', tenantId });
      if (summary.messageCount < MIN_DIGEST_MESSAGES) {
        result.skippedTooQuiet++;
        continue;
      }

      await sendMessage({
        channelId: channel.id,
        senderId: DIGEST_BOT_ID,
        senderKind: 'system',
        body: formatDigestBody(summary),
      });
      result.digestsPosted++;
    } catch {
      /* fail-soft: 单群失败不阻断整体扫描 */
    }
  }

  return result;
}
