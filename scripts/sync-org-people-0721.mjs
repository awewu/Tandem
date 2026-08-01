import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import xlsx from 'xlsx';
import { randomBytes, scryptSync } from 'node:crypto';

const DEFAULT_EXCEL_PATH = 'C:/Users/E00949/Desktop/人员信息管理_列表_0721.xlsx';
const TENANT_ID = 'default';
const DEPT_COLLECTION = 'org_hr_depts';
const EXTRAS_COLLECTION = 'auth_user_extras';
const PASSWORD_COLLECTION = 'auth_password_hashes';
const PROTECTED_EMAILS = new Set([
  'admin@rhenext.com',
  'admin@tandem.local',
  'steve.li@rhautt.com',
  'steve.li@hautt.com',
]);

const argv = process.argv.slice(2);
const args = new Set(argv);
const APPLY = args.has('--apply');
const DEFAULT_PASSWORD = argv.find((arg) => arg.startsWith('--default-password='))?.slice('--default-password='.length)
  ?? process.env.TANDEM_IMPORTED_USER_DEFAULT_PASSWORD
  ?? process.env.DEFAULT_USER_PASSWORD
  ?? '';
const EXCEL_PATH = argv.find((arg) => arg.startsWith('--file='))?.slice('--file='.length) ?? DEFAULT_EXCEL_PATH;
const DISABLE_SCOPE_ROOTS = argv
  .filter((arg) => arg.startsWith('--disable-root='))
  .map((arg) => arg.slice('--disable-root='.length).trim())
  .filter(Boolean);
const EMAIL_OVERRIDES = new Map(
  argv
    .filter((arg) => arg.startsWith('--email='))
    .map((arg) => {
      const payload = arg.slice('--email='.length).trim();
      const idx = payload.indexOf(':');
      if (idx < 0) return null;
      const key = payload.slice(0, idx).trim();
      const email = normalizeEmail(payload.slice(idx + 1));
      return key && email ? [key, email] : null;
    })
    .filter(Boolean),
);

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve('.env.local'));
loadEnvFile(path.resolve('.env'));

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function text(value) {
  return String(value ?? '').trim();
}

function dateText(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const raw = text(value);
  if (!raw) return null;
  const m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return raw;
}

function rowValue(row, idx, key) {
  const col = idx.get(key);
  return col === undefined ? '' : row[col];
}

