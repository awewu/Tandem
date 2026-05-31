/**
 * KPI 实例 · 通道 A 目标设定 · CHARTER-KPI-TTI §2
 *
 * GET   : 列出 (支持 ?cycleId / ?scope / ?level / ?subjectId / ?assigneeId 过滤)
 * POST  : 创建新 KPI (周期需 status=draft, kpi.write 权限)
 *
 * 注意:
 *   - currentValue 不允许在此 POST 设, 必须走通道 B (ERP) 或 C (manual-entry)
 *   - scope 一旦设定 + 周期 active 后 frozen (见 [id]/route.ts PATCH 校验)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';
import { KPI_LEVEL_ORDER, type Kpi, type KpiLevel, type KpiScope } from '@/lib/types/kpi';

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  const scope = url.searchParams.get('scope') as KpiScope | null;
  const level = url.searchParams.get('level') as KpiLevel | null;
  const subjectId = url.searchParams.get('subjectId');
  const assigneeId = url.searchParams.get('assigneeId');

  const store = getStore();
  let kpis = (await store.kpis.list()).filter((k) => k.tenantId === auth.tenantId);
  if (cycleId) kpis = kpis.filter((k) => k.cycleId === cycleId);
  if (scope) kpis = kpis.filter((k) => k.scope === scope);
  if (level) kpis = kpis.filter((k) => k.level === level);
  if (subjectId) kpis = kpis.filter((k) => k.subjectId === subjectId);
  if (assigneeId) kpis = kpis.filter((k) => k.assigneeId === assigneeId);

  return NextResponse.json({ kpis });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!hasKpiPermission(auth, 'kpi.write')) {
    return NextResponse.json({ error: 'forbidden: kpi.write required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const required = ['cycleId', 'subjectId', 'level', 'assigneeId', 'title', 'measureType', 'targetValue', 'scope'];
    for (const k of required) {
      if (body[k] === undefined || body[k] === null || body[k] === '') {
        return NextResponse.json({ error: `required: ${k}` }, { status: 400 });
      }
    }
    if (!['bonus', 'monitor'].includes(body.scope)) {
      return NextResponse.json({ error: 'scope must be bonus or monitor' }, { status: 400 });
    }
    if (!(body.level in KPI_LEVEL_ORDER)) {
      return NextResponse.json({ error: 'level must be one of individual/department/system/business_unit/company' }, { status: 400 });
    }

    const store = getStore();

    // 周期校验: 必须 draft (active 后 target 锁死, 不允许新建)
    const cycle = await store.kpiCycles.get(body.cycleId);
    if (!cycle || cycle.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'cycle_not_found' }, { status: 400 });
    }
    if (cycle.status !== 'draft') {
      return NextResponse.json(
        { error: `cycle_locked: 周期 ${cycle.name} 状态为 ${cycle.status}, 不可新增 KPI` },
        { status: 400 },
      );
    }

    // 科目校验
    const subject = await store.kpiSubjects.get(body.subjectId);
    if (!subject || subject.tenantId !== auth.tenantId) {
      return NextResponse.json({ error: 'subject_not_found' }, { status: 400 });
    }
    if (!subject.active) {
      return NextResponse.json({ error: 'subject_inactive: 科目已软删除, 不可新建 KPI' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const kpi: Omit<Kpi, 'id'> = {
      cycleId: body.cycleId,
      subjectId: body.subjectId,
      level: body.level,
      parentKpiId: body.parentKpiId,
      assigneeId: body.assigneeId,
      departmentId: body.departmentId,
      title: body.title,
      description: body.description,
      measureType: body.measureType,
      startValue: Number(body.startValue ?? 0),
      targetValue: Number(body.targetValue),
      currentValue: Number(body.startValue ?? 0), // currentValue 起始 = startValue, 后续仅通道 B/C 改
      unit: body.unit ?? subject.defaultUnit,
      weight: Number(body.weight ?? 0),
      dataSource: 'pending', // 尚未采集
      scope: body.scope,
      tenantId: auth.tenantId,
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    };

    const created = await store.kpis.create(kpi);

    await audit('kpi.target_set', auth.userId, {
      targetId: created.id,
      targetType: 'kpi',
      metadata: {
        cycleId: body.cycleId,
        subjectCode: subject.code,
        level: body.level,
        scope: body.scope,
        assigneeId: body.assigneeId,
        targetValue: kpi.targetValue,
        weight: kpi.weight,
      },
    });

    return NextResponse.json({ kpi: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
