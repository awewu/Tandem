/**
 * lib/persona/daily-focus-push.ts · 今日聚焦每日主动推送 (对标 WorkBoard Daily Focus 的"主动推送")
 *
 * 把 lib/persona/daily-focus.ts 生成的个人晨报, 每天通过**应用内通知铃 + web-push**
 * 主动推给有紧急待办 (actNowCount>0) 的用户。选通知铃而非 IM, 避免刷屏。
 *
 * 安全纪律 (作用于 LIVE 库, 面向真实员工):
 *   - **默认关闭**: 仅当 env DAILY_FOCUS_PUSH_ENABLED='1' 才推送 (opt-in, 零行为变更)。
 *   - **只推有紧急项的用户** (actNowCount>0), 无紧急待办不打扰。
 *   - **按天幂等**: 调用方 (boot cron) 用日期守卫保证每天至多一轮; sourceId 带日期便于溯源。
 *   - **fail-soft**: 单用户失败不影响其余; 整体异常不阻断 boot。
 *
 * 依赖可注入 (deps), 便于单测无需真库。
 */

import { logger } from '../infra/logger';
import { generateDailyFocus, type DailyFocus } from './daily-focus';

export interface DailyFocusPushResult {
  enabled: boolean;
  scanned: number;
  pushed: number;
}

interface PushUser {
  id: string;
  disabled?: boolean;
}

interface PushNotifyCommand {
  userId: string;
  title: string;
  body: string;
  sourceId: string;
  url: string;
}

export interface DailyFocusPushDeps {
  /** 覆盖 env 开关 (测试用) */
  enabled?: boolean;
  listUsers?: (tenantId: string) => Promise<PushUser[]>;
  generate?: (userId: string, now: number) => Promise<DailyFocus>;
  notify?: (cmd: PushNotifyCommand) => Promise<void>;
}

function isEnabled(deps?: DailyFocusPushDeps): boolean {
  if (deps?.enabled !== undefined) return deps.enabled;
  return process.env.DAILY_FOCUS_PUSH_ENABLED === '1';
}

async function defaultListUsers(tenantId: string): Promise<PushUser[]> {
  const { getStore } = await import('../storage/repository');
  const users = await getStore().auth.users.list({ tenantId });
  return users.map((u) => ({ id: u.id, disabled: u.disabled }));
}

async function defaultNotify(cmd: PushNotifyCommand): Promise<void> {
  const { createAppContext } = await import('../repositories/app-context-factory');
  const { NotificationService } = await import('../services/notification-service');
  const svc = new NotificationService(createAppContext());
  await svc.create({
    userId: cmd.userId,
    type: 'system',
    priority: 'normal',
    title: cmd.title,
    body: cmd.body,
    sourceType: 'daily_focus',
    sourceId: cmd.sourceId,
    data: { url: cmd.url },
  });
}

/**
 * 扫描用户并给有紧急待办者推送今日聚焦。默认关闭 (opt-in)。
 */
export async function pushDailyFocusNotifications(opts?: {
  tenantId?: string;
  now?: number;
  deps?: DailyFocusPushDeps;
}): Promise<DailyFocusPushResult> {
  const deps = opts?.deps;
  if (!isEnabled(deps)) {
    return { enabled: false, scanned: 0, pushed: 0 };
  }
  const tenantId = opts?.tenantId ?? 'default';
  const now = opts?.now ?? Date.now();
  const dateKey = new Date(now).toISOString().slice(0, 10);

  const listUsers = deps?.listUsers ?? defaultListUsers;
  const generate = deps?.generate ?? ((userId: string, n: number) => generateDailyFocus({ userId, now: n }));
  const notify = deps?.notify ?? defaultNotify;

  const users = (await listUsers(tenantId)).filter((u) => !u.disabled);
  let pushed = 0;

  for (const u of users) {
    try {
      const focus = await generate(u.id, now);
      if (focus.actNowCount <= 0) continue;
      await notify({
        userId: u.id,
        title: `今日聚焦 · ${focus.actNowCount} 项需处理`,
        body: focus.headline,
        sourceId: `daily-focus:${dateKey}:${u.id}`,
        url: '/',
      });
      pushed += 1;
    } catch (err) {
      logger.warn({ err: (err as Error).message, userId: u.id }, '[daily-focus-push] user push failed');
    }
  }

  return { enabled: true, scanned: users.length, pushed };
}