function parseWorkbook(file) {
  const workbook = xlsx.readFile(file, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  const headerRowIndex = rows.findIndex((row) => row.includes('工作邮箱') && row.includes('姓名'));
  if (headerRowIndex < 0) throw new Error('未找到包含“姓名 / 工作邮箱”的表头行');
  const idx = new Map(rows[headerRowIndex].map((name, i) => [text(name), i]).filter(([name]) => name));

  const people = [];
  for (const row of rows.slice(headerRowIndex + 1)) {
    const name = text(rowValue(row, idx, '姓名'));
    const employeeId = text(rowValue(row, idx, '员工编码')) || null;
    const email = normalizeEmail(rowValue(row, idx, '工作邮箱')) ||
      normalizeEmail(EMAIL_OVERRIDES.get(name) ?? (employeeId ? EMAIL_OVERRIDES.get(employeeId) : ''));
    if (!email || !name || !email.includes('@')) continue;
    people.push({
      email,
      name,
      employeeId,
      departmentPath: text(rowValue(row, idx, '部门路径')),
      orgPath: text(rowValue(row, idx, '组织路径')),
      jobTitle: text(rowValue(row, idx, '职位')) || null,
      managerName: text(rowValue(row, idx, '直接上级')),
      phone: text(rowValue(row, idx, '手机号')) || null,
      workLocation: text(rowValue(row, idx, '工作地点')) || null,
      hireDate: dateText(rowValue(row, idx, '入职日期')),
      leaveDate: dateText(rowValue(row, idx, '离职日期')),
      status: text(rowValue(row, idx, '人员状态')),
    });
  }

  const dupes = people
    .map((p) => p.email)
    .filter((email, i, arr) => arr.indexOf(email) !== i);
  if (dupes.length) throw new Error(`Excel 中工作邮箱重复: ${Array.from(new Set(dupes)).join(', ')}`);

  return people;
}

function deptPathParts(p) {
  return text(p)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

function deptPathOf(dept, byId) {
  const parts = [dept.name];
  let cur = dept.parentId ? byId.get(dept.parentId) : null;
  const seen = new Set([dept.id]);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return parts.join('/');
}

function shallowDiff(before, patch) {
  const diff = {};
  for (const [key, after] of Object.entries(patch)) {
    const prev = before?.[key] ?? null;
    if ((prev ?? null) !== (after ?? null)) diff[key] = { before: prev, after };
  }
  return diff;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not set');
  if (APPLY && !DEFAULT_PASSWORD) {
    throw new Error('New users need a default password. Set TANDEM_IMPORTED_USER_DEFAULT_PASSWORD or pass --default-password=...');
  }

  const people = parseWorkbook(EXCEL_PATH);
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 8000 });
  await client.connect();

  try {
    await client.query('BEGIN');

    const userRows = await client.query(
      'SELECT id,email,name,roles,disabled,"departmentId","managerId","jobTitle","employeeId","hireDate","workLocation",phone,"tenantId" FROM "User" WHERE "deletedAt" IS NULL AND "tenantId" = $1',
      [TENANT_ID],
    );
    const extraRows = await client.query(
      'SELECT id,data FROM "KvStore" WHERE collection = $1 AND "tenantId" = $2',
      [EXTRAS_COLLECTION, TENANT_ID],
    );
    const deptRows = await client.query(
      'SELECT id,data FROM "KvStore" WHERE collection = $1 AND "tenantId" = $2',
      [DEPT_COLLECTION, TENANT_ID],
    );

    const extrasById = new Map(extraRows.rows.map((r) => [r.id, r.data ?? {}]));
    const users = userRows.rows.map((u) => ({ ...u, ...(extrasById.get(u.id) ?? {}) }));
    const usersByEmail = new Map(users.map((u) => [normalizeEmail(u.email), u]));
    const usersByEmployeeId = new Map();
    const usersByName = new Map();
    for (const user of users) {
      const employeeId = text(user.employeeId);
      if (employeeId) usersByEmployeeId.set(employeeId, [...(usersByEmployeeId.get(employeeId) ?? []), user]);
      const key = text(user.name).toLowerCase();
      usersByName.set(key, [...(usersByName.get(key) ?? []), user]);
    }

    const depts = deptRows.rows.map((r) => r.data);
    const deptById = new Map(depts.map((d) => [d.id, d]));
    const deptByPath = new Map(depts.map((d) => [deptPathOf(d, deptById), d]));
    const deptCreates = [];

    for (const person of people) {
      const parts = deptPathParts(person.departmentPath || person.orgPath);
      let parentId = null;
      let built = '';
      for (const part of parts) {
        built = built ? `${built}/${part}` : part;
        let dept = deptByPath.get(built);
        if (!dept) {
          dept = {
            id: makeId('dept'),
            name: part,
            parentId,
            headId: null,
            description: '',
            order: deptByPath.size,
            tenantId: TENANT_ID,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          deptByPath.set(built, dept);
          deptById.set(dept.id, dept);
          deptCreates.push({ path: built, dept });
        }
        parentId = dept.id;
      }
    }

    const peopleByEmail = new Map(people.map((p) => [p.email, p]));
    const matchedUserIds = new Set();
    const plannedUsersByName = new Map(usersByName);
    const personMatches = new Map();
    const userCreates = [];
    const userUpdates = [];
    const protectedSkips = [];
    const disableUsers = [];
    const managerWarnings = [];
    const selfManagerSkips = [];

    for (const person of people) {
      if (PROTECTED_EMAILS.has(person.email)) {
        protectedSkips.push(person.email);
        continue;
      }

      const employeeMatches = person.employeeId ? (usersByEmployeeId.get(person.employeeId) ?? []) : [];
      const nameMatches = usersByName.get(person.name.toLowerCase()) ?? [];
      const existing = usersByEmail.get(person.email)
        ?? (employeeMatches.length === 1 ? employeeMatches[0] : null)
        ?? (nameMatches.length === 1 ? nameMatches[0] : null);
      const id = existing?.id ?? makeId('user');
      const plannedUser = { ...(existing ?? {}), id, email: person.email, name: person.name };
      personMatches.set(person.email, { existing, id, person });

      const nameKey = person.name.toLowerCase();
      plannedUsersByName.set(nameKey, [
        ...(plannedUsersByName.get(nameKey) ?? []).filter((u) => u.id !== id),
        plannedUser,
      ]);
    }

    for (const { existing, id, person } of personMatches.values()) {
      matchedUserIds.add(id);

      const department = deptByPath.get(person.departmentPath || person.orgPath);
      const managerCandidatesAll = person.managerName
        ? (plannedUsersByName.get(person.managerName.toLowerCase()) ?? [])
        : [];
      const managerCandidates = managerCandidatesAll.filter((candidate) => candidate.id !== id);
      const manager = managerCandidates.length === 1 ? managerCandidates[0] : null;
      if (person.managerName && managerCandidatesAll.some((candidate) => candidate.id === id)) {
        selfManagerSkips.push({ email: person.email, name: person.name, managerName: person.managerName });
      } else if (person.managerName && managerCandidates.length !== 1) {
        managerWarnings.push({
          email: person.email,
          name: person.name,
          managerName: person.managerName,
          matches: managerCandidates.map((m) => `${m.name}<${m.email}>`),
        });
      }

      const patch = {
        email: person.email,
        name: person.name,
        departmentId: department?.id ?? null,
        managerId: manager?.id ?? null,
        jobTitle: person.jobTitle,
        employeeId: person.employeeId,
        hireDate: person.hireDate,
        workLocation: person.workLocation,
        phone: person.phone,
        disabled: person.status && person.status !== '在职' ? true : false,
      };

      if (!existing) {
        userCreates.push({
          person,
          patch,
          id,
          roles: ['employee'],
        });
      } else {
        const diff = shallowDiff(existing, patch);
        if (Object.keys(diff).length) userUpdates.push({ user: existing, person, patch, diff });
      }
    }

    for (const user of users) {
      const email = normalizeEmail(user.email);
      if (PROTECTED_EMAILS.has(email)) continue;
      const userDept = user.departmentId ? deptById.get(user.departmentId) : null;
      const userDeptPath = userDept ? deptPathOf(userDept, deptById) : '';
      const inDisableScope = DISABLE_SCOPE_ROOTS.length === 0
        ? false
        : DISABLE_SCOPE_ROOTS.some((root) => userDeptPath === root || userDeptPath.startsWith(`${root}/`));
      if (inDisableScope && !peopleByEmail.has(email) && !matchedUserIds.has(user.id) && user.disabled !== true) {
        disableUsers.push(user);
      }
    }

    const summary = {
      mode: APPLY ? 'apply' : 'dry-run',
      excelPeople: people.length,
      existingUsers: users.length,
      existingDepartments: depts.length,
      disableScopeRoots: DISABLE_SCOPE_ROOTS,
      departmentCreates: deptCreates.length,
      userCreates: userCreates.length,
      userUpdates: userUpdates.length,
      disabledBecauseMissingFromExcel: disableUsers.length,
      protectedSkips: protectedSkips.length,
      managerWarnings: managerWarnings.length,
      selfManagerSkips: selfManagerSkips.length,
    };

    console.log(JSON.stringify(summary, null, 2));
    console.log('\nDEPARTMENT_CREATES');
    for (const item of deptCreates) console.log(item.path);
    console.log('\nUSER_CREATES');
    for (const item of userCreates) console.log(`${item.person.name}\t${item.person.email}\t${item.person.departmentPath}`);
    console.log('\nUSER_UPDATES');
    for (const item of userUpdates.slice(0, 80)) {
      console.log(`${item.user.name}<${item.user.email}> => ${item.person.name}<${item.person.email}> ${JSON.stringify(item.diff)}`);
    }
    if (userUpdates.length > 80) console.log(`... ${userUpdates.length - 80} more`);
    console.log('\nDISABLE_USERS');
    for (const user of disableUsers) console.log(`${user.name}\t${user.email}`);
    console.log('\nPROTECTED_SKIPS');
    for (const email of protectedSkips) console.log(email);
    console.log('\nMANAGER_WARNINGS');
    for (const warning of managerWarnings.slice(0, 80)) console.log(JSON.stringify(warning));
    if (managerWarnings.length > 80) console.log(`... ${managerWarnings.length - 80} more`);
    console.log('\nSELF_MANAGER_SKIPS');
    for (const skip of selfManagerSkips) console.log(JSON.stringify(skip));

    if (!APPLY) {
      await client.query('ROLLBACK');
      return;
    }

    for (const { dept } of deptCreates) {
      await client.query(
        'INSERT INTO "KvStore" (collection,id,data,"tenantId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (collection,id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW()',
        [DEPT_COLLECTION, dept.id, dept, TENANT_ID],
      );
    }

    for (const item of userCreates) {
      await client.query(
        'INSERT INTO "User" (id,email,name,roles,disabled,"tenantId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW())',
        [item.id, item.person.email, item.person.name, item.roles, item.patch.disabled, TENANT_ID],
      );
      await client.query(
        'INSERT INTO "KvStore" (collection,id,data,"tenantId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (collection,id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW()',
        [PASSWORD_COLLECTION, item.id, { id: item.id, hash: hashPassword(DEFAULT_PASSWORD), historyHashes: [] }, TENANT_ID],
      );
      const extras = {
        id: item.id,
        departmentId: item.patch.departmentId,
        jobTitle: item.patch.jobTitle,
        managerId: item.patch.managerId,
        employeeId: item.patch.employeeId,
        hireDate: item.patch.hireDate,
        workLocation: item.patch.workLocation,
        phone: item.patch.phone,
      };
      await client.query(
        'INSERT INTO "KvStore" (collection,id,data,"tenantId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (collection,id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW()',
        [EXTRAS_COLLECTION, item.id, extras, TENANT_ID],
      );
    }

    for (const item of userUpdates) {
      await client.query(
        'UPDATE "User" SET email = $1, name = $2, disabled = $3, "updatedAt" = NOW() WHERE id = $4',
        [item.patch.email, item.patch.name, item.patch.disabled, item.user.id],
      );
      const existingExtras = extrasById.get(item.user.id) ?? { id: item.user.id };
      const extras = {
        ...existingExtras,
        id: item.user.id,
        departmentId: item.patch.departmentId,
        jobTitle: item.patch.jobTitle,
        managerId: item.patch.managerId,
        employeeId: item.patch.employeeId,
        hireDate: item.patch.hireDate,
        workLocation: item.patch.workLocation,
        phone: item.patch.phone,
      };
      await client.query(
        'INSERT INTO "KvStore" (collection,id,data,"tenantId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW()) ON CONFLICT (collection,id) DO UPDATE SET data = EXCLUDED.data, "updatedAt" = NOW()',
        [EXTRAS_COLLECTION, item.user.id, extras, TENANT_ID],
      );
    }

    for (const user of disableUsers) {
      await client.query('UPDATE "User" SET disabled = true, "updatedAt" = NOW() WHERE id = $1', [user.id]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
