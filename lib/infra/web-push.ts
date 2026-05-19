/**
 * Web Push · 浏览器推送通知
 *
 * 配置:
 *   VAPID_PUBLIC_KEY  (前端订阅用, 通过 /api/push/vapid 暴露)
 *   VAPID_PRIVATE_KEY (服务端签发用)
 *   VAPID_SUBJECT     mailto: 或 https:// URL
 *
 * 生成 VAPID 密钥对 (一次性):
 *   npx web-push generate-vapid-keys
 *
 * 订阅流程:
 *   1. 前端注册 SW → swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
 *   2. POST /api/push/subscribe { subscription }
 *   3. 业务侧调 sendPushTo(userId, payload)
 */

import webpush from 'web-push';
import { logger } from './logger';
import { getStore } from '@/lib/storage/repository';

let initialized = false;

export function isWebPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function initVapid() {
  if (initialized) return;
  if (!isWebPushConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@tandem.local',
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  initialized = true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt: string;
  lastUsedAt?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushTo(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  initVapid();
  if (!initialized) return { sent: 0, failed: 0 };
  const store = getStore();
  // V1: 订阅记录存在 KvStore (collection=push_subscriptions) — 这里走 dyn 风格 V2 再独立强类型
  // 简化: 用 notifications 模型代借, 真实生产应该新建独立 collection
  // 此处仅 scaffold, 实际持久化逻辑在 API 路由里, sendPushTo 直接调时需要传 subscription
  void store;
  void payload;
  logger.debug({ userId }, '[web-push] sendPushTo scaffold (impl in /api/push/send)');
  return { sent: 0, failed: 0 };
}

export async function sendPushRaw(sub: PushSubscriptionRecord, payload: PushPayload): Promise<boolean> {
  initVapid();
  if (!initialized) return false;
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: sub.keys,
      },
      JSON.stringify(payload),
    );
    return true;
  } catch (err) {
    logger.warn({ err: (err as Error).message, userId: sub.userId }, '[web-push] send failed');
    return false;
  }
}
