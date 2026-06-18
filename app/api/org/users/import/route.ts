/**
 * POST /api/org/users/import
 *
 * Import contact-book HR fields from CSV/Excel and update existing tenant users.
 * Rows are matched by email. Unknown emails are reported as failures so account
 * creation still goes through the invite/register flow.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { listDepts, type HrDept } from '@/lib/org/departments';
import type { AuthUser } from '@/lib/storage/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ImportRow {
  email: string;
  name?: string;
  department?: string;
  jobTitle?: string;
  manager?: string;
  employeeId?: string;
  hireDate?: string;
  workLocation?: string;
  phone?: string;
  roles?: string[];
}

interface ImportResult {
  row: number;
  email: string;
  ok: boolean;
  action?: 'validated' | 'updated';
  error?: string;
}

const MANAGER_ROLES = new Set(['owner', 'admin', 'steward', 'champion', 'hr']);
const VALID_ROLES = new Set(['owner', 'admin', 'champion', 'steward', 'manager', 'employee', 'hr']);

function canImportContacts(roles: string[] | undefined): boolean {
  return (roles ?? []).some((r) => MANAGER_ROLES.has(r));
}

function cell(row: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null) return String(value).trim();
  }
  return '';
}

function normalizeRoles(value: string): string[] | undefined {
  if (!value) return undefined;
  const roles = value
    .split(/[;,\s]+/)
    .map((r) => r.trim().toLowerCase())
    .filter((r) => VALID_ROLES.has(r));
  return roles.length > 0 ? roles : undefined;
}

function parseCsv(text: string): ImportRow[] {
  const lines = text.replace(/^\ufeff/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => { raw[h] = cols[idx] ?? ''; });
    const email = raw.email || raw['邮箱'];
    if (!email) continue;
    rows.push({
      email,
      name: raw.name || raw['姓名'] || undefined,
      department: raw.departmentid || raw.department || raw['部门'] || undefined,
      jobTitle: raw.jobtitle || raw.title || raw['职务'] || raw['岗位'] || undefined,
      manager: raw.manageremail || raw.manager || raw['直属上级'] || raw['上级邮箱'] || undefined,
      employeeId: raw.employeeid || raw['工号'] || undefined,
      hireDate: raw.hiredate || raw['入职日期'] || undefined,
      workLocation: raw.worklocation || raw.location || raw['工作地点'] || undefined,
      phone: raw.phone || raw.mobile || raw['手机'] || undefined,
      roles: normalizeRoles(raw.roles || raw.role || raw['角色'] || ''),
    });
  }
  return rows;
}

async function parseExcel(buffer: Buffer): Promise<ImportRow[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return records
    .map((r): ImportRow | null => {
      const email = cell(r, ['email', 'Email', '邮箱']);
      if (!email) return null;
      return {
        email,
        name: cell(r, ['name', 'Name', '姓名']) || undefined,
        department: cell(r, ['departmentId', 'department', 'Department', '部门']) || undefined,
        jobTitle: cell(r, ['jobTitle', 'title', 'Title', '职务', '岗位']) || undefined,
        manager: cell(r, ['managerEmail', 'manager', 'Manager', '直属上级', '上级邮箱']) || undefined,
        employeeId: cell(r, ['employeeId', 'EmployeeId', '工号']) || undefined,
        hireDate: cell(r, ['hireDate', 'HireDate', '入职日期']) || undefined,
        workLocation: cell(r, ['workLocation', 'location', 'Location', '工作地点']) || undefined,
        phone: cell(r, ['phone', 'mobile', 'Mobile', '手机']) || undefined,
        roles: normalizeRoles(cell(r, ['roles', 'role', 'Role', '角色'])),
      };
    })
    .filter((r): r is ImportRow => r !== null);
}

function buildDeptResolver(depts: HrDept[]): (value: string | undefined) => string | null | undefined {
  const byId = new Map(depts.map((d) => [d.id, d.id]));
  const byName = new Map<string, string[]>();
  const byPath = new Map<string, string>();
  const deptById = new Map(depts.map((d) => [d.id, d]));
  const pathOf = (dept: HrDept): string => {
    const parts = [dept.name];
    let cur = dept.parentId ? deptById.get(dept.parentId) : undefined;
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? deptById.get(cur.parentId) : undefined;
    }
    return parts.join('/');
  };
  for (const dept of depts) {
    const nameKey = dept.name.trim().toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), dept.id]);
    byPath.set(pathOf(dept).trim().toLowerCase(), dept.id);
  }
  return (value) => {
    if (value === undefined) return undefined;
    const normalized = value.trim();
    if (!normalized) return null;
    const byExactId = byId.get(normalized);
    if (byExactId) return byExactId;
    const byExactPath = byPath.get(normalized.replace(/\s*\/\s*/g, '/').toLowerCase());
    if (byExactPath) return byExactPath;
    const nameMatches = byName.get(normalized.toLowerCase()) ?? [];
    return nameMatches.length === 1 ? nameMatches[0] : undefined;
  };
}

