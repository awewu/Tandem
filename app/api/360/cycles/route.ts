/**
 * GET  /api/360/cycles            — list (tenant 范围)
 * POST /api/360/cycles            — create draft (admin / hr / champion)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth, requireRole } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import type { Review360Cycle, Review360Question } from '@/lib/types/review-360';

const DEFAULT_QUESTIONS: Review360Question[] = [
  { id: 'q-perf', dimension: '业绩', prompt: '工作交付质量与效率如何?', rated: true, qualitative: false },
  { id: 'q-collab', dimension: '协作', prompt: '与你协作的体验如何? 有何具体例子?', rated: true, qualitative: true },
  { id: 'q-comm', dimension: '沟通', prompt: '沟通的清晰度和及时性?', rated: true, qualitative: false },
  { id: 'q-innov', dimension: '创新', prompt: '提出了哪些有价值的新想法?', rated: false, qualitative: true },
  { id: 'q-resp', dimension: '责任', prompt: '在压力/不确定下的担当?', rated: true, qualitative: false },
  { id: 'q-learn', dimension: '学习', prompt: '过去一段时间的成长?', rated: true, qualitative: false },
  { id: 'q-lead', dimension: '领导力', prompt: '影响他人/带动团队的表现?', rated: true, qualitative: false },
  { id: 'q-values', dimension: '价值观', prompt: '价值观一致度?', rated: true, qualitative: false },
];

export async function GET(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const store = getStore();
  const all = await store.review360Cycles.list({ tenantId: auth.tenantId });
  all.sort((a, b) => (a.startDate < b.startDate ? 1 : -1));
  return NextResponse.json({ cycles: all });
}

export async function POST(req: NextRequest) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const denied = requireRole(auth, [...DATA_STEWARD_ROLES, 'champion']);
  if (denied) return denied;
  try {
    const body = await req.json();
    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: 'name, startDate, endDate required' },
        { status: 400 },
      );
    }
    const store = getStore();
    const now = new Date().toISOString();
    const cycle = await store.review360Cycles.create({
      tenantId: auth.tenantId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      status: 'draft',
      questions: Array.isArray(body.questions) && body.questions.length > 0
        ? body.questions
        : DEFAULT_QUESTIONS,
      anonymizePeers: body.anonymizePeers !== false, // default true
      createdBy: auth.userId,
      createdAt: now,
      updatedAt: now,
    } as Omit<Review360Cycle, 'id'>);
    return NextResponse.json({ cycle });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
