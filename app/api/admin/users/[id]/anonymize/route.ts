/**
 * POST /api/admin/users/[id]/anonymize
 *
 * 宪章 §13.2 员工尊严铁律:
 *   「离职后 Persona 强制匿名化」
 *
 * 本端点由 admin/owner/manager 在员工离职时触发. 效果:
 *
 *   1. AuthUser 脱敏: email 改为 anon-{hash}@anonymized.local, name 改为
 *      "前员工-{shortHash}", disabled=true, 会话全部吊销
 *   2. Persona 匿名化: learningActive=false, communicationExamples 清空,
 *      dataOwnership.anonymizationPending=false + anonymizedAt 时戳
 *   3. 审计链写入 'data.anonymize_persona'
 *
 * 保留 (§13.1 数据归公司):
 *   - 所有 DecisionCard / Memory 签批 / Promotion 以 userId 为外键保持关联完整
 *   - 议事室历史决议保留 (公司资产)
 *   - Audit 链条不可删
 *
 * 鉴权: admin / owner / manager cookie. 不能匿名化自己.
 *
 * 幂等: 已 disabled 的用户再次调用返回 409.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { boot } from '@/lib/boot';
import { COOKIE_ACCESS, verifyAccessToken } from '@/lib/auth/session';
import { getStore } from '@/lib/storage/repository';
import { audit } from '@/lib/audit/log';
import { revokeAllSessions } from '@/lib/auth/native';

const ADMIN_ROLES = new Set(['admin', 'owner', 'manager']);

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await boot();

  // -------- 鉴权: 仅 admin/owner/manager --------
  const at = req.cookies.get(COOKIE_ACCESS)?.value;
  const payload = at ? verifyAccessToken(at) : null;
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
  }
  const isAdmin = (payload.roles ?? []).some((r) => ADMIN_ROLES.has(r));
  if (!isAdmin) {
    return NextResponse.json(
      { ok: false, error: '需要 admin / owner / manager 角色' },
      { status: 403 }
    );
  }

  const targetId = params.id;
  if (targetId === payload.sub) {
    return NextResponse.json(
      { ok: false, error: '不能匿名化自己 (操作审计要求)' },
      { status: 400 }
    );
  }

  const store = getStore();
  const target = await store.auth.users.findById(targetId);
  if (!target) {
    return NextResponse.json({ ok: false, error: 'user not found' }, { status: 404 });
  }

  // 幂等: 已 disabled 且 email 已是 anon 格式 → 409 (防重复脱敏)
  if (target.disabled && /^anon-[0-9a-f]+@anonymized\.local$/.test(target.email)) {
    return NextResponse.json(
      { ok: false, error: 'user already anonymized', email: target.email },
      { status: 409 }
    );
  }

  // -------- 1. 生成匿名 id/名字 --------
  const h = createHash('sha256').update(`${target.id}::${target.email}`).digest('hex');
  const shortHash = h.slice(0, 12);
  const anonEmail = `anon-${shortHash}@anonymized.local`;
  const anonName = `前员工-${shortHash.slice(0, 6)}`;

  // -------- 2. 脱敏 AuthUser --------
  await store.auth.users.update(targetId, {
    email: anonEmail,
    name: anonName,
    disabled: true,
    lockedUntil: new Date('9999-12-31T00:00:00.000Z').toISOString(),
    lastLoginIp: null,
  });

  // -------- 3. 吊销所有会话 --------
  try {
    await revokeAllSessions(targetId, 'user_anonymized');
  } catch {
    // 已无 session 也 ok
  }

  // -------- 4. 匿名化 Persona (如有) --------
  const personas = await store.personas.list({ userId: targetId } as never);
  const persona = personas[0];
  let personaAnonymized = false;
  if (persona) {
    await store.personas.update(persona.id, {
      learningActive: false,
      styleProfile: {
        ...persona.styleProfile,
        communicationExamples: [],
      },
      dataOwnership: {
        ...persona.dataOwnership,
        anonymizationPending: false,
        anonymizedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    personaAnonymized = true;
  }

  // -------- 5. 审计 --------
  await audit('data.anonymize_persona', payload.sub, {
    targetId,
    targetType: 'user',
    metadata: {
      originalEmailHash: h.slice(0, 16),
      anonEmail,
      personaAnonymized,
      personaId: persona?.id ?? null,
      manifestoReference: 'section 13.2',
    },
  });

  return NextResponse.json({
    ok: true,
    userId: targetId,
    anonEmail,
    anonName,
    personaAnonymized,
    sessionsRevoked: true,
  });
}
