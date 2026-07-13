/**
 * POST /api/persona/fork
 *
 * 分身编队 (B-037 · M4): 员工从已发布 AgentTemplate fork 一个技能分身。
 * Body: { templateId: string }
 *
 * 治理:
 *   - 租户隔离: 只能 fork 本租户模板 (403)。
 *   - forkSkillPersona 内含 ≤5 硬上限 + 未发布拒绝 + audit + 事件广播。
 *   - 业务错误 (上限/未发布) → 400; 模板不存在 → 404。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getStore } from '@/lib/storage/repository';
import { forkSkillPersona } from '@/lib/persona/fork';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: { templateId?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const templateId = typeof body.templateId === 'string' ? body.templateId : '';
  if (!templateId) {
    return NextResponse.json({ ok: false, error: 'templateId 必填' }, { status: 400 });
  }

  const tenantId = auth.tenantId ?? 'default';
  const store = getStore();
  const template = await store.agentTemplates.get(templateId);
  if (!template) {
    return NextResponse.json({ ok: false, error: '模板不存在' }, { status: 404 });
  }
  // 跨租户隔离: 只能 fork 本租户模板
  if (template.tenantId !== tenantId) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const persona = await forkSkillPersona(auth.userId, templateId, { tenantId });
    return NextResponse.json({ ok: true, persona });
  } catch (err) {
    // 上限 / 未发布 等业务错误
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
