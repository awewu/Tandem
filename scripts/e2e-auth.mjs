#!/usr/bin/env node
/**
 * Tandem V1 Auth E2E (PRD §8 步骤 1-4 + 安全 2/3)
 *
 * 覆盖:
 *   步 1: bootstrap owner 自动创建后可登录
 *   步 2: owner 创建邀请码 (POST /api/auth/invite)
 *   步 3: 员工 invite 注册 (POST /api/auth/register)
 *   步 4: MFA 启用 (setup stage1 → TOTP → stage2 → enrolled)
 *   安全 2: 5 次密码错误 → 第 6 次 423 locked (15 min)
 *   安全 3: MFA 启用后登录返回 requiresMfa + pendingSessionId, TOTP 验证通过颁发 access
 *
 * 约束:
 *   - 不依赖 UI, 纯 HTTP API + cookie
 *   - 不依赖 speakeasy / otplib: TOTP 本地 RFC 6238 实现
 *   - 需要 .env.local 配 TANDEM_BOOTSTRAP_OWNER_* + NEXTAUTH_SECRET + MFA_ENCRYPTION_KEY
 *   - dev server 必须已启动 (http://localhost:3000)
 *
 * 用法:
 *   node scripts/e2e-auth.mjs
 *   node scripts/e2e-auth.mjs http://localhost:3001
 *
 * 退出码: 0 = 全通过, 1 = 任一失败
 */

import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const LOG = [];
let PASS = 0;
let FAIL = 0;

const OWNER_EMAIL = 'admin@tandem.local';
const OWNER_PASSWORD = 'ChangeMeAtFirstLogin!2026';

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) — 与 lib/auth/mfa.ts 对齐 (SHA1 / 30s / 6 digits)
// ---------------------------------------------------------------------------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32Decode(s) {
  const cleaned = s.replace(/=+$/g, '').toUpperCase();
  const out = [];
  let bits = 0, value = 0;
  for (const ch of cleaned) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function totp(secretBase32, atSec = Math.floor(Date.now() / 1000)) {
  const counter = Math.floor(atSec / 30);
  const buf = Buffer.alloc(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256); }
  const h = createHmac('sha1', b32Decode(secretBase32)).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const code =
    ((h[off] & 0x7f) << 24 | (h[off + 1] & 0xff) << 16 |
     (h[off + 2] & 0xff) << 8 | (h[off + 3] & 0xff)) % 1000000;
  return String(code).padStart(6, '0');
}

// ---------------------------------------------------------------------------
// HTTP helpers (manual cookie jar)
// ---------------------------------------------------------------------------
function makeJar() {
  const jar = new Map();
  return {
    setFrom(res) {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : res.headers.raw?.()['set-cookie'];
      if (!raw) return;
      for (const line of raw) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    },
    get(k) { return jar.get(k); },
  };
}

async function req(method, path, { body, jar, expect } = {}) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (jar) {
    const c = jar.header();
    if (c) headers.cookie = c;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (jar) jar.setFrom(res);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
  return { status: res.status, json, text };
}

// ---------------------------------------------------------------------------
// test harness
// ---------------------------------------------------------------------------
function step(name, ok, detail) {
  const tag = ok ? 'PASS' : 'FAIL';
  const line = `[${tag}] ${name} :: ${detail}`;
  LOG.push(line);
  if (ok) PASS++; else FAIL++;
  console.log(line);
}

