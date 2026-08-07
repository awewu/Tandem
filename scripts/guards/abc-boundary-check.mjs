#!/usr/bin/env node
/**
 * guard:abc-boundary — 校验每个 NestJS 域都在 A/B/C 域映射矩阵里有归属（无孤儿域=无阉割）。
 * 运行：node scripts/guards/abc-boundary-check.mjs
 * 注：Phase 0 脚手架版——以"归位完整性"为主；跨域直写 OLTP 的静态检查在 Phase 1 增强。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = resolve(__dirname, '../../services/api/src/modules');
const MATRIX = resolve(__dirname, '../../docs/architecture/NEXUS-ABC-DOMAIN-MATRIX.md');

const IGNORE = new Set(['common']); // 基础设施，非业务域
let matrix;
try { matrix = readFileSync(MATRIX, 'utf8'); }
catch { console.error('❌ 缺 A/B/C 域映射矩阵:', MATRIX); process.exit(1); }

const domains = readdirSync(MODULES_DIR).filter((d) => {
  try { return statSync(join(MODULES_DIR, d)).isDirectory() && !IGNORE.has(d); } catch { return false; }
});

const orphans = domains.filter((d) => !matrix.includes(d));
if (orphans.length) {
  console.error(`❌ guard:abc-boundary 失败：${orphans.length} 个域未在 A/B/C 矩阵归位（阉割风险）:`);
  for (const o of orphans) console.error('  - ' + o);
  console.error('  → 请在 docs/architecture/NEXUS-ABC-DOMAIN-MATRIX.md 归位。');
  process.exit(1);
}
console.log(`✅ guard:abc-boundary 通过：${domains.length} 个域全部在 A/B/C 矩阵归位（无孤儿/无阉割）。`);
