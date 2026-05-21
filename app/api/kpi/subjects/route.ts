/**
 * KPI 科目主数据 (KpiSubject) · CHARTER-KPI-TTI §2.4
 *
 * GET   : 列出当前租户所有科目 (可 ?active=true 过滤软删除)
 * POST  : 创建新科目 (kpi.subject_admin 权限)
 *
 * 单条改/软删走 /api/kpi/subjects/[id].
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import type { KpiSubject } from '@/lib/types/kpi';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const store = getStore();
  const all = await store.kpiSubjects.list();
  let mine = all.filter((s) => s.tenantId === auth.tenantId);

  const activeOnly = new URL(req.url).searchParams.get('active');
  if (activeOnly === 'true') mine = mine.filter((s) => s.active);
  if (activeOnly === 'false') mine = mine.filter((s) => !s.active);

  return NextResponse.json({ subjects: mine });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.subject_admin')) {
    return NextResponse.json({ error: 'forbidden: kpi.subject_admin required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body.code || !body.name || !body.defaultScope || !body.defaultMeasureType) {
      return NextResponse.json(
        { error: 'required: code / name / defaultScope / defaultMeasureType' },
        { status: 400 },
      );
    }
    if (!['bonus', 'monitor'].includes(body.defaultScope)) {
      return NextResponse.json({ error: 'defaultScope must be bonus or monitor' }, { status: 400 });
    }

    const store = getStore();

    // code 唯一性校验 (租户内)
    const existing = (await store.kpiSubjects.list()).find(
      (s) => s.tenantId === auth.tenantId && s.code === body.code,
    );
    if (existing) {
      return NextResponse.json({ error: `code_conflict: ${body.code} 已存在` }, { status: 409 });
    }

    // 校验 parentId + level 一致性
    let parentLevel = 0;
    if (body.parentId) {
      const parent = await store.kpiSubjects.get(body.parentId);
      if (!parent || parent.tenantId !== auth.tenantId) {
        return NextResponse.json({ error: 'parent_not_found' }, { status: 400 });
      }
      parentLevel = parent.level;
    }
    const level = parentLevel + 1;
    if (level > 5) {
      return NextResponse.json({ error: 'max_depth: 科目树深度不能超过 5 层' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const subject: Omit<KpiSubject, 'id'> = {
      parentId: body.parentId,
      code: body.code,
      name: body.name,
      description: body.description,
      level,
      defaultScope: body.defaultScope,
      defaultUnit: body.defaultUnit,
      defaultMeasureType: body.defaultMeasureType,
      active: true,
      tenantId: auth.tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    };

    const created = await store.kpiSubjects.create(subject);

    await audit('kpi.subject_changed', auth.userId, {
      targetId: created.id,
      targetType: 'kpi_subject',
      metadata: { action: 'create', code: created.code, level, defaultScope: created.defaultScope },
    });

    return NextResponse.json({ subject: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
