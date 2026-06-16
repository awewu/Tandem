/**
 * GET  /api/admin/ai-settings  — 读取当前 AI 配置 (key 字段脱敏)
 * PUT  /api/admin/ai-settings  — 更新 AI 配置 (owner/admin only)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { getAiSettings, upsertAiSettings, maskAiSettings } from '@/lib/settings/ai-settings';
import type { AiSettingsPatch } from '@/lib/types/ai-settings';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((r) => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
  }

  const settings = await getAiSettings(auth.tenantId);
  return NextResponse.json({ settings: maskAiSettings(settings) });
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!auth.roles.some((r) => ['owner', 'admin'].includes(r))) {
    return NextResponse.json({ error: '仅管理员可修改' }, { status: 403 });
  }

  let patch: AiSettingsPatch;
  try {
    patch = await req.json();
  } catch {
    return NextResponse.json({ error: '请求体格式错误' }, { status: 400 });
  }

  const updated = await upsertAiSettings(patch, auth.userId, auth.tenantId);
  return NextResponse.json({ settings: maskAiSettings(updated) });
}
