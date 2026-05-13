/**
 * Meeting Proxy · 分身代参 (寄生腾讯会议)
 *
 * 对应 MEETING-PROXY 文档 + MANIFESTO 第十一/十二条 (绿/黄/红区授权).
 *
 * 流程:
 *   1. 用户授权: persona.stage >= deputy 才允许
 *   2. 创建 ProxyMission (本次代参的范围 + 限制)
 *   3. 加入会议 (作为机器人成员, 显示 "AI 代行")
 *   4. 实时转录 → LLM 摘要 → 决策建议
 *   5. 红区议题 (薪资/法律/股权) → 自动退出 + 通知本人
 *   6. 会后: 写入 Material 层 + 推送给本人 review
 *
 * 关键守门:
 *   - 任何代参视频 + 转录 → 标 "AI 代行" 水印
 *   - 24h 内本人可撤回任何代行决策
 *   - 红区议题强制退出
 */

import { audit } from '../audit/log';
import { getStore } from '../storage/repository';
import { embedMaterial } from '../memory/vector-retriever';
import { SENSITIVE_KEYWORDS } from '../persona/communication-mimicry';

export type Zone = 'green' | 'yellow' | 'red';

export interface ProxyMission {
  id: string;
  userId: string;
  meetingId: string;            // 腾讯会议 meeting code
  meetingTitle: string;
  authorizedAt: string;
  authorizedZones: Zone[];      // 默认 ['green'], 高级阶段可加 'yellow'
  /** 议题黑名单 (用户预设) */
  topicBlacklist: string[];
  /** 当前状态 */
  status: 'pending' | 'in_meeting' | 'exited' | 'completed' | 'aborted';
  /** 实时摘要 */
  liveSummary?: string;
  /** 退出原因 */
  exitReason?: 'red_zone' | 'user_revoked' | 'meeting_ended' | 'error';
  createdAt: string;
}

const missions = new Map<string, ProxyMission>();

export async function createMission(input: {
  userId: string;
  meetingId: string;
  meetingTitle: string;
  authorizedZones?: Zone[];
  topicBlacklist?: string[];
}): Promise<ProxyMission> {
  // 校验 persona stage
  const store = getStore();
  const personas = await store.personas.list({ userId: input.userId } as never);
  const persona = personas[0];
  if (!persona) throw new Error('Persona not found');
  if (persona.stage !== 'deputy' && persona.stage !== 'partner') {
    throw new Error(`分身阶段 ${persona.stage} 不允许代参 (至少 deputy)`);
  }

  const mission: ProxyMission = {
    id: `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    meetingId: input.meetingId,
    meetingTitle: input.meetingTitle,
    authorizedAt: new Date().toISOString(),
    authorizedZones: input.authorizedZones ?? ['green'],
    topicBlacklist: input.topicBlacklist ?? [],
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  missions.set(mission.id, mission);

  await audit('persona.proxy_action', input.userId, {
    targetId: mission.id,
    targetType: 'meeting_proxy',
    metadata: { event: 'mission_created', meetingId: input.meetingId },
  });

  return mission;
}

/**
 * 进入会议 (实际由腾讯会议 SDK 触发, 此处仅记录)
 */
export async function joinMeeting(missionId: string): Promise<void> {
  const m = missions.get(missionId);
  if (!m) throw new Error(`Mission ${missionId} not found`);
  m.status = 'in_meeting';
  await audit('persona.proxy_action', m.userId, {
    targetId: missionId,
    metadata: { event: 'joined_meeting' },
  });
}

/**
 * 处理实时转录片段 (来自腾讯会议 SDK)
 *
 * 检测红区议题 → 立即退出
 */
export async function processTranscript(
  missionId: string,
  transcriptChunk: string
): Promise<{ shouldExit: boolean; reason?: string }> {
  const m = missions.get(missionId);
  if (!m || m.status !== 'in_meeting') {
    return { shouldExit: false };
  }

  // 检测红区
  const lower = transcriptChunk.toLowerCase();
  const triggered = SENSITIVE_KEYWORDS.find((kw) => lower.includes(kw.toLowerCase()));
  if (triggered) {
    await exitMeeting(missionId, 'red_zone');
    return { shouldExit: true, reason: `红区议题: ${triggered}` };
  }

  // 检测 topic blacklist
  for (const black of m.topicBlacklist) {
    if (lower.includes(black.toLowerCase())) {
      await exitMeeting(missionId, 'red_zone');
      return { shouldExit: true, reason: `黑名单议题: ${black}` };
    }
  }

  return { shouldExit: false };
}

export async function exitMeeting(missionId: string, reason: ProxyMission['exitReason']): Promise<void> {
  const m = missions.get(missionId);
  if (!m) return;
  m.status = 'exited';
  m.exitReason = reason;
  await audit('persona.proxy_action', m.userId, {
    targetId: missionId,
    metadata: { event: 'exited', reason },
  });
  // 通知本人
  // eslint-disable-next-line no-console
  console.warn(`[meeting-proxy] mission ${missionId} exited: ${reason}`);
}

export async function completeMission(
  missionId: string,
  summary: string
): Promise<{ materialId: string }> {
  const m = missions.get(missionId);
  if (!m) throw new Error(`Mission ${missionId} not found`);
  m.status = 'completed';
  m.liveSummary = summary;

  // 写入 Material 层
  const store = getStore();
  const material = await store.materials.create({
    type: 'meeting_summary' as never,
    title: `[AI 代行] ${m.meetingTitle}`,
    body: { summary, missionId } as never,
    originRefs: [],
    participants: [m.userId],
    visibility: 'team',
    createdBy: 'system',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as never);

  // Fire-and-forget: generate embedding for semantic search
  embedMaterial(material.id, `${material.title}\n${summary}`).catch(() => {});

  await audit('persona.proxy_action', m.userId, {
    targetId: missionId,
    metadata: { event: 'completed', materialId: material.id },
  });

  return { materialId: material.id };
}

export function listMissions(userId?: string): ProxyMission[] {
  const all = Array.from(missions.values());
  return userId ? all.filter((m) => m.userId === userId) : all;
}
