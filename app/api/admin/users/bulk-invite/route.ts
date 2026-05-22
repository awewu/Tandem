/**
 * POST /api/admin/users/bulk-invite
 *
 * 通讯录批量邀请 · CSV 或 Excel 上传 → 为每行生成邀请码
 *
 * Content-Type 接受:
 *   - application/json: { rows: [{ email, name?, departmentId?, presetRoles? }, ...], dryRun?, validHours?, baseUrl? }
 *   - multipart/form-data: file (.csv|.xlsx) + dryRun
 *
 * 返回:
 *   - results: [{ row, email, ok, code?, inviteId?, registerUrl?, error? }]
 *   - summary: { total, ok, failed, dryRun }
 *
 * 用于 pilot Day 1: 客户 IT 上传通讯录 → 生成邀请码列表 → 邮件群发
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { COOKIE_ACCESS, verifyAccessToken } from '@/lib/auth/session';
import { generateInviteCode, defaultExpiry } from '@/lib/auth/invite';

interface InviteRow {
  email: string;
  name?: string;
  departmentId?: string;
  presetRoles?: string[];
}

interface InviteResult {
  row: number;
  email: string;
  ok: boolean;
  code?: string;
  inviteId?: string;
  registerUrl?: string;
  error?: string;
}

const VALID_ROLES = new Set(['admin', 'champion', 'steward', 'manager', 'employee']);

function normalizeRoles(input: unknown): string[] {
  if (!input) return ['employee'];
  if (Array.isArray(input)) return input.filter((r): r is string => typeof r === 'string' && VALID_ROLES.has(r));
  if (typeof input === 'string') {
    return input
      .split(/[;,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((r) => VALID_ROLES.has(r));
  }
  return ['employee'];
}

async function parseCsv(text: string): Promise<InviteRow[]> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const idx = (k: string) => headers.indexOf(k);
  const out: InviteRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const email = cols[idx('email')] ?? '';
    if (!email) continue;
    out.push({
      email,
      name: cols[idx('name')],
      departmentId: cols[idx('departmentid')] || cols[idx('department')],
      presetRoles: normalizeRoles(cols[idx('roles')] || cols[idx('role')]),
    });
  }
  return out;
}

async function parseExcel(buffer: Buffer): Promise<InviteRow[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return rows
    .map((r) => {
      const email = String(r.email ?? r.Email ?? r.邮箱 ?? '').trim();
      if (!email) return null;
      return {
        email,
        name: String(r.name ?? r.Name ?? r.姓名 ?? '').trim() || undefined,
        departmentId: String(r.departmentId ?? r.department ?? r.部门 ?? '').trim() || undefined,
        presetRoles: normalizeRoles(r.roles ?? r.Role ?? r.角色),
      } as InviteRow;
    })
    .filter((r): r is InviteRow => r !== null);
}

export async function POST(req: NextRequest) {
  await boot();
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  if (!payload.roles.some((r) => r === 'admin' || r === 'champion')) {
    return NextResponse.json({ ok: false, error: '需要 admin / champion 角色' }, { status: 403 });
  }

  let rows: InviteRow[] = [];
  let dryRun = false;
  let validHours = 168; // 7 天
  const ct = req.headers.get('content-type') ?? '';
  let baseUrl = req.headers.get('origin') ?? '';

  try {
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file') as File | null;
      dryRun = form.get('dryRun') === '1';
      const vh = form.get('validHours');
      if (vh) validHours = Math.max(1, Math.min(720, Number(vh)));
      if (!file) return NextResponse.json({ ok: false, error: 'file 必填' }, { status: 400 });
      const buf = Buffer.from(await file.arrayBuffer());
      const name = file.name.toLowerCase();
      if (name.endsWith('.csv')) rows = await parseCsv(buf.toString('utf8'));
      else if (name.endsWith('.xlsx') || name.endsWith('.xls')) rows = await parseExcel(buf);
      else return NextResponse.json({ ok: false, error: '仅支持 .csv / .xlsx' }, { status: 400 });
    } else {
      const body = (await req.json()) as {
        rows?: InviteRow[];
        dryRun?: boolean;
        validHours?: number;
        baseUrl?: string;
      };
      rows = (body.rows ?? []).filter((r) => r && r.email);
      dryRun = !!body.dryRun;
      if (body.validHours) validHours = Math.max(1, Math.min(720, body.validHours));
      if (body.baseUrl) baseUrl = body.baseUrl;
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: `解析失败: ${(err as Error).message}` }, { status: 400 });
  }

  if (rows.length === 0) return NextResponse.json({ ok: false, error: '没有有效行' }, { status: 400 });
  if (rows.length > 500) return NextResponse.json({ ok: false, error: '单批最多 500 行' }, { status: 400 });

  const store = getStore();
  const results: InviteResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = row.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      results.push({ row: i + 1, email, ok: false, error: '邮箱格式错误' });
      continue;
    }
    if (dryRun) {
      results.push({ row: i + 1, email, ok: true });
      continue;
    }
    try {
      const { plainCode, codeHash } = generateInviteCode();
      const invite = await store.auth.invites.create({
        codeHash,
        email,
        presetRoles: row.presetRoles ?? ['employee'],
        presetDepartmentId: row.departmentId ?? null,
        tenantId: payload.tenantId,
        invitedById: payload.sub,
        maxUses: 1,
        expiresAt: defaultExpiry(validHours).toISOString(),
      });
      const registerUrl = baseUrl ? `${baseUrl}/register?invite=${encodeURIComponent(plainCode)}` : undefined;
      results.push({ row: i + 1, email, ok: true, code: plainCode, inviteId: invite.id, registerUrl });
    } catch (err) {
      results.push({ row: i + 1, email, ok: false, error: (err as Error).message });
    }
  }

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    dryRun,
  };

  return NextResponse.json({ ok: true, results, summary });
}
