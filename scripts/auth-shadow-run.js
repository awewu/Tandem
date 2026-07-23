#!/usr/bin/env node
/**
 * Auth M2 · 影子运行对比脚本
 *
 * 对 legacy Express /api/auth 与 NestJS /api/v2/auth 同时发起相同请求，
 * 对比状态码与响应体 shape，为 auth 域切切换提供数据基线。
 *
 * 用法：
 *   LEGACY_URL=http://localhost:3000 NESTJS_URL=http://localhost:3001 \
 *   TEST_PHONE=13800138000 TEST_PASSWORD=password123 \
 *   node scripts/auth-shadow-run.js
 *
 * 不强制需要真实用户：公开端点会返回 401/400/501 等错误响应，脚本仍记录
 * shape 差异；若提供 TEST_PHONE + TEST_PASSWORD，则额外对比受保护端点。
 *
 * 输出：console 表格 + JSON/Markdown 报告到 reports/auth-shadow-run/。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(ROOT, 'reports', 'auth-shadow-run');

const LEGACY_URL = (process.env.LEGACY_URL || 'http://localhost:3000').replace(/\/$/, '');
const NESTJS_URL = (process.env.NESTJS_URL || 'http://localhost:3001').replace(/\/$/, '');
const TEST_PHONE = process.env.TEST_PHONE || '';
const TEST_PASSWORD = process.env.TEST_PASSWORD || '';

const PUBLIC_CASES = [
  { name: 'login', method: 'POST', path: '/login', body: { phone: TEST_PHONE || '13800000000', password: 'wrong-password' } },
  { name: 'login-sms', method: 'POST', path: '/login-sms', body: { phone: TEST_PHONE || '13800000000', smsCode: '123456' } },
  { name: 'send-sms', method: 'POST', path: '/send-sms', body: { phone: TEST_PHONE || '13800000000' } },
  { name: 'register', method: 'POST', path: '/register', body: { phone: TEST_PHONE || '13800000000', password: 'password123' } },
];

const PROTECTED_CASES = [
  { name: 'me', method: 'GET', path: '/me', body: null },
  { name: 'user', method: 'GET', path: '/user', body: null },
  { name: 'update-user', method: 'PUT', path: '/user', body: { name: 'Shadow Runner' } },
  { name: 'password', method: 'PUT', path: '/password', body: { oldPassword: 'wrong-old', newPassword: 'short' } },
  { name: 'refresh-token', method: 'POST', path: '/refresh-token', body: null },
  { name: 'logout', method: 'POST', path: '/logout', body: null },
];

async function fetchJson(baseUrl, apiPath, { method, body, token }) {
  const url = `${baseUrl}${apiPath}`;
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    return { status: res.status, body: json ?? text };
  } catch (err) {
    return { status: 0, error: err.message, body: null };
  }
}

function normalizeShape(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${k}:${normalizeShape(value[k])}`).join(',')}}`;
  }
  return typeof value;
}

function shapeDiff(left, right) {
  const l = normalizeShape(left);
  const r = normalizeShape(right);
  if (l === r) return null;
  return { left: l, right: r };
}

async function obtainToken(baseUrl, label) {
  if (!TEST_PHONE || !TEST_PASSWORD) return null;
  const res = await fetchJson(baseUrl, '/login', { method: 'POST', body: { phone: TEST_PHONE, password: TEST_PASSWORD } });
  if (res.status === 200 && res.body?.data?.token) {
    return res.body.data.token;
  }
  console.warn(`[${label}] 无法获取 token：${res.status}`, res.body);
  return null;
}

async function runCase(baseUrl, token, { name, method, path, body }) {
  const res = await fetchJson(baseUrl, path, { method, body, token });
  return { name, method, path, ...res, shape: normalizeShape(res.body) };
}

async function runAll() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const legacyToken = await obtainToken(LEGACY_URL, 'legacy');
  const nestjsToken = await obtainToken(NESTJS_URL, 'nestjs');

  const publicLegacy = await Promise.all(PUBLIC_CASES.map((c) => runCase(LEGACY_URL, null, c)));
  const publicNestjs = await Promise.all(PUBLIC_CASES.map((c) => runCase(NESTJS_URL, null, c)));

  const protectedLegacy = legacyToken
    ? await Promise.all(PROTECTED_CASES.map((c) => runCase(LEGACY_URL, legacyToken, c)))
    : [];
  const protectedNestjs = nestjsToken
    ? await Promise.all(PROTECTED_CASES.map((c) => runCase(NESTJS_URL, nestjsToken, c)))
    : [];

  const rows = [];
  const maxLen = Math.max(publicLegacy.length, publicNestjs.length, protectedLegacy.length, protectedNestjs.length);
  for (let i = 0; i < maxLen; i++) {
    const l = publicLegacy[i] || protectedLegacy[i - publicLegacy.length];
    const r = publicNestjs[i] || protectedNestjs[i - publicNestjs.length];
    if (!l || !r) continue;
    const diff = shapeDiff(l.body, r.body);
    rows.push({
      name: l.name,
      method: l.method,
      path: l.path,
      legacyStatus: l.status,
      nestjsStatus: r.status,
      statusMatch: l.status === r.status,
      shapeMatch: !diff,
      shapeDiff: diff,
      legacyError: l.error || null,
      nestjsError: r.error || null,
    });
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const report = {
    runId,
    meta: {
      legacyUrl: LEGACY_URL,
      nestjsUrl: NESTJS_URL,
      hasCredentials: Boolean(TEST_PHONE && TEST_PASSWORD),
      protectedCompared: Boolean(legacyToken && nestjsToken),
    },
    summary: {
      total: rows.length,
      statusMatch: rows.filter((r) => r.statusMatch).length,
      shapeMatch: rows.filter((r) => r.shapeMatch).length,
    },
    details: rows,
  };

  const jsonPath = path.join(REPORT_DIR, `report-${runId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const mdPath = path.join(REPORT_DIR, `report-${runId}.md`);
  const md = [
    `# Auth Shadow Run Report · ${runId}`,
    '',
    `- legacy: ${LEGACY_URL}`,
    `- nestjs: ${NESTJS_URL}`,
    `- credentials: ${report.meta.hasCredentials ? 'yes' : 'no'}`,
    `- protected compared: ${report.meta.protectedCompared ? 'yes' : 'no'}`,
    '',
    `| name | method | path | legacy | nestjs | status | shape |`,
    `|------|--------|------|--------|--------|--------|-------|`,
    ...rows.map((r) => {
      const status = r.statusMatch ? '✅' : '❌';
      const shape = r.shapeMatch ? '✅' : `❌ ${JSON.stringify(r.shapeDiff)}`;
      return `| ${r.name} | ${r.method} | ${r.path} | ${r.legacyStatus} | ${r.nestjsStatus} | ${status} | ${shape} |`;
    }),
    '',
    `**Summary:** ${report.summary.statusMatch}/${report.summary.total} status match, ${report.summary.shapeMatch}/${report.summary.total} shape match.`,
    '',
  ].join('\n');
  fs.writeFileSync(mdPath, md);

  console.log(`\nLegacy: ${LEGACY_URL}`);
  console.log(`NestJS: ${NESTJS_URL}`);
  console.log(`Credentials: ${report.meta.hasCredentials ? 'yes' : 'no'}`);
  console.log(`Protected compared: ${report.meta.protectedCompared ? 'yes' : 'no'}`);
  console.log(`\nResults: ${report.summary.statusMatch}/${report.summary.total} status match, ${report.summary.shapeMatch}/${report.summary.total} shape match\n`);
  console.table(rows.map((r) => ({
    name: r.name,
    method: r.method,
    legacy: r.legacyStatus,
    nestjs: r.nestjsStatus,
    status: r.statusMatch ? '✅' : '❌',
    shape: r.shapeMatch ? '✅' : JSON.stringify(r.shapeDiff),
  })));
  console.log(`\nReports written:\n  ${jsonPath}\n  ${mdPath}`);

  const exitCode = report.summary.statusMatch === report.summary.total && report.summary.shapeMatch === report.summary.total ? 0 : 1;
  process.exit(exitCode);
}

runAll().catch((err) => {
  console.error('Shadow run failed:', err);
  process.exit(1);
});
