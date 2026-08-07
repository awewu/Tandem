#!/usr/bin/env node
/**
 * 生产启动前置校验（发布安全网）。
 * - 生产(NODE_ENV=production):缺必需密钥 / 用 dev 默认 / 危险 dev 开关 → 硬失败(exit 1),拒绝启动。
 * - 非生产:仅打印警告,永不阻断本地开发。
 *
 * 独立用:  node scripts/preflight.js        (或 npm run preflight)
 * 启动集成:scripts/start-api.js 在 bootstrap 前调用。
 */
'use strict';

// 已知 dev 默认值(生产出现即拒)。
const DEV_JWT = 'nexus-dev-e2e-secret-0803';

function isSet(v) { return v !== undefined && v !== null && String(v).trim() !== ''; }

function pii32(raw) {
  if (!isSet(raw)) return false;
  try {
    const buf = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    return buf.length === 32;
  } catch { return false; }
}

function collect(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];
  const err = (m) => (prod ? errors : warnings).push(m);
  const warn = (m) => warnings.push(m);

  // ── 运行环境 ──
  if (!isSet(env.NODE_ENV)) warn('NODE_ENV 未设置(生产应为 production)。');

  // ── 数据库(运行时应为最小权限 rhautt_app,绝不用属主/超级用户,否则 RLS 失效)──
  const hasDb = isSet(env.POSTGRES_URI) || (isSet(env.POSTGRES_HOST) && isSet(env.POSTGRES_DB));
  if (!hasDb) err('数据库连接缺失:需 POSTGRES_URI 或 POSTGRES_HOST + POSTGRES_DB。');
  if (!isSet(env.POSTGRES_URI) && !isSet(env.POSTGRES_PASSWORD)) err('POSTGRES_PASSWORD 未设置。');
  const dbUser = env.POSTGRES_USER || '';
  if (prod && dbUser && dbUser !== 'rhautt_app') {
    err(`运行时 POSTGRES_USER=${dbUser} —— 生产必须用最小权限 rhautt_app(NOBYPASSRLS)。属主/超级用户会绕过 RLS,破坏租户隔离。`);
  }
  if (env.POSTGRES_SYNCHRONIZE === 'true') err('POSTGRES_SYNCHRONIZE=true 生产禁用(schema 由 curated 迁移拥有,防漂移)。');

  // ── JWT ──
  if (!isSet(env.JWT_SECRET)) err('JWT_SECRET 未设置(token 签名密钥)。');
  else if (env.JWT_SECRET === DEV_JWT) err('JWT_SECRET 仍是 dev 默认值 —— 生产必须换强随机密钥(否则 token 可伪造)。');
  else if (String(env.JWT_SECRET).length < 24) warn('JWT_SECRET 偏短(建议 ≥32 字符强随机)。');

  // ── PII 加密(PIPL:个人信息存储须加密)──
  if (!pii32(env.PII_ENCRYPTION_KEY)) err('PII_ENCRYPTION_KEY 缺失或非 32 字节(需 64 位 hex 或 base64→32 字节);生产 compliance.pii 会因此抛错。');
  if (!isSet(env.PII_HASH_SALT)) warn('PII_HASH_SALT 未设置,将用内置默认盐(建议生产注入独立盐)。');

  // ── 多租户 outbox 枚举(RLS 生效后,投递调度须逐租户枚举,否则跨域飞轮卡 pending)──
  const tenantEnvs = Object.keys(env).filter((k) => /_TENANT_ID$/.test(k) && isSet(env[k]));
  if (tenantEnvs.length === 0) err('未枚举任何运营租户(<SLUG>_TENANT_ID);RLS 下 outbox 投递会全卡 pending,飞轮停摆。');

  // ── 危险 dev 开关(生产出现即拒)──
  for (const flag of ['NEXUS_DEV_SSO', 'OIDC_DEV_AUTO_PROVISION_PLATFORM_ADMIN', 'OIDC_DEV_AUTO_PROVISION_TENANT_CODE']) {
    if (prod && isSet(env[flag])) err(`危险 dev 开关 ${flag} 不得出现在生产环境。`);
  }

  // ── AI provider(缺则 AI 走确定性兜底,非真模型)──
  const hasAi = isSet(env.ANTHROPIC_API_KEY) || isSet(env.GROWTH_AI_API_KEY) || isSet(env.HERMES_CENTER_AI_AUTH_TOKEN);
  if (!hasAi) warn('未配置 AI provider 密钥(ANTHROPIC_API_KEY / GROWTH_AI_API_KEY / HERMES_CENTER_AI_AUTH_TOKEN)—— AgenticGEO/内容生成将走确定性兜底,非真实模型。');

  // ── 缓存/事件总线(HA/流处理)──
  if (!isSet(env.REDIS_URL) && !isSet(env.REDIS_HOST)) warn('未配置 Redis(REDIS_URL/REDIS_HOST)—— 缓存/Redis Streams 事件分发不可用。');

  return { prod, errors, warnings };
}

function preflight(env = process.env) {
  const { prod, errors, warnings } = collect(env);
  const tag = '[preflight]';
  for (const w of warnings) console.warn(`${tag} ⚠️  ${w}`);
  for (const e of errors) console.error(`${tag} ❌ ${e}`);
  if (errors.length && prod) {
    console.error(`${tag} 生产就绪校验失败:${errors.length} 项必修。拒绝启动。`);
    return false;
  }
  console.log(`${tag} ✅ 通过(${prod ? '生产严格' : '非生产·仅警告'})· 警告 ${warnings.length} · 错误 ${errors.length}`);
  return true;
}

module.exports = { preflight, collect };

if (require.main === module) {
  const path = require('path');
  // 独立运行时,若指定 DOTENV_CONFIG_PATH 则先加载(便于对某 env 文件做校验)。
  try {
    const p = process.env.DOTENV_CONFIG_PATH || path.join(__dirname, '..', '.env.nestjs');
    require('dotenv').config({ path: p, quiet: true });
  } catch { /* dotenv 可选 */ }
  process.exit(preflight() ? 0 : 1);
}
