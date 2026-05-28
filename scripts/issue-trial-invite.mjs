#!/usr/bin/env node
/**
 * 生成一个"试用通用邀请码", 可被多人复用. 用于产品试用 / 招募.
 *
 * 用法:
 *   node scripts/issue-trial-invite.mjs                 # 默认 100 人 / 7 天有效 / employee 角色
 *   node scripts/issue-trial-invite.mjs 50 168 employee # 自定: maxUses=50 validHours=168 role=employee
 *
 * 前提:
 *   - 服务跑在 BASE_URL (默认 http://localhost:3005)
 *   - Owner 账号 admin@tandem.local + .env.local 里 TANDEM_BOOTSTRAP_OWNER_PASSWORD
 *     (脚本会自动从 .env.local 读)
 *
 * 输出:
 *   - 邀请码 (明文, 仅显示一次)
 *   - 注册 URL (含邀请码 query)
 *   - 邮件模板 (可直接复制粘贴)
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// ---- 解析 .env.local 拿 owner 密码 ----
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local'));

const BASE = process.env.BASE_URL ?? 'http://localhost:3005';
// 默认用 manager seed 账号 (manager 在 /api/auth/invite 白名单).
// 想用 owner 也行: 设 TRIAL_INVITE_EMAIL + TRIAL_INVITE_PASSWORD env vars.
const OWNER_EMAIL = process.env.TRIAL_INVITE_EMAIL ?? 'manager@tandem.local';
const OWNER_PASSWORD = process.env.TRIAL_INVITE_PASSWORD ?? 'Demo1234!@#';

// CLI args
const maxUses = Number(process.argv[2] ?? 100);
const validHours = Number(process.argv[3] ?? 168);
const role = process.argv[4] ?? 'employee';

// ---- 1. owner 登录 ----
console.log(`\n[1/3] Owner 登录...  ${OWNER_EMAIL}`);
const loginRes = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
});
const loginJson = await loginRes.json();
if (!loginRes.ok || !loginJson.ok) {
  console.error('[FATAL] owner 登录失败:', loginJson);
  process.exit(1);
}
const setCookie = loginRes.headers.getSetCookie?.() ?? [];
const cookies = setCookie.map((s) => String(s).split(';')[0]).filter(Boolean).join('; ');
console.log(`        登录成功, userId=${loginJson.userId.slice(0, 18)}...`);

// ---- 2. 创建通用邀请码 ----
console.log(`[2/3] 创建邀请码  maxUses=${maxUses}, validHours=${validHours}, role=${role}`);
const inviteRes = await fetch(`${BASE}/api/auth/invite`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookies },
  body: JSON.stringify({
    presetRoles: [role],
    maxUses,
    validHours,
    note: `Trial bulk invite ${new Date().toISOString().slice(0, 10)}`,
  }),
});
const inviteJson = await inviteRes.json();
if (!inviteRes.ok || !inviteJson.ok) {
  console.error('[FATAL] 创建邀请码失败:', inviteJson);
  process.exit(1);
}

const code = inviteJson.code;
const expiresAt = new Date(inviteJson.expiresAt);
console.log(`        ✅ 邀请码: ${code}`);
console.log(`        有效期至: ${expiresAt.toLocaleString('zh-CN')}`);

// ---- 3. 输出注册 URL 和邮件模板 ----
console.log(`[3/3] 邀请素材`);

const baseUrl = process.env.NEXTAUTH_URL || BASE;
const registerUrl = `${baseUrl}/register?invite=${code}`;

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                      📩 邀请素材 (复制即用)                          ║
╠════════════════════════════════════════════════════════════════════╣

  邀请码        ${code}
  注册地址      ${registerUrl}
  有效期        ${expiresAt.toLocaleString('zh-CN')}
  最多使用      ${maxUses} 人
  默认角色      ${role}

╠────────────────────────────────────────────────────────────────────╣
║                      📧 邮件模板                                     ║
╠────────────────────────────────────────────────────────────────────╣

主题: 邀请你试用 Tandem · 牛马搭子

正文:

  你好,

  我们邀请你试用 Tandem (牛马搭子), 一款以 OKR + AI 副驾的协作平台.

  🔗 注册地址:  ${registerUrl}
  🔑 邀请码:   ${code}

  打开链接, 输入邀请码 + 你的邮箱 + 一个强密码即可开始使用.
  此邀请码 ${expiresAt.toLocaleDateString('zh-CN')} 前有效, 最多 ${maxUses} 人.

  进入后建议先看的 3 个页面:
    1. /                      - 工作台 (Launchpad + 议事决议汇总)
    2. /persona/training      - 分身训练台 (用你的数据养你的 AI 副驾)
    3. /okr                   - 公司 + 个人 OKR 树

  有任何问题, 回复这封邮件即可.

╚════════════════════════════════════════════════════════════════════╝

(邀请码只显示这一次. 请立即转发给被邀请者.)
`);
