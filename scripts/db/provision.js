#!/usr/bin/env node
/**
 * prod:provision — 生产库一键就绪编排(依次执行,失败即停):
 *   1) preflight        环境/密钥校验(生产严格)
 *   2) db:migrate       应用全部 curated 迁移(需属主/migrator 角色)
 *   3) db:verify        迁移后 RLS/权限体检(rhautt_app 权限缺失=阻断)
 *   4) seed-dev-admin   建初始可登录管理员(仅当 SEED_ADMIN=1 时)
 *
 * 用法(指向生产库 env):
 *   POSTGRES_HOST=... POSTGRES_USER=rhautt POSTGRES_PASSWORD=... POSTGRES_DB=rhautt_nexus \
 *   POSTGRES_ADMIN_USER=rhautt POSTGRES_ADMIN_PASSWORD=... SEED_ADMIN=1 npm run prod:provision
 *
 * 注:迁移/体检用属主 rhautt;应用【运行时】仍用最小权限 rhautt_app(见 .env.production)。
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
function run(label, file, extraEnv = {}) {
  console.log(`\n──▶ ${label}`);
  const r = spawnSync(process.execPath, [file], { cwd: root, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} 失败(exit ${r.status})。已中止,未继续后续步骤。`);
    process.exit(r.status || 1);
  }
  console.log(`✓ ${label} 完成`);
}

console.log('=== prod:provision · 生产库就绪编排 ===');
run('1/4 preflight 环境校验', path.join(root, 'scripts', 'preflight.js'));
run('2/4 db:migrate 应用迁移', path.join(root, 'scripts', 'db', 'apply-migrations.js'));
run('3/4 db:verify RLS/权限体检', path.join(root, 'scripts', 'db', 'verify-rls-grants.js'));
if (process.env.SEED_ADMIN === '1') {
  run('4/4 seed 初始管理员', path.join(root, 'scripts', 'db', 'seed-dev-admin.js'));
} else {
  console.log('\n──▶ 4/4 seed 初始管理员 —— 跳过(设 SEED_ADMIN=1 且提供 SEED_ADMIN_PHONE/SEED_ADMIN_PASSWORD 以创建)');
}
console.log('\n🟢 生产库就绪。下一步:以 NODE_ENV=production 启动 API(npm run start:api,preflight 会再校验)与工作台。');
