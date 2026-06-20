import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { withTenantScope } from '@/lib/multi-tenant/with-tenant-scope';
import { resolveOkrVisibleOwnerIds } from '@/lib/okr/visibility';

/**
 * GET /api/tandem-okr?cycleId=...&ownerId=...
 *
 * 返回:
 *   objectives  Objective[] + nested keyResults[]
 *   ttis        TTI[]  (按 ownerId/cycleId 过滤, 双轨独立 — KPI 与 TTI 平行)
 *   cycles      Cycle[]
 *
 * Q5 Tita 对标: 一次拉全 OKR 树 (含 TTI), 前端无须二次请求.
 *
 * 路由命名带 tandem- 前缀, 避免与现存 /app/okr/ UI 路由的潜在 API 冲突.
 */
export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const { searchParams } = new URL(req.url);
    const cycleId = searchParams.get('cycleId');
    const ownerId = searchParams.get('ownerId');
    const store = getStore();

    // Tenant isolation: 收敛到统一 withTenantScope (宪章 §23).
    let objectives = await withTenantScope(store.objectives, auth.tenantId).list();
    if (cycleId) objectives = objectives.filter((o) => o.cycleId === cycleId);
    if (ownerId) objectives = objectives.filter((o) => o.ownerId === ownerId);

    const allKrs = await store.keyResults.list();

    // 读权限 (按部门模型): 老板看全部; 部门领导看本部门; 员工只看自己.
    // 可见判定: objective 自己是可见 owner, 或其下任一 KR 的 owner 可见 (我负责的 KR).
    const visible = await resolveOkrVisibleOwnerIds(auth, store);
    if (visible) {
      objectives = objectives.filter(
        (o) =>
          visible.has(o.ownerId) ||
          allKrs.some((kr) => kr.objectiveId === o.id && visible.has(kr.ownerId)),
      );
    }

    const enriched = objectives.map((obj) => ({
      ...obj,
      keyResults: allKrs.filter((kr) => kr.objectiveId === obj.id),
    }));

    let ttis = await store.ttis.list();
    if (cycleId) ttis = ttis.filter((t) => t.cycleId === cycleId);
    if (ownerId) ttis = ttis.filter((t) => t.ownerId === ownerId);

    const cycles = await store.cycles.list();
    return NextResponse.json({ objectives: enriched, ttis, cycles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await req.json();
    const store = getStore();
    const now = new Date().toISOString();
    // Tenant isolation: withTenantScope.create 强制注入 auth.tenantId (防 P0-A).
    const obj = await withTenantScope(store.objectives, auth.tenantId).create({
      cycleId: body.cycleId,
      level: body.level ?? 'individual',
      parentObjectiveId: body.parentObjectiveId,
      // ownerId 默认 = sessionUser.id (D4: 防件被伪造); body 可显式传但需后续权限校验
      ownerId: body.ownerId ?? auth.userId,
      title: body.title,
      description: body.description,
      visibility: body.visibility ?? 'public',
      // A2.1a 新增字段, 接受 body 覆盖, 否则给默认
      weight: typeof body.weight === 'number' ? body.weight : 100,
      status: body.status ?? 'active',
      confidence: body.confidence ?? 'on-track',
      tags: Array.isArray(body.tags) ? body.tags : [],
      collaboratorIds: Array.isArray(body.collaboratorIds) ? body.collaboratorIds : [],
      watcherIds: Array.isArray(body.watcherIds) ? body.watcherIds : [],
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ objective: obj });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
