import { createChannel, sendMessage } from '@/lib/im/service';
import { getStore } from '@/lib/storage/repository';
import type { AuthUser } from '@/lib/storage/repository';
import type { CheckIn, Confidence, KeyResult, Objective } from '@/lib/types/okr-tti';
import { membershipKey, type ImChannel } from '@/lib/types/im';

export type DailyReportNotificationSource = 'tandem-report' | 'plm';

export interface DailyReportDepartmentNotificationInput {
  tenantId: string;
  authorId: string;
  checkIn: CheckIn;
  source: DailyReportNotificationSource;
  reportDate?: string;
}

export interface DailyReportDepartmentNotificationResult {
  sent: boolean;
  channelId?: string;
  messageId?: string;
  skippedReason?: 'author_not_found' | 'author_without_department' | 'department_without_members' | 'target_not_found' | 'send_failed';
  error?: string;
}

function confidenceLabel(value: Confidence | undefined): string {
  if (value === 'at-risk') return '有风险';
  if (value === 'off-track') return '需关注';
  return '正常';
}

function formatLine(label: string, value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return `${label}: ${value}`;
}

function sourceLabel(source: DailyReportNotificationSource): string {
  return source === 'plm' ? 'PLM 日报' : 'Tandem 日报';
}

async function findDepartmentChannel(tenantId: string, departmentId: string): Promise<ImChannel | null> {
  const channels = await getStore().imChannels.list();
  return channels.find((channel) =>
    (channel.tenantId ?? 'default') === tenantId &&
    channel.departmentId === departmentId &&
    !channel.archivedAt &&
    (channel.type === 'department' || channel.type === 'team') &&
    channel.autoCreated === true
  ) ?? channels.find((channel) =>
    (channel.tenantId ?? 'default') === tenantId &&
    channel.departmentId === departmentId &&
    !channel.archivedAt &&
    (channel.type === 'department' || channel.type === 'team')
  ) ?? null;
}

async function ensureAuthorMember(channel: ImChannel, authorId: string): Promise<ImChannel> {
  if (channel.memberIds.includes(authorId)) return channel;

  const store = getStore();
  const now = new Date().toISOString();
  const id = membershipKey(channel.id, authorId);
  const existing = await store.imMemberships.get(id);
  if (!existing) {
    await store.imMemberships.create({
      id,
      channelId: channel.id,
      userId: authorId,
      tenantId: channel.tenantId ?? 'default',
      role: 'member',
      joinedAt: now,
      unreadCount: 0,
      muted: false,
    });
  }

  return store.imChannels.update(channel.id, {
    memberIds: Array.from(new Set([...channel.memberIds, authorId])),
    updatedAt: now,
  });
}

async function ensureDepartmentChannel(
  tenantId: string,
  departmentId: string,
  authorId: string,
): Promise<ImChannel | null> {
  const existing = await findDepartmentChannel(tenantId, departmentId);
  if (existing) return ensureAuthorMember(existing, authorId);

  const users = await getStore().auth.users.list({ tenantId });
  const memberIds = users
    .filter((user) => user.departmentId === departmentId && !user.disabled)
    .map((user) => user.id);
  if (!memberIds.includes(authorId)) memberIds.unshift(authorId);
  const uniqueMemberIds = Array.from(new Set(memberIds));
  if (uniqueMemberIds.length === 0) return null;

  return createChannel({
    type: 'department',
    name: `${departmentId} 部门群`,
    topic: '日报自动同步 · 按组织架构自动建群',
    visibility: 'public',
    memberIds: uniqueMemberIds,
    createdBy: authorId,
    tenantId,
    departmentId,
    autoCreated: true,
  });
}

async function resolveTarget(checkIn: CheckIn): Promise<KeyResult | Objective | null> {
  const store = getStore();
  if (checkIn.scope === 'kr') return store.keyResults.get(checkIn.scopeId);
  return store.objectives.get(checkIn.scopeId);
}

function buildMessageBody(input: {
  source: DailyReportNotificationSource;
  author: AuthUser;
  checkIn: CheckIn;
  target: KeyResult | Objective;
  reportDate?: string;
}): string {
  const { source, checkIn, target, reportDate } = input;
  const lines = [
    sourceLabel(source),
    formatLine('日期', reportDate),
    formatLine(checkIn.scope === 'kr' ? 'KR' : 'Objective', target.title),
    formatLine('进度', `${checkIn.progressBefore} -> ${checkIn.progressAfter}`),
    formatLine('信心度', `${confidenceLabel(checkIn.confidenceBefore)} -> ${confidenceLabel(checkIn.confidenceAfter)}`),
    '',
    formatLine('成果', checkIn.achievements?.trim()),
    formatLine('卡点', checkIn.blockers?.trim()),
    formatLine('下一步', checkIn.nextSteps?.trim()),
  ].filter((line): line is string => line !== null);
  return lines.join('\n');
}

export async function notifyDailyReportCheckInToDepartment(
  input: DailyReportDepartmentNotificationInput,
): Promise<DailyReportDepartmentNotificationResult> {
  try {
    const store = getStore();
    const author = await store.auth.users.findById(input.authorId);
    if (!author) return { sent: false, skippedReason: 'author_not_found' };
    if ((author.tenantId ?? 'default') !== input.tenantId) {
      return { sent: false, skippedReason: 'author_not_found' };
    }
    if (!author.departmentId) return { sent: false, skippedReason: 'author_without_department' };

    const target = await resolveTarget(input.checkIn);
    if (!target || (target.tenantId ?? 'default') !== input.tenantId) {
      return { sent: false, skippedReason: 'target_not_found' };
    }

    const channel = await ensureDepartmentChannel(input.tenantId, author.departmentId, author.id);
    if (!channel) return { sent: false, skippedReason: 'department_without_members' };

    const message = await sendMessage({
      channelId: channel.id,
      senderId: author.id,
      body: buildMessageBody({
        source: input.source,
        author,
        checkIn: input.checkIn,
        target,
        reportDate: input.reportDate,
      }),
    });

    return { sent: true, channelId: channel.id, messageId: message.id };
  } catch (error) {
    return {
      sent: false,
      skippedReason: 'send_failed',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
