#!/usr/bin/env node
/**
 * §CA-13 · CompanyBrain Monthly Reflection · Cron 脚本
 *
 * 用法:
 *   # 默认 30 天窗口 + 启发式分析
 *   node scripts/company-brain-reflection.mjs
 *
 *   # 90 天窗口 + LLM 深度分析
 *   node scripts/company-brain-reflection.mjs --window=90 --llm
 *
 *   # 指定租户
 *   node scripts/company-brain-reflection.mjs --tenant=acme
 *
 * 部署 (cron):
 *   每月 1 号 02:00 跑:
 *     0 2 1 * *  cd /opt/tandem && /usr/bin/node scripts/company-brain-reflection.mjs --llm >> /var/log/tandem-reflection.log 2>&1
 *
 * 退出码:
 *   0 = 成功生成 (或窗口内无决策, 跳过)
 *   1 = 致命错误
 */

import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// 加载 .env.local + .env
config({ path: path.join(projectRoot, '.env.local') });
config({ path: path.join(projectRoot, '.env') });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const windowDays = Number(args.window ?? 30);
const tenantId = String(args.tenant ?? 'default');
const useLlm = Boolean(args.llm);

console.log(`[reflection-cron] start window=${windowDays}d tenant=${tenantId} useLlm=${useLlm}`);

try {
  // 通过 tsx 加载 TS 模块, 由父级调用方需要装 tsx (devDep) 才行;
  // 简化: 直接 import 编译产物, 假设 next build 已跑过 (或调用方用 tsx 启动本脚本)
  const { generateReflection } = await import(
    path.join(projectRoot, 'lib/persona/company-brain-reflection.ts')
  ).catch(async () => {
    // 兜底: dist 路径 (生产构建后)
    return await import(path.join(projectRoot, '.next/server/chunks/company-brain-reflection.js'));
  });

  const report = await generateReflection({
    windowDays,
    tenantId,
    useLlm,
    actorUserId: 'cron',
  });

  if (!report) {
    console.log('[reflection-cron] 窗口内无决策, 跳过 (exit 0)');
    process.exit(0);
  }

  console.log(
    `[reflection-cron] ✓ generated reportId=${report.id} adoptionRate=${report.metricsSummary.adoptionRate.toFixed(2)} overruleRate=${report.metricsSummary.overruleRate.toFixed(2)} failurePatterns=${report.failurePatterns.length}`,
  );
  console.log(`[reflection-cron] approvalStatus=${report.approvalStatus} (等签批 → 创建新 Version)`);
  process.exit(0);
} catch (err) {
  console.error('[reflection-cron] FATAL:', err);
  process.exit(1);
}
