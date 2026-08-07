#!/usr/bin/env node

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MAX_SCAN_BYTES = 1024 * 1024;

const EXCLUDED_PARTS = new Set([
  '.git',
  '.nx',
  '.next',
  'build',
  'dist',
  'node_modules',
  'runtime-logs',
  'test-results',
]);

const BROWSER_SURFACE_PATTERN = /^(apps|public|packages[\\/]generated-client)[\\/]/;
// 占位符白名单：除既有约定外，补充文档/运行手册常用写法——
// 尖括号 <real OIDC client secret>、shell 变量 ${VAR}、掩码 ***、CHANGEME。
// （此前不认尖括号占位符 → 运行手册的占位符被误判为"已提交密钥"）
const PLACEHOLDER_SECRET_PATTERN =
  /^(?:|<[^>]*>|\$\{[^}]*\}|\$[A-Z_][A-Z0-9_]*|\*{3,}|change[-_ ]?me|replace[-_ ].*|.*placeholder.*|.*secret[-_ ]manager.*|.*do[-_ ]not[-_ ]commit.*|.*server[-_ ]side.*)$/i;

const failures = [];
const warnings = [];

function normalize(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function shouldSkip(relativePath) {
  const parts = normalize(relativePath).split('/');
  return parts.some((part) => EXCLUDED_PARTS.has(part));
}

function listFiles() {
  try {
    const output = execFileSync(
      'git',
      ['-c', 'core.quotePath=false', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    return output
      .toString('utf8')
      .split('\0')
      .map((file) => file.trim())
      .filter(Boolean)
      .filter((file) => !shouldSkip(file));
  } catch (error) {
    warnings.push(`git file listing failed, falling back to directory walk: ${error.message}`);
    const files = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(ROOT, fullPath);
        if (shouldSkip(relativePath)) continue;
        if (entry.isDirectory()) walk(fullPath);
        else files.push(relativePath);
      }
    };
    walk(ROOT);
    return files;
  }
}

function readTextFile(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) return null;
  const stat = fs.statSync(fullPath);
  // git ls-files --others 可能返回未跟踪的**目录**条目；直接 readFileSync 会抛 EISDIR 使门禁整体崩溃。
  if (!stat.isFile()) return null;
  if (stat.size > MAX_SCAN_BYTES) return null;

  const buffer = fs.readFileSync(fullPath);
  if (buffer.includes(0)) return null;
  return buffer.toString('utf8');
}

function knownSecretSubstrings() {
  return (process.env.OIDC_KNOWN_SECRET_SUBSTRINGS || '')
    .split(/[,\r\n]+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 6);
}

function inspectSecretAssignments(relativePath, source) {
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const envMatch = line.match(/^\s*OIDC_CLIENT_SECRET\s*=\s*(.*?)\s*$/);
    if (envMatch && !PLACEHOLDER_SECRET_PATTERN.test(envMatch[1])) {
      failures.push(`${relativePath}:${index + 1}: OIDC_CLIENT_SECRET must not contain a committed value`);
    }

    const jsMatch = line.match(/\bOIDC_CLIENT_SECRET\b\s*[:=]\s*['"`]([^'"`]+)['"`]/);
    if (jsMatch && !PLACEHOLDER_SECRET_PATTERN.test(jsMatch[1])) {
      failures.push(`${relativePath}:${index + 1}: OIDC_CLIENT_SECRET literal must not be committed`);
    }
  });
}

function inspectBrowserSurface(relativePath, source) {
  if (!BROWSER_SURFACE_PATTERN.test(normalize(relativePath))) return;
  if (/\bOIDC_CLIENT_SECRET\b|\bNEXT_PUBLIC_[A-Z0-9_]*CLIENT_SECRET\b/.test(source)) {
    failures.push(`${relativePath}: browser-facing code must not reference Nexus OIDC client secrets`);
  }
}

const files = listFiles();
const knownSubstrings = knownSecretSubstrings();
let scanned = 0;
let knownMatches = 0;

for (const file of files) {
  const source = readTextFile(file);
  if (source === null) continue;
  scanned += 1;

  inspectSecretAssignments(file, source);
  inspectBrowserSurface(file, source);

  for (const secret of knownSubstrings) {
    if (source.includes(secret)) {
      knownMatches += 1;
      failures.push(`${file}: contains one of the provided OIDC known secret substrings`);
    }
  }
}

console.log(
  `OIDC Secret Guardrail Check: files = ${scanned}, providedKnownSecretSubstrings = ${knownSubstrings.length}, knownMatches = ${knownMatches}, failures = ${failures.length}, warnings = ${warnings.length}`
);

for (const warning of warnings) console.warn(`- ${warning}`);

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
