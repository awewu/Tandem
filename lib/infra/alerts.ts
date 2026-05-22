/**
 * Alerts · 关键事件告警分发
 *
 * - logger 始终记录 (走 stdout JSON)
 * - 配置 ALERT_WEBHOOK_URL 时, 同步 fire-and-forget POST 到 webhook
 *   (兼容 Slack incoming-webhook / DingTalk / 飞书机器人 Markdown)
 *
 * 用法:
 *   import { fireAlert } from '@/lib/infra/alerts';
 *   await fireAlert({
 *     severity: 'critical',
 *     title: '审计链断裂',
 *     body: 'AuditLog hash mismatch at id=...',
 *     tags: { module: 'audit' },
 *   });
 *
 * 不抛错: 告警是最佳努力, 任何失败都只是 logger.warn, 不影响主流程.
 */

import { logger } from './logger';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export interface AlertPayload {
  severity: AlertSeverity;
  title: string;
  body?: string;
  tags?: Record<string, string | number | boolean>;
}

const SEV_EMOJI: Record<AlertSeverity, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
};

// In-memory rate limit · 同 (severity+title) 60s 内只发一次
const lastFiredAt = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

function rateLimited(key: string): boolean {
  const last = lastFiredAt.get(key);
  if (last && Date.now() - last < RATE_LIMIT_MS) return true;
  lastFiredAt.set(key, Date.now());
  return false;
}

async function postWebhook(url: string, payload: AlertPayload): Promise<void> {
  const text =
    `${SEV_EMOJI[payload.severity]} **${payload.title}** (${payload.severity})\n` +
    (payload.body ? `\n${payload.body}\n` : '') +
    (payload.tags ? `\n${Object.entries(payload.tags).map(([k, v]) => `\`${k}=${v}\``).join(' · ')}` : '');

  // Generic markdown body. Slack 会展开 mrkdwn; DingTalk/飞书 兼容字段不同 — 用户需挑 webhook.
  const body = JSON.stringify({ text, msgtype: 'markdown', markdown: { title: payload.title, text } });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fireAlert(payload: AlertPayload): Promise<void> {
  const key = `${payload.severity}:${payload.title}`;
  if (rateLimited(key)) return;

  // 1. logger 永远写
  const log =
    payload.severity === 'critical' ? logger.error.bind(logger)
    : payload.severity === 'warning' ? logger.warn.bind(logger)
    : logger.info.bind(logger);
  log({ alert: true, ...payload }, `[alert] ${payload.title}`);

  // 2. webhook (best-effort)
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await postWebhook(url, payload);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[alert] webhook delivery failed');
  }
}
