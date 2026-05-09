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
import {
  proposePromotion,
  sign,
  reject,
  type SignerRole,
} from '@/lib/memory/promotion-flow';
import type { PromotionLevel } from '@/lib/types/memory';

export async function GET(req: NextRequest) {
  await boot();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const level = url.searchParams.get('level');

  const store = getStore();
  let promotions = await store.promotions.list();
  if (status) promotions = promotions.filter((p) => p.status === status);
  if (level) promotions = promotions.filter((p) => (p.level ?? 'company') === level);

  return NextResponse.json({ promotions });
}

export async function POST(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    if (!body.materialId || !body.proposedTitle || !body.proposedBody || !body.proposerId) {
      return NextResponse.json(
        { error: '缺必要字段: materialId, proposedTitle, proposedBody, proposerId' },
        { status: 400 }
      );
    }

    const promotion = await proposePromotion({
      materialId: body.materialId,
      proposedType: body.proposedType ?? 'sop',
      proposedTitle: body.proposedTitle,
      proposedBody: body.proposedBody,
      proposerId: body.proposerId,
      level: body.level as PromotionLevel | undefined,
      isEmergencyTrack: body.isEmergencyTrack === true,
    });

    return NextResponse.json({ promotion }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    const { promotionId, action, signerId } = body;
    if (!promotionId || !action || !signerId) {
      return NextResponse.json(
        { error: '缺必要字段: promotionId, action, signerId' },
        { status: 400 }
      );
    }

    if (action === 'sign') {
      if (!body.role) {
        return NextResponse.json({ error: 'role 必填 (sign action)' }, { status: 400 });
      }
      const updated = await sign(promotionId, signerId, body.role as SignerRole, body.comment);
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
