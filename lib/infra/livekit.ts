/**
 * LiveKit · 视频会议 token 签发
 *
 * 部署:
 *   - 自托管: docker run livekit/livekit-server (env LIVEKIT_KEYS=key:secret)
 *   - SaaS: livekit.io
 *   - 客户端用 livekit-client SDK 连 ws/wss://your-livekit-server
 *
 * 安全模型: 服务器签发短 TTL JWT (1h), 含 room + identity + grants.
 *           客户端不持有 secret, 不能伪造身份.
 */

import { AccessToken } from 'livekit-server-sdk';
import { logger } from './logger';

interface IssueTokenOpts {
  roomName: string;
  identity: string;
  /** 显示名 (可选) */
  name?: string;
  /** 是否可发布音视频 */
  canPublish?: boolean;
  /** 是否可订阅 */
  canSubscribe?: boolean;
  /** TTL 秒, 默认 1h */
  ttlSec?: number;
}

export function isLiveKitConfigured(): boolean {
  return !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

export async function issueLiveKitToken(opts: IssueTokenOpts): Promise<{
  token: string;
  wsUrl: string;
  expiresAt: number;
}> {
  if (!isLiveKitConfigured()) {
    throw new Error('LIVEKIT_API_KEY / LIVEKIT_API_SECRET not configured');
  }
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const wsUrl = process.env.LIVEKIT_WS_URL ?? 'ws://localhost:7880';
  const ttl = opts.ttlSec ?? 3600;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: opts.identity,
    name: opts.name,
    ttl,
  });
  at.addGrant({
    room: opts.roomName,
    roomJoin: true,
    canPublish: opts.canPublish ?? true,
    canSubscribe: opts.canSubscribe ?? true,
  });

  const token = await at.toJwt();
  const expiresAt = Date.now() + ttl * 1000;
  logger.debug({ room: opts.roomName, identity: opts.identity, ttl }, '[livekit] token issued');
  return { token, wsUrl, expiresAt };
}
