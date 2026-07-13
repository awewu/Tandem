#!/usr/bin/env node
/**
 * cleanup-users.mjs — 按姓名清理用户 (软删 deletedAt + 禁用 + 撤销会话).
 *
 * 与应用一致的软删语义: User.deletedAt 置为当前时间后,
 *   findByEmail / findById / list 均会排除该行 (lib/storage/drizzle-store.ts) → 无法登录、
 *   不再出现在组织/成员列表; 其历史记录 (OKR/日报/IM 等) 保留, 不破坏引用完整性.
 *
 * 用法:
 *   node scripts/cleanup-users.mjs            # dry-run, 只列出将被清理的用户
 *   node scripts/cleanup-users.mjs --apply    # 实际执行软删
 */

import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
loadEnvFile(join(root, '.env'));
loadEnvFile(join(root, '.env.local'));

if (!process.env.DATABASE_URL) {
  console.error('[cleanup] FATAL: DATABASE_URL not set');
  process.exit(1);
}

const NAMES = ['杨亮亮', '李雪', '刘文宗', '李欣', '付厚林', '郑波'];
const APPLY = process.argv.includes('--apply');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const { rows } = await client.query(
    `SELECT id, email, name, roles, disabled, "deletedAt", "createdAt"
       FROM "User"
      WHERE name = ANY($1::text[])
      ORDER BY name`,
    [NAMES],
  );

  const found = rows.map((r) => r.name);
  const missing = NAMES.filter((n) => !found.includes(n));

  console.log(`\n匹配到 ${rows.length} 个用户 (目标 ${NAMES.length} 个):`);
  for (const r of rows) {
    const flags = [];
    if (r.disabled) flags.push('已禁用');
    if (r.deletedAt) flags.push('已软删');
    console.log(
      `  - ${r.name.padEnd(6)} | ${r.email.padEnd(28)} | roles=[${(r.roles ?? []).join(',')}]` +
        (flags.length ? ` | ${flags.join(',')}` : ''),
    );
  }
  if (missing.length) {
    console.log(`\n⚠ 精确未找到: ${missing.join('、')} — 尝试模糊匹配:`);
    for (const n of missing) {
      const { rows: fz } = await client.query(
        `SELECT name, email, roles, disabled, "deletedAt" FROM "User"
          WHERE name LIKE $1 OR name LIKE $2 ORDER BY name`,
        [`%${n}%`, `%${n[0]}%`],
      );
      if (fz.length === 0) {
        console.log(`    ${n}: 无任何相似记录`);
      } else {
        for (const r of fz) {
          console.log(
            `    [${n}] ~ ${r.name} | ${r.email} | roles=[${(r.roles ?? []).join(',')}]` +
              (r.deletedAt ? ' | 已软删' : '') + (r.disabled ? ' | 已禁用' : ''),
          );
        }
      }
    }
  }

  const targets = rows.filter((r) => !r.deletedAt);
  if (targets.length === 0) {
    console.log('\n没有需要清理的活跃用户 (匹配到的均已软删).');
    return;
  }

  if (!APPLY) {
    console.log(`\n[dry-run] 将软删 ${targets.length} 个用户. 确认无误后加 --apply 执行.`);
    return;
  }

  const ids = targets.map((r) => r.id);
  await client.query('BEGIN');
  try {
    // 1) 软删 + 禁用
    const upd = await client.query(
      `UPDATE "User" SET "deletedAt" = now(), disabled = true, "updatedAt" = now()
        WHERE id = ANY($1::text[])`,
      [ids],
    );
    // 2) 撤销其所有会话 (KvStore auth_session, data->>'userId' 命中且未撤销)
    const revoked = await client.query(
      `UPDATE "KvStore"
          SET data = jsonb_set(
                       jsonb_set(data, '{revokedAt}', to_jsonb(now()::text), true),
                       '{revokeReason}', '"user_cleanup"', true),
              "updatedAt" = now()
        WHERE collection = 'auth_session'
          AND data->>'userId' = ANY($1::text[])
          AND (data->>'revokedAt') IS NULL`,
      [ids],
    );
    await client.query('COMMIT');
    console.log(`\n✅ 已清理: 软删+禁用 ${upd.rowCount} 个用户, 撤销 ${revoked.rowCount} 个会话.`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}

main()
  .catch((e) => {
    console.error('[cleanup] failed:', e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