function resolveManager(value: string | undefined, usersByEmail: Map<string, AuthUser>, usersByName: Map<string, AuthUser[]>): string | null | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  const byEmail = usersByEmail.get(normalized.toLowerCase());
  if (byEmail) return byEmail.id;
  const byName = usersByName.get(normalized.toLowerCase()) ?? [];
  return byName.length === 1 ? byName[0].id : undefined;
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!canImportContacts(auth.roles)) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });
  const file = form.get('file') as File | null;
  const dryRun = form.get('dryRun') === '1';
  if (!file) return NextResponse.json({ ok: false, error: 'file required' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let rows: ImportRow[];
  try {
    if (name.endsWith('.csv')) rows = parseCsv(buf.toString('utf8'));
    else if (name.endsWith('.xlsx') || name.endsWith('.xls')) rows = await parseExcel(buf);
    else return NextResponse.json({ ok: false, error: '仅支持 .csv / .xlsx / .xls' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `解析失败: ${(err as Error).message}` }, { status: 400 });
  }

  if (rows.length === 0) return NextResponse.json({ ok: false, error: '没有有效行' }, { status: 400 });
  if (rows.length > 1000) return NextResponse.json({ ok: false, error: '单批最多 1000 行' }, { status: 400 });

  const store = getStore();
  const [users, depts] = await Promise.all([
    store.auth.users.list({ tenantId: auth.tenantId }),
    listDepts(auth.tenantId),
  ]);
  const usersByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const usersByName = new Map<string, AuthUser[]>();
  for (const user of users) {
    const key = user.name.trim().toLowerCase();
    usersByName.set(key, [...(usersByName.get(key) ?? []), user]);
  }
  const resolveDept = buildDeptResolver(depts);

  const results: ImportResult[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email.trim().toLowerCase();
    const user = usersByEmail.get(email);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      results.push({ row: i + 1, email, ok: false, error: '邮箱格式错误' });
      continue;
    }
    if (!user) {
      results.push({ row: i + 1, email, ok: false, error: '员工账号不存在，请先批量邀请或注册' });
      continue;
    }

    const departmentId = resolveDept(row.department);
    if (row.department !== undefined && departmentId === undefined) {
      results.push({ row: i + 1, email, ok: false, error: `部门不存在: ${row.department}` });
      continue;
    }
    const managerId = resolveManager(row.manager, usersByEmail, usersByName);
    if (row.manager !== undefined && managerId === undefined) {
      results.push({ row: i + 1, email, ok: false, error: `直属上级无法唯一匹配: ${row.manager}` });
      continue;
    }
    if (managerId && managerId === user.id) {
      results.push({ row: i + 1, email, ok: false, error: '直属上级不能是本人' });
      continue;
    }

    const patch: Partial<AuthUser> = {};
    if (row.name !== undefined) patch.name = row.name || user.name;
    if (departmentId !== undefined) patch.departmentId = departmentId;
    if (row.jobTitle !== undefined) patch.jobTitle = row.jobTitle || null;
    if (managerId !== undefined) patch.managerId = managerId;
    if (row.employeeId !== undefined) patch.employeeId = row.employeeId || null;
    if (row.hireDate !== undefined) patch.hireDate = row.hireDate || null;
    if (row.workLocation !== undefined) patch.workLocation = row.workLocation || null;
    if (row.phone !== undefined) patch.phone = row.phone || null;
    if (row.roles !== undefined) patch.roles = row.roles;

    if (!dryRun) await store.auth.users.update(user.id, patch);
    results.push({ row: i + 1, email, ok: true, action: dryRun ? 'validated' : 'updated' });
  }

  return NextResponse.json({
    ok: true,
    results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      dryRun,
    },
  });
}
