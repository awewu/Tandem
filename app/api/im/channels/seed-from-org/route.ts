/**
 * POST /api/im/channels/seed-from-org
 *
 * 一键按组织架构建部门群 (IM P1, 2026-05-10).
 *
 * Body:
 *   {
 *     operatorId: string,
 *     specs: [{ departmentId, name, memberIds: [], level: 'department'|'team' }, ...]
 *   }
 *
 * 幂等: 已存在 departmentId + autoCreated=true 的频道会跳过, 返回 existingChannelId.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { seedDepartmentChannels, type DepartmentSpec } from '@/lib/im/service';

export async function POST(req: NextRequest) {
  await boot();
  try {
    const body = await req.json();
    if (!body.operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }
    if (!Array.isArray(body.specs)) {
      return NextResponse.json({ error: 'specs must be array' }, { status: 400 });
    }
    // 基础校验
    for (const s of body.specs as DepartmentSpec[]) {
      if (!s.departmentId || !s.name || !Array.isArray(s.memberIds) || !s.level) {
        return NextResponse.json(
          { error: 'each spec must have departmentId/name/memberIds/level' },
          { status: 400 }
        );
      }
      if (s.level !== 'department' && s.level !== 'team') {
        return NextResponse.json({ error: 'level must be department or team' }, { status: 400 });
      }
    }
    const result = await seedDepartmentChannels(body.specs, body.operatorId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }
}
