/**
 * /api/tandem/memory
 *
 * POST · 创建 Memory 条目
 *   - 个人记事本: ownershipLevel='personal', ownerUserId=当前用户 (自动)
 *   - 公司/部门/团队级: 需走 promotion-flow 签批 (不允许从此端口创建)
 *
 * body:
 *   {
 *     title: string,
 *     body: string,
 *     ownershipLevel?: 'personal' (默认),
 *     uiCategory?: 'requirement' | 'consensus' | 'standard' | 'context',
 *     priority?: 'low' | 'medium' | 'high' | 'critical',
 *     tags?: string[],
 *     parentId?: string | null,
 *     isActive?: boolean,
 *   }
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { getStore } from '@/lib/storage/repository';
import { requireAuth } from '@/lib/auth/require-auth';
import type { MemoryEntry, MemoryType } from '@/lib/types/memory';

const UI_CAT_TO_TYPE: Record<string, MemoryType> = {
  requirement: 'lesson',
  consensus: 'value',
  standard: 'sop',
  context: 'case',
};

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    if (!body.title || !body.body) {
      return NextResponse.json(
        { error: '缺必要字段: title, body' },
        { status: 400 }
      );
    }

    const ownershipLevel = body.ownershipLevel ?? 'personal';
    if (ownershipLevel !== 'personal') {
      return NextResponse.json(
        { error: '非个人 Memory 必须走 promotion-flow (POST /api/tandem/memory/promotion)' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const uiCategory = body.uiCategory ?? 'context';
    const inferredType = UI_CAT_TO_TYPE[uiCategory] ?? 'case';

    const entry: Omit<MemoryEntry, 'id'> = {
      type: body.type ?? inferredType,
      title: String(body.title).trim(),
      body: String(body.body),
      status: 'active',
      ownershipLevel: 'personal',
      ownerUserId: auth.userId,
      signers: [],
      referenceCount: 0,
      createdAt: now,
      updatedAt: now,
      uiCategory,
      priority: body.priority ?? 'medium',
      tags: Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t)) : [],
      parentId: body.parentId ?? null,
      isActive: body.isActive ?? true,
      version: 1,
    };

    const store = getStore();
    const created = await store.memories.create(entry);
    return NextResponse.json({ memory: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
