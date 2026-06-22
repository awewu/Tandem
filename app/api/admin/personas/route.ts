/**
 * /api/admin/personas · 分身阶段管理 (Owner/Admin)
 *
 * GET  列出本租户全部用户 + 其 Persona 阶段/委托级别 (没有 persona 的用户也列出, persona=null)
 *      供管理员手动调阶段用 (PATCH /api/admin/personas/:userId)。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot, getStore } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import type { PersonaStage, DelegationLevel } from '@/lib/types/persona';

interface PersonaRow {
  userId: string;
  name: string;
  email: string;
  roles: string[];
  stage: PersonaStage | null;
  delegationLevel: DelegationLevel | null;
  stageEnteredAt: string | null;
  hasPersona: boolean;
}

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const guard = requireRole(auth, ['owner', 'admin']);
  if (guard) return guard;

  try {
    const store = getStore();
    const users = store.auth ? await store.auth.users.list({ tenantId: auth.tenantId }) : [];
    const personas = await store.personas.list();
    const byUser = new Map(personas.map((p) => [p.userId, p]));

    const rows: PersonaRow[] = users
      .filter((u) => !u.disabled)
      .map((u) => {
        const p = byUser.get(u.id);
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          roles: u.roles ?? [],
          stage: p?.stage ?? null,
          delegationLevel: p?.delegationLevel ?? null,
          stageEnteredAt: p?.stageEnteredAt ?? null,
          hasPersona: !!p,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ ok: true, items: rows });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
