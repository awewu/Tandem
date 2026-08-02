/**
 * /api/tandem/memory/promotion
 *
 * Memory 升级签批 (宪章 §8.1 三级签批流程).
 *
 * GET    : 列出所有 promotion requests (可按 status / level filter)
 * POST   : 创建 promotion (proposePromotion)
 *   body: { materialId, proposedType, proposedTitle, proposedBody, proposerId, level?, isEmergencyTrack? }
 * PATCH  : 签字或拒绝 *   body: { promotionId, action: 'sign'|'reject', signerId, role?, comment?, reason? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { hasInternalRole, MEMORY_GOVERNANCE_ROLES } from '@/lib/auth/roles';
import {
  proposePromotion,
  sign,
  reject,
  authorizeSignerRole,
  type SignerRole,
} from '@/lib/memory/promotion-flow';
import type { PromotionLevel } from '@/lib/types/memory';
import { withApiLog } from '@/lib/api-log/with-api-log';

async function GETApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // 治理队列含未批准的 proposedBody, 仅治理工作台角色可浏览.
  const denied = requireRole(auth, MEMORY_GOVERNANCE_ROLES);
  if (denied) return denied;

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const level = url.searchParams.get('level');

  const store = getStore();
  let promotions = await store.promotions.list();
  if (status) promotions = promotions.filter((p) => p.status === status);
  if (level) promotions = promotions.filter((p) => (p.level ?? 'company') === level);

  return NextResponse.json({ promotions });
}

export const GET = withApiLog(GETApiHandler, { route: '/api/tandem/memory/promotion' });

async function POSTApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  // 提议入库 = 任何正式员工可发起 (宪章: 任何员工); 外部协作者禁止提议企业知识.
  if (!auth.demo && !hasInternalRole(auth.roles)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  try {
    const body = await req.json();
    if (!body.materialId || !body.proposedTitle || !body.proposedBody) {
      return NextResponse.json(
        { error: '缺必要字段: materialId, proposedTitle, proposedBody' },
        { status: 400 }
      );
    }

    const promotion = await proposePromotion({
      materialId: body.materialId,
      proposedType: body.proposedType ?? 'sop',
      proposedTitle: body.proposedTitle,
      proposedBody: body.proposedBody,
      // 身份绑定: proposer 恒为登录用户, 忽略请求体 (防伪造污染审计 + 绕过 steward 冲突校验).
      proposerId: auth.userId,
      level: body.level as PromotionLevel | undefined,
      isEmergencyTrack: body.isEmergencyTrack === true,
    });

    return NextResponse.json({ promotion }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export const POST = withApiLog(POSTApiHandler, { route: '/api/tandem/memory/promotion' });

async function PATCHApiHandler(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, MEMORY_GOVERNANCE_ROLES);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { promotionId, action } = body;
    if (!promotionId || !action) {
      return NextResponse.json(
        { error: '缺必要字段: promotionId, action' },
        { status: 400 }
      );
    }
    // 身份绑定: 签字人/决议人恒为登录用户, 忽略请求体 signerId (防冒名签批).
    const signerId = auth.userId;

    if (action === 'sign') {
      if (!body.role) {
        return NextResponse.json({ error: 'role 必填 (sign action)' }, { status: 400 });
      }
      const role = body.role as SignerRole;
      // 角色身份校验: 自称的签字角色必须与登录用户真实持有的系统角色相符.
      if (!auth.demo && !authorizeSignerRole(role, auth.roles)) {
        return NextResponse.json(
          { error: `无权以 '${role}' 身份签字 (角色不符)` },
          { status: 403 }
        );
      }
      const updated = await sign(promotionId, signerId, role, body.comment);
      return NextResponse.json({ promotion: updated });
    }

    if (action === 'reject') {
      const updated = await reject(promotionId, signerId, body.reason ?? '未提供原因');
      return NextResponse.json({ promotion: updated });
    }

    return NextResponse.json(
      { error: `未知 action: ${action} (允许 sign / reject)` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export const PATCH = withApiLog(PATCHApiHandler, { route: '/api/tandem/memory/promotion' });
