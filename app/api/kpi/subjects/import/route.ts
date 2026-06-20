/**
 * KPI 科目 Excel 导入 · CHARTER-KPI-TTI §2.5
 *
 * POST /api/kpi/subjects/import?dryRun=1
 *   multipart/form-data, field name "file" (xlsx)
 *
 * 行为:
 *   - 按 code upsert (code 存在 = 更新, 不存在 = 创建)
 *   - parentCode 引用 (允许引用本文件其他行 / 库内已有科目)
 *   - 2-pass: 第一遍校验 + 建立 code→intent map, 第二遍按 (root → leaf) 拓扑顺序写入
 *   - dryRun=1 时仅返回 summary, 不动 DB
 *   - 每行返回 { row, ok, errors[], data?, createdId? }
 *
 * 权限: kpi.subject_admin
 * Audit: 每条 create/update 各打一条 audit log (与 UI 单条操作一致)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import {
  cellBool,
  cellString,
  parseSheet,
  SUBJECT_COLUMNS,
  type ImportSummary,
  type RowResult,
} from '@/lib/kpi/excel';
import type { KpiSubject } from '@/lib/types/kpi';

interface SubjectPayload {
  code: string;
  name: string;
  description?: string;
  parentCode?: string;
  defaultScope: 'bonus' | 'monitor';
  defaultMeasureType: 'numeric' | 'percentage' | 'currency' | 'count';
  defaultUnit?: string;
  active: boolean;
}

const SCOPES = new Set(['bonus', 'monitor']);
const MEASURES = new Set(['numeric', 'percentage', 'currency', 'count']);

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!hasKpiPermission(auth, 'kpi.subject_admin')) {
    return NextResponse.json({ error: 'forbidden: kpi.subject_admin required' }, { status: 403 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required (multipart field name: file)' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { rows: rawRows, missingColumns } = parseSheet(buffer, SUBJECT_COLUMNS);
  if (missingColumns.length > 0) {
    return NextResponse.json(
      { error: `missing_columns: ${missingColumns.join(', ')}` },
      { status: 400 },
    );
  }

  const store = getStore();
  const existing = await withTenantScope(store.kpiSubjects, auth.tenantId).list();
  const existingByCode = new Map(existing.map((s) => [s.code, s]));

  // Pass 1: parse + per-row field validation (parent 引用尚未校验)
  const parsed: Array<RowResult<SubjectPayload>> = rawRows.map((r) => {
    const row = r.__row;
    const errors: string[] = [];

    const code = cellString(r.code);
    const name = cellString(r.name);
    const description = cellString(r.description);
    const parentCode = cellString(r.parentCode);
    const defaultScope = cellString(r.defaultScope).toLowerCase();
    const defaultMeasureType = cellString(r.defaultMeasureType).toLowerCase();
    const defaultUnit = cellString(r.defaultUnit);
    const active = cellBool(r.active);

    if (!code) errors.push('code 必填');
    if (!name) errors.push('name 必填');
    if (!SCOPES.has(defaultScope)) errors.push(`defaultScope 必须是 bonus|monitor`);
    if (!MEASURES.has(defaultMeasureType))
      errors.push(`defaultMeasureType 必须是 numeric|percentage|currency|count`);
    if (active === null) errors.push(`active 必须是 true|false`);

    if (errors.length > 0) {
      return { row, ok: false, errors };
    }
    return {
      row,
      ok: true,
      errors: [],
      data: {
        code,
        name,
        description: description || undefined,
        parentCode: parentCode || undefined,
        defaultScope: defaultScope as 'bonus' | 'monitor',
        defaultMeasureType: defaultMeasureType as SubjectPayload['defaultMeasureType'],
        defaultUnit: defaultUnit || undefined,
        active: active!,
      },
    };
  });

  // 文件内重复 code 检测
  const seenCodes = new Map<string, number[]>(); // code -> row numbers
  for (const p of parsed) {
    if (p.ok && p.data) {
      const arr = seenCodes.get(p.data.code) ?? [];
      arr.push(p.row);
      seenCodes.set(p.data.code, arr);
    }
  }
  for (const [code, rs] of Array.from(seenCodes.entries())) {
    if (rs.length > 1) {
      for (const r of rs) {
        const p = parsed.find((x) => x.row === r)!;
        p.ok = false;
        p.errors.push(`code "${code}" 在文件内重复 (行 ${rs.join(', ')})`);
      }
    }
  }

  // Pass 2: parentCode 引用解析
  const intentByCode = new Map<string, RowResult<SubjectPayload>>();
  for (const p of parsed) {
    if (p.ok && p.data) intentByCode.set(p.data.code, p);
  }
  const codeExistsAfterImport = (code: string): boolean =>
    intentByCode.has(code) || existingByCode.has(code);

  // 循环引用检测 (parent chain)
  const chainExists = (code: string, visited: Set<string>): boolean => {
    if (visited.has(code)) return true;
    visited.add(code);
    const intent = intentByCode.get(code);
    const parentCode = intent?.data?.parentCode ?? existingByCode.get(code)?.parentId
      ? (intent?.data?.parentCode ??
        (existingByCode.get(code)?.parentId
          ? existing.find((s) => s.id === existingByCode.get(code)?.parentId)?.code
          : undefined))
      : undefined;
    if (!parentCode) return false;
    return chainExists(parentCode, visited);
  };

  for (const p of parsed) {
    if (!p.ok || !p.data?.parentCode) continue;
    const pc = p.data.parentCode;
    if (!codeExistsAfterImport(pc)) {
      p.ok = false;
      p.errors.push(`parentCode "${pc}" 不存在 (文件内 + 库内均无)`);
      continue;
    }
    if (chainExists(p.data.code, new Set())) {
      p.ok = false;
      p.errors.push(`parentCode "${pc}" 形成循环引用`);
    }
  }

  // 写入 (按拓扑顺序: 父先于子)
  if (!dryRun) {
    const written = new Set<string>();
    const writeRow = async (p: RowResult<SubjectPayload>): Promise<void> => {
      if (!p.ok || !p.data || written.has(p.data.code)) return;
      // 先写父
      if (p.data.parentCode) {
        const parentIntent = intentByCode.get(p.data.parentCode);
        if (parentIntent && !written.has(p.data.parentCode)) {
          await writeRow(parentIntent);
        }
      }
      const now = new Date().toISOString();
      const parentSubject = p.data.parentCode
        ? existingByCode.get(p.data.parentCode) ??
          existing.find((s) => s.code === p.data?.parentCode)
        : undefined;
      const parentId = parentSubject?.id;
      const level = parentSubject ? parentSubject.level + 1 : 1;
      const prev = existingByCode.get(p.data.code);

      if (prev) {
        const updated = await store.kpiSubjects.update(prev.id, {
          name: p.data.name,
          description: p.data.description,
          parentId,
          level,
          defaultScope: p.data.defaultScope,
          defaultMeasureType: p.data.defaultMeasureType,
          defaultUnit: p.data.defaultUnit,
          active: p.data.active,
          updatedAt: now,
        });
        existingByCode.set(p.data.code, updated);
        p.createdId = updated.id;
        await audit('kpi.subject_changed', auth.userId, {
          targetId: updated.id,
          targetType: 'kpi_subject',
          metadata: { source: 'excel_import', code: p.data.code, row: p.row },
        });
      } else {
        const created = await store.kpiSubjects.create({
          code: p.data.code,
          name: p.data.name,
          description: p.data.description,
          parentId,
          level,
          defaultScope: p.data.defaultScope,
          defaultMeasureType: p.data.defaultMeasureType,
          defaultUnit: p.data.defaultUnit,
          active: p.data.active,
          tenantId: auth.tenantId,
          createdBy: auth.userId,
          createdAt: now,
          updatedAt: now,
        } as Omit<KpiSubject, 'id'>);
        existingByCode.set(p.data.code, created);
        p.createdId = created.id;
        await audit('kpi.subject_changed', auth.userId, {
          targetId: created.id,
          targetType: 'kpi_subject',
          metadata: { source: 'excel_import', code: p.data.code, row: p.row },
        });
      }
      written.add(p.data.code);
    };

    for (const p of parsed) {
      try {
        await writeRow(p);
      } catch (e) {
        p.ok = false;
        p.errors.push(`写入失败: ${(e as Error).message}`);
      }
    }
  }

  const summary: ImportSummary<SubjectPayload> = {
    total: parsed.length,
    ok: parsed.filter((p) => p.ok).length,
    failed: parsed.filter((p) => !p.ok).length,
    rows: parsed,
    dryRun,
  };

  return NextResponse.json(summary);
}
