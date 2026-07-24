#!/usr/bin/env node
/**
 * PMS 每日扫描触发脚本 (供非 Vercel 环境: Windows 任务计划 / crontab / CI)
 *
 * 用法:
 *   PMS_BASE_URL=http://localhost:3000 CRON_SECRET=xxx node scripts/pms-daily-scan.mjs [tenantId]
 *
 * 依赖 Node 18+ 内置 fetch。退出码非 0 表示失败, 便于调度器告警。
 */

const baseUrl = process.env.PMS_BASE_URL || 'http://localhost:3000';
const secret = process.env.CRON_SECRET;
const tenantId = process.argv[2] || 'default';

if (!secret) {
  console.error('[pms-cron] 缺少 CRON_SECRET 环境变量');
  process.exit(2);
}

const url = `${baseUrl.replace(/\/$/, '')}/api/pms/cron`;

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
    },
    body: JSON.stringify({ tenantId }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`[pms-cron] 失败 HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  console.log(`[pms-cron] 完成: ${text}`);
  process.exit(0);
} catch (err) {
  console.error(`[pms-cron] 请求异常: ${err?.message || err}`);
  process.exit(1);
}