async function main() {
  console.log(`--- e2e-auth @ ${BASE} ---\n`);

  // -------------------------------------------------------------------------
  // 0. 预热 + bootstrap owner 创建
  // -------------------------------------------------------------------------
  try {
    const h = await req('GET', '/api/health');
    step('0a health', h.status === 200 && h.json?.ok === true, `status=${h.status}`);
  } catch (e) { step('0a health', false, `ERR ${e.message}`); }

  // 任何 API 命中都会触发 boot() → bootstrapOwnerIfMissing
  // 再等 200ms 让异步 bootstrap 收尾
  await new Promise((r) => setTimeout(r, 200));

  // -------------------------------------------------------------------------
  // 步 1: bootstrap owner 登录
  // -------------------------------------------------------------------------
  const ownerJar = makeJar();
  try {
    const r = await req('POST', '/api/auth/login', {
      jar: ownerJar,
      body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
    });
    const ok = r.status === 200 && r.json?.ok === true && !!ownerJar.get('tandem_at');
    step('1 owner login (bootstrap)',
      ok,
      `status=${r.status} cookie.at=${ownerJar.get('tandem_at') ? 'set' : 'missing'} userId=${r.json?.userId ?? '—'}`);
  } catch (e) { step('1 owner login', false, `ERR ${e.message}`); }

  // -------------------------------------------------------------------------
  // 步 2: owner 创建邀请码
  // -------------------------------------------------------------------------
  let inviteCode = null;
  try {
    const r = await req('POST', '/api/auth/invite', {
      jar: ownerJar,
      body: {
        email: 'alice@tandem.local',
        presetRoles: ['employee'],
        maxUses: 1,
        validHours: 24,
        note: 'e2e-auth',
      },
    });
    inviteCode = r.json?.code;
    step('2 invite created',
      r.status === 200 && !!inviteCode,
      `status=${r.status} codeLen=${inviteCode?.length ?? 0} inviteId=${r.json?.inviteId ?? '—'}`);
  } catch (e) { step('2 invite created', false, `ERR ${e.message}`); }

  // -------------------------------------------------------------------------
  // 步 3: 员工 invite 注册
  // -------------------------------------------------------------------------
  const aliceJar = makeJar();
  // 密码不能含邮箱前缀 'alice' (等保 2.0 规则)
  const alicePassword = 'Z3bra!Nova#Quartz-2026';
  try {
    if (!inviteCode) throw new Error('no inviteCode from step 2');
    const r = await req('POST', '/api/auth/register', {
      jar: aliceJar,
      body: {
        email: 'alice@tandem.local',
        password: alicePassword,
        name: 'Alice',
        inviteCode,
      },
    });
    const ok = r.status === 200 && r.json?.ok === true && !!aliceJar.get('tandem_at');
    const detail = ok
      ? `status=${r.status} userId=${r.json?.userId ?? '—'} cookie.at=set`
      : `status=${r.status} code=${r.json?.code ?? '—'} err=${r.json?.error ?? r.text?.slice(0, 100) ?? '—'}`;
    step('3 invite register', ok, detail);
  } catch (e) { step('3 invite register', false, `ERR ${e.message}`); }

  // -------------------------------------------------------------------------
  // 安全 2: 5 次错误密码 → 第 6 次 423 locked
  // -------------------------------------------------------------------------
  try {
    let lockedStatus = null;
    let lastCode = null;
    for (let i = 1; i <= 6; i++) {
      const r = await req('POST', '/api/auth/login', {
        body: { email: 'alice@tandem.local', password: `wrong-pass-${i}` },
      });
      lastCode = r.json?.code;
      if (r.status === 423) { lockedStatus = r.status; break; }
    }
    step('安全2 lock-after-5-failures',
      lockedStatus === 423 && lastCode === 'account_locked',
      `lockedAt=attempt6 status=${lockedStatus ?? 'NOT_LOCKED'} code=${lastCode ?? '—'}`);
  } catch (e) { step('安全2 lock-after-5-failures', false, `ERR ${e.message}`); }

  // -------------------------------------------------------------------------
  // 步 4: MFA 启用 (给 owner 挂 MFA — alice 已锁)
  // -------------------------------------------------------------------------
  let ownerSecret = null;
  let ownerRecoveryCodes = null;
  try {
    // 阶段 1: 获取 enrollment
    const r1 = await req('POST', '/api/auth/mfa/setup', { jar: ownerJar, body: {} });
    ownerSecret = r1.json?.secretBase32;
    ownerRecoveryCodes = r1.json?.recoveryCodes;
    step('4a mfa enrollment (stage1)',
      r1.status === 200 && !!ownerSecret && Array.isArray(ownerRecoveryCodes) && ownerRecoveryCodes.length === 10,
      `status=${r1.status} secret.len=${ownerSecret?.length ?? 0} recovery=${ownerRecoveryCodes?.length ?? 0}`);

    // 阶段 2: 计算 TOTP 并提交
    if (ownerSecret) {
      const code = totp(ownerSecret);
      const r2 = await req('POST', '/api/auth/mfa/setup', {
        jar: ownerJar,
        body: {
          secretBase32: ownerSecret,
          totpCode: code,
          recoveryCodes: ownerRecoveryCodes,
        },
      });
      step('4b mfa verify + enroll (stage2)',
        r2.status === 200 && r2.json?.stage === 'enrolled',
        `status=${r2.status} stage=${r2.json?.stage ?? '—'}`);
    } else {
      step('4b mfa verify + enroll (stage2)', false, 'no secret from stage1');
    }
  } catch (e) { step('4a/4b mfa setup', false, `ERR ${e.message}`); }

  // -------------------------------------------------------------------------
  // 安全 3: MFA 启用后再登录 → requiresMfa=true + pendingSessionId, verify 通过颁发 access
  // -------------------------------------------------------------------------
  try {
    // logout first (revoke current session)
    await req('POST', '/api/auth/logout', { jar: ownerJar, body: {} });

    const freshJar = makeJar();
    const rLogin = await req('POST', '/api/auth/login', {
      jar: freshJar,
      body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
    });
    const hasPending = !!rLogin.json?.pendingSessionId;
    step('安全3a login-requires-mfa',
      rLogin.status === 200 && rLogin.json?.requiresMfa === true && hasPending,
      `status=${rLogin.status} requiresMfa=${rLogin.json?.requiresMfa} pending=${hasPending}`);

    if (ownerSecret && rLogin.json?.pendingSessionId) {
      const code = totp(ownerSecret);
      const rVerify = await req('POST', '/api/auth/mfa/verify', {
        jar: freshJar,
        body: { pendingSessionId: rLogin.json.pendingSessionId, totpCode: code },
      });
      const accessIssued = !!freshJar.get('tandem_at');
      step('安全3b mfa-verify-issues-access',
        rVerify.status === 200 && rVerify.json?.ok === true && accessIssued,
        `status=${rVerify.status} userId=${rVerify.json?.userId ?? '—'} accessSet=${accessIssued}`);

      // 验证 session 有效 (访问 /api/auth/me)
      const rMe = await req('GET', '/api/auth/me', { jar: freshJar });
      step('安全3c session-valid-after-mfa',
        rMe.status === 200 && rMe.json?.user?.email === OWNER_EMAIL,
        `status=${rMe.status} email=${rMe.json?.user?.email ?? '—'}`);
    } else {
      step('安全3b mfa-verify-issues-access', false, 'no pendingSessionId or secret');
      step('安全3c session-valid-after-mfa', false, 'skipped (3b precondition failed)');
    }
  } catch (e) { step('安全3 mfa-login-flow', false, `ERR ${e.message}`); }

  // -------------------------------------------------------------------------
  // 附加: 错误 TOTP 被拒
  // -------------------------------------------------------------------------
  try {
    const freshJar = makeJar();
    const rLogin = await req('POST', '/api/auth/login', {
      jar: freshJar,
      body: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
    });
    if (rLogin.json?.pendingSessionId) {
      const rBad = await req('POST', '/api/auth/mfa/verify', {
        jar: freshJar,
        body: { pendingSessionId: rLogin.json.pendingSessionId, totpCode: '000000' },
      });
      step('安全3d bad-totp-rejected',
        rBad.status === 401 && rBad.json?.code === 'invalid_mfa',
        `status=${rBad.status} code=${rBad.json?.code ?? '—'}`);
    } else {
      step('安全3d bad-totp-rejected', false, 'no pendingSessionId');
    }
  } catch (e) { step('安全3d bad-totp-rejected', false, `ERR ${e.message}`); }

  // -------------------------------------------------------------------------
  // summary
  // -------------------------------------------------------------------------
  const total = PASS + FAIL;
  console.log(`\n--- ${PASS}/${total} PASS, ${FAIL} FAIL ---`);
  writeFileSync('.tmp-e2e-auth.log', LOG.join('\n') + '\n', 'utf8');
  console.log('log: .tmp-e2e-auth.log');
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('fatal', e);
  process.exit(2);
});
