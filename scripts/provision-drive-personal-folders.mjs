/**
 * Backfill org drive personal folders for every active organization user.
 *
 * Usage:
 *   node scripts/provision-drive-personal-folders.mjs
 *
 * Reads DATABASE_URL from process.env or .env.local. Idempotent: reuses existing
 * company/dept/person folders by nodeRole + ACL fingerprints.
 */
import fs from 'fs';
import pg from 'pg';

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      if (key !== 'DATABASE_URL') continue;
      process.env.DATABASE_URL = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      return;
    }
  }
}

function id() {
  return `drv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function now() {
  return new Date();
}

function hasPrincipal(file, mode, principal) {
  return (file.permissions?.[mode] ?? []).includes(principal);
}

function findCompanyShare(files) {
  return files.find((f) => f.isFolder && f.nodeRole === 'company_share' && !f.deletedAt)
    ?? files.find((f) => (
      f.isFolder
      && !f.deletedAt
      && !f.parentId
      && f.name === '公司共享区'
      && hasPrincipal(f, 'read', 'all')
    ));
}

function indexDeptRoots(files) {
  const map = new Map();
  for (const f of files) {
    if (!f.isFolder || f.deletedAt) continue;
    for (const p of f.permissions?.read ?? []) {
      if (!p.startsWith('dept:')) continue;
      const deptId = p.slice(5);
      const looksLikeDeptRoot = f.nodeRole === 'dept_root'
        || (f.ownerId === '__company__' && hasPrincipal(f, 'write', p));
      if (looksLikeDeptRoot) map.set(deptId, f);
    }
  }
  return map;
}

function isPersonalHomeForUser(file, userId) {
  return (
    file.isFolder
    && !file.deletedAt
    && file.ownerId === userId
    && (
      file.nodeRole === 'personal_home'
      || (
        hasPrincipal(file, 'read', `user:${userId}`)
        && hasPrincipal(file, 'write', `user:${userId}`)
        && (file.name === '我的工作区' || file.name.endsWith(' 的工作区'))
      )
    )
  );
}

async function createFolder(client, data) {
  const ts = now();
  const row = {
    id: id(),
    name: data.name,
    mimeType: 'application/x-directory',
    size: 0,
    parentId: data.parentId ?? null,
    ownerId: data.ownerId,
    tenantId: data.tenantId,
    storageKey: '',
    storageUrl: null,
    permissions: data.permissions,
    version: 1,
    isFolder: true,
    nodeRole: data.nodeRole,
    distillable: true,
    createdAt: ts,
    updatedAt: ts,
  };
  await client.query(
    `INSERT INTO "DriveFile" (
      id, name, "mimeType", size, "parentId", "ownerId", "tenantId", "storageKey", "storageUrl",
      permissions, version, "isFolder", "nodeRole", distillable, "createdAt", "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      row.id, row.name, row.mimeType, row.size, row.parentId, row.ownerId, row.tenantId,
      row.storageKey, row.storageUrl, row.permissions, row.version, row.isFolder, row.nodeRole,
      row.distillable, row.createdAt, row.updatedAt,
    ],
  );
  return row;
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const tenantId = process.argv.includes('--tenant')
    ? process.argv[process.argv.indexOf('--tenant') + 1]
    : 'default';
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const deptRows = await client.query(
    `SELECT data FROM "KvStore" WHERE collection = 'org_hr_depts' AND "tenantId" = $1`,
    [tenantId],
  );
  const depts = deptRows.rows.map((r) => r.data).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const users = (await client.query(
    `SELECT
       u.id,
       u.name,
       COALESCE(e.data->>'departmentId', u."departmentId") AS "departmentId",
       u.disabled,
       u."deletedAt"
     FROM "User" u
     LEFT JOIN "KvStore" e
       ON e.collection = 'auth_user_extras'
      AND e.id = u.id
      AND e."tenantId" = u."tenantId"
     WHERE u."tenantId" = $1`,
    [tenantId],
  )).rows.filter((u) => !u.disabled && !u.deletedAt);
  const files = (await client.query(
    `SELECT id, name, "parentId", "ownerId", "tenantId", permissions, "isFolder", "nodeRole", "createdAt", "deletedAt"
     FROM "DriveFile" WHERE "tenantId" = $1`,
    [tenantId],
  )).rows;

  let created = 0;
  let moved = 0;
  let merged = 0;

  let companyShare = findCompanyShare(files);
  if (!companyShare) {
    companyShare = await createFolder(client, {
      name: '公司共享区',
      parentId: null,
      ownerId: '__company__',
      tenantId,
      nodeRole: 'company_share',
      permissions: { read: ['all'], write: ['role:admin', 'role:owner'] },
    });
    files.push(companyShare);
    created += 1;
  }

  const deptById = new Map(depts.map((d) => [d.id, d]));
  const deptRootByDeptId = indexDeptRoots(files);
  async function ensureDeptRoot(dept, guard = 0) {
    const existing = deptRootByDeptId.get(dept.id);
    if (existing) {
      if (existing.nodeRole !== 'dept_root') {
        await client.query(
          `UPDATE "DriveFile" SET "nodeRole" = 'dept_root', "updatedAt" = $1 WHERE id = $2`,
          [now(), existing.id],
        );
        existing.nodeRole = 'dept_root';
      }
      return existing;
    }
    let parentId = companyShare.id;
    if (dept.parentId && guard < 64) {
      const parentDept = deptById.get(dept.parentId);
      if (parentDept) parentId = (await ensureDeptRoot(parentDept, guard + 1)).id;
    }
    const folder = await createFolder(client, {
      name: dept.name,
      parentId,
      ownerId: '__company__',
      tenantId,
      nodeRole: 'dept_root',
      permissions: { read: [`dept:${dept.id}`], write: [`dept:${dept.id}`] },
    });
    files.push(folder);
    deptRootByDeptId.set(dept.id, folder);
    created += 1;
    return folder;
  }

  for (const dept of depts) await ensureDeptRoot(dept);

  for (const user of users) {
    const parentId = user.departmentId && deptRootByDeptId.get(user.departmentId)
      ? deptRootByDeptId.get(user.departmentId).id
      : companyShare.id;
    const homes = files
      .filter((f) => isPersonalHomeForUser(f, user.id))
      .sort((a, b) => {
        const ac = (a.parentId ?? null) === parentId;
        const bc = (b.parentId ?? null) === parentId;
        if (ac !== bc) return ac ? -1 : 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    if (homes[0]) {
      if ((homes[0].parentId ?? null) !== parentId) {
        await client.query(
          `UPDATE "DriveFile" SET "parentId" = $1, "updatedAt" = $2 WHERE id = $3`,
          [parentId, now(), homes[0].id],
        );
        homes[0].parentId = parentId;
        moved += 1;
      }
      if (homes[0].nodeRole !== 'personal_home') {
        await client.query(
          `UPDATE "DriveFile" SET "nodeRole" = 'personal_home', "updatedAt" = $1 WHERE id = $2`,
          [now(), homes[0].id],
        );
        homes[0].nodeRole = 'personal_home';
      }
      for (const duplicate of homes.slice(1)) {
        await client.query(
          `UPDATE "DriveFile" SET "parentId" = $1, "updatedAt" = $2 WHERE "parentId" = $3 AND "deletedAt" IS NULL`,
          [homes[0].id, now(), duplicate.id],
        );
        await client.query(
          `UPDATE "DriveFile" SET "deletedAt" = $1, "updatedAt" = $1 WHERE id = $2`,
          [now(), duplicate.id],
        );
        duplicate.deletedAt = now();
        merged += 1;
      }
      continue;
    }
    const folder = await createFolder(client, {
      name: user.name ? `${user.name} 的工作区` : '我的工作区',
      parentId,
      ownerId: user.id,
      tenantId,
      nodeRole: 'personal_home',
      permissions: { read: [`user:${user.id}`], write: [`user:${user.id}`] },
    });
    files.push(folder);
    created += 1;
  }

  await client.end();
  console.log(`drive personal folders provisioned: users=${users.length}, created=${created}, moved=${moved}, merged=${merged}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
