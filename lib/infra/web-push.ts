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
  let subs: PushSubscriptionRecord[] = [];
  try {
    const all = await store.pushSubscriptions.list();
    subs = all.filter((s) => s.userId === userId);
  } catch (err) {
    logger.warn({ err: (err as Error).message, userId }, '[web-push] failed to load subscriptions');
    return { sent: 0, failed: 0 };
  }
  if (subs.length === 0) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (sub) => {
      const ok = await sendPushRaw(sub, payload);
      if (ok) sent++; else failed++;
    }),
  );
  logger.info({ userId, sent, failed }, '[web-push] sendPushTo');
  return { sent, failed };
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
