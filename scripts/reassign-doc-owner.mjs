#!/usr/bin/env node
/**
 * 一次性迁移: 把历史文档 (ownerId 为占位符, 默认 'me') 的所有者改成某真实用户.
 *
 * 背景: 早期 /documents 列表页创建文档时, 客户端误把 ownerId 写成 personId 'me'
 *       (而非真实登录用户 id), 导致这些文档无法被创建者管理/删除.
 *       服务端现已改为 ownerId = auth.userId, 此脚本修正存量数据.
 *
 * 用法:
 *   node scripts/reassign-doc-owner.mjs <目标用户邮箱> [旧ownerId=me] [--apply]
 *
 *   - 默认 dry-run, 只打印将要变更的文档; 加 --apply 才真正写入.
 *   - 同时把目标用户加入 permissions.read/write, 保证可读写.
 *
 * 例:
 *   node scripts/reassign-doc-owner.mjs zhangsan@ruihe.local            # 预览
 *   node scripts/reassign-doc-owner.mjs zhangsan@ruihe.local me --apply # 执行
 */
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('No DATABASE_URL in .env.local');
  process.exit(1);
}

const email = process.argv[2];
const oldOwner = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'me';
const apply = process.argv.includes('--apply');

if (!email) {
  console.error('用法: node scripts/reassign-doc-owner.mjs <目标用户邮箱> [旧ownerId=me] [--apply]');
  process.exit(1);
}

const sql = postgres(url.split('?')[0], { max: 1 });

try {
  const users = await sql`SELECT id, email, name, "tenantId" FROM "User" WHERE lower(email) = ${email.toLowerCase()} LIMIT 1`;
  if (users.length === 0) {
    console.error(`找不到邮箱为 ${email} 的用户`);
    await sql.end();
    process.exit(1);
  }
  const target = users[0];
  console.log(`目标用户: ${target.name} <${target.email}>  id=${target.id}  tenant=${target.tenantId}`);
  console.log(`迁移条件: ownerId = '${oldOwner}'  AND  tenantId = '${target.tenantId}'  AND  deletedAt IS NULL\n`);

  const docs = await sql`
    SELECT id, title, "ownerId", permissions
    FROM "Document"
    WHERE "ownerId" = ${oldOwner} AND "tenantId" = ${target.tenantId} AND "deletedAt" IS NULL
    ORDER BY "updatedAt" DESC
  `;

  if (docs.length === 0) {
    console.log('没有匹配的文档, 无需迁移.');
    await sql.end();
    return;
  }

  console.log(`将影响 ${docs.length} 个文档:`);
  for (const d of docs) console.log(`  - ${d.id}  ${d.title}`);

  if (!apply) {
    console.log('\n(dry-run) 未写入. 确认无误后加 --apply 执行.');
    await sql.end();
    return;
  }

  let n = 0;
  for (const d of docs) {
    const perms = d.permissions && typeof d.permissions === 'object' ? d.permissions : {};
    const read = Array.isArray(perms.read) ? perms.read : [];
    const write = Array.isArray(perms.write) ? perms.write : [];
    if (!read.includes(target.id)) read.push(target.id);
    if (!write.includes(target.id)) write.push(target.id);
    const nextPerms = { ...perms, read, write };
    await sql`
      UPDATE "Document"
      SET "ownerId" = ${target.id}, permissions = ${sql.json(nextPerms)}, "updatedAt" = now()
      WHERE id = ${d.id}
    `;
    n++;
  }
  console.log(`\n✅ 已把 ${n} 个文档的所有者改为 ${target.email}, 并加入读写权限.`);
  await sql.end();
} catch (e) {
  console.error('Error:', e.message);
  await sql.end();
  process.exit(1);
}
