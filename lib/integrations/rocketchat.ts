/**
 * Rocket.Chat 集成 · IM 基础
 *
 * 启用步骤:
 *   1. docker-compose up rocketchat (使用 OSS-STACK 提供的 compose)
 *   2. 配 ROCKETCHAT_URL / ROCKETCHAT_ADMIN_TOKEN
 *   3. SSO 配置: Rocket.Chat 接 NextAuth (OIDC)
 *
 * V1 场景:
 *   - 创建议事室 → 自动建 RC 频道 (#convergence-{cardId})
 *   - 决议结果 → 推送到对应频道
 *   - Persona 升级 → 推送私信
 *   - 拿捏老板分身 → 通过 Bot 用户身份发言 (带水印)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const RC_URL = process.env.ROCKETCHAT_URL ?? 'http://localhost:3000';
const RC_ADMIN_TOKEN = process.env.ROCKETCHAT_ADMIN_TOKEN ?? '';
const RC_ADMIN_USER_ID = process.env.ROCKETCHAT_ADMIN_USER_ID ?? '';

export interface RCChannel {
  id: string;
  name: string;
  type: 'public' | 'private';
}

export interface RCMessage {
  channelId: string;
  text: string;
  /** 水印: AI 代行需明确标记 */
  watermark?: { isProxy: boolean; proxyForUserId?: string };
}

async function rcFetch<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RC_URL}/api/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': RC_ADMIN_TOKEN,
      'X-User-Id': RC_ADMIN_USER_ID,
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Rocket.Chat API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function createConvergenceChannel(cardId: string, members: string[]): Promise<RCChannel> {
  if (!RC_ADMIN_TOKEN) {
    return { id: `stub_${cardId}`, name: `convergence-${cardId}`, type: 'private' };
  }
  const data = await rcFetch<any>('groups.create', {
    method: 'POST',
    body: JSON.stringify({ name: `convergence-${cardId}`, members }),
  });
  return { id: data.group._id, name: data.group.name, type: 'private' };
}

export async function postMessage(channelName: string, text: string, watermark?: RCMessage['watermark']): Promise<void> {
  if (!RC_ADMIN_TOKEN) {
    // eslint-disable-next-line no-console
    console.info('[rocketchat:stub]', channelName, text);
    return;
  }
  const finalText = watermark?.isProxy
    ? `🤖 [AI 代行 · ${watermark.proxyForUserId ?? 'unknown'}]\n${text}`
    : text;
  await rcFetch('chat.postMessage', {
    method: 'POST',
    body: JSON.stringify({ channel: `#${channelName}`, text: finalText }),
  });
}

export async function archiveChannel(channelName: string): Promise<void> {
  if (!RC_ADMIN_TOKEN) return;
  await rcFetch('groups.archive', {
    method: 'POST',
    body: JSON.stringify({ roomName: channelName }),
  });
}
