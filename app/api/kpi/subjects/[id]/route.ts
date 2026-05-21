/**
 * KPI 科目单条 · CHARTER-KPI-TTI §2.4 (软删除 + 动态优化)
 *
 * PATCH  : 改 name/description/defaultUnit/parentId 等; active=false = 软删除
 * DELETE : 物理删除拒绝 (历史 KPI 数据完整性), 返回 400 提示软删
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { hasKpiPermission } from '@/lib/auth/kpi-perms';
import { audit } from '@/lib/audit/log';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const subject = await store.kpiSubjects.get(params.id);
  if (!subject || subject.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ subject });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!hasKpiPermission(auth, 'kpi.subject_admin')) {
    return NextResponse.json({ error: 'forbidden: kpi.subject_admin required' }, { status: 403 });
  }

  const store = getStore();
  const subject = await store.kpiSubjects.get(params.id);
  if (!subject || subject.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const allowed = ['name', 'description', 'defaultUnit', 'defaultScope', 'defaultMeasureType', 'parentId', 'active'];
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const k of allowed) if (k in body) patch[k] = body[k];

    // 改 code 禁止 (Excel 唯一键, 防止历史引用断裂)
    if ('code' in body && body.code !== subject.code) {
      return NextResponse.json({ error: 'code_immutable: 科目 code 不允许修改' }, { status: 400 });
    }

    // 改 parentId → 重算 level
    if ('parentId' in body && body.parentId !== subject.parentId) {
      let parentLevel = 0;
      if (body.parentId) {
        const parent = await store.kpiSubjects.get(body.parentId);
        if (!parent || parent.tenantId !== auth.tenantId) {
          return NextResponse.json({ error: 'parent_not_found' }, { status: 400 });
        }
        if (body.parentId === params.id) {
          return NextResponse.json({ error: 'cannot_be_own_parent' }, { status: 400 });
        }
        parentLevel = parent.level;
      }
      patch.level = parentLevel + 1;
    }

    // 软删除前检查 active=false 时是否还有 Kpi 引用 (允许软删但记录引用数, UI 提示)
    let referenceCount = 0;
    if (body.active === false && subject.active === true) {
      const allKpis = await store.kpiSubjects.list();
      void allKpis; // ts: suppress unused
      const kpiList = await store.kpis.list();
      referenceCount = kpiList.filter((k) => k.subjectId === params.id).length;
      // 不阻塞软删; 软删后历史 KPI 仍可读, 但不能新建
    }

    const updated = await store.kpiSubjects.update(params.id, patch);

    await audit('kpi.subject_changed', auth.userId, {
      targetId: params.id,
      targetType: 'kpi_subject',
      metadata: {
        action: body.active === false ? 'soft_delete' : 'update',
        fields: Object.keys(patch),
        referenceCount,
      },
    });

    return NextResponse.json({ subject: updated, referenceCount });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  // 物理删除一律拒绝, CHARTER §2.4 软删除规则
  void req;
  return NextResponse.json(
    {
      error: 'hard_delete_forbidden',
      message: '科目不可硬删除 (CHARTER §2.4). 改 active=false 软删除.',
    },
    { status: 405 },
  );
}
