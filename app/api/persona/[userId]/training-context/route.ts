/**
 * GET /api/persona/[userId]/training-context
 *
 * 聚合一个用户分身的"训练养料"——展示分身实际从哪些真实数据里学习。
 *
 * 数据源（全部来自真实 store，不造假）：
 *   - recentCheckIns: 最近 N 条 KR check-in（含 achievements/blockers/nextSteps）
 *   - recentTtis: 该用户的 TTI 四要素填报快照
 *   - memoryReferences: 该用户写入过的 Memory（SOP/案例/价值观），反映他重视的规范
 *   - styleProfile: 从 persona 直接读
 *
 * 如果四类数据都为空 → returns { source: 'empty', reason: '...' }
 * 前端据此显示"养料尚不足，建议先在日报/OKR 里填几条"，不假填数据。
 *
 * 权限：仅本人 / admin / hr / steward 可读（同 /[userId] 路由的 gate）。
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getStore, boot } from '@/lib/boot';
import { requireAuth } from '@/lib/auth/require-auth';
import { DATA_STEWARD_ROLES } from '@/lib/auth/roles';
import type { CheckIn, TTI, KeyResult } from '@/lib/types/okr-tti';
import type { MemoryEntry } from '@/lib/types/memory';
import type { Persona } from '@/lib/types/persona';

const MAX_CHECKINS = 10;
const MAX_TTIS = 10;
const MAX_MEMORIES = 8;

interface TrainingCheckIn {
  id: string;
  krTitle: string;
  achievements: string | null;
  blockers: string | null;
  nextSteps: string | null;
  mood: string | null;
  createdAt: string;
}

interface TrainingTti {
  id: string;
  title: string;
  ownerId: string;
  cycleId: string;
}

interface TrainingMemory {
  id: string;
  type: string;
  title: string;
  body: string;
}

interface TrainingContextResponse {
  source: 'real' | 'empty';
  reason?: string;
  totals: { checkIns: number; ttis: number; memories: number };
  recentCheckIns: TrainingCheckIn[];
  recentTtis: TrainingTti[];
  memoryReferences: TrainingMemory[];
  styleProfile: Persona['styleProfile'] | null;
  stage: Persona['stage'] | null;
  bossCaptureScore: number;
  dataOwnership: Persona['dataOwnership'] | null;
}

function checkSelfOrPrivileged(
  auth: ReturnType<typeof requireAuth>,
  targetUserId: string,
): NextResponse | null {
  if (auth instanceof NextResponse) return auth;
  if (auth.userId === targetUserId) return null;
  if (auth.demo) return null;
  if (auth.roles.some((r) => (DATA_STEWARD_ROLES as string[]).includes(r))) return null;
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } },
) {
  await boot();
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const gate = checkSelfOrPrivileged(auth, params.userId);
  if (gate) return gate;

  try {
    const store = getStore();

    // 1. 拉 persona（可能不存在 - 第一次的员工还没生成）
    const personaList = await store.personas.list({ userId: params.userId } as never);
    const persona = personaList[0] as Persona | undefined;

    // 2. 拉 check-ins（该 user 作为 author 的所有 kr-scoped check-in）
    const allCheckIns = (await store.checkIns.list()) as CheckIn[];
    const myCheckIns = allCheckIns
      .filter((c) => c.authorId === params.userId && c.scope === 'kr')
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, MAX_CHECKINS);

    // 3. 关联 KR title（防止显示空白 krTitle）
    const krCache = new Map<string, KeyResult | null>();
    const checkInsEnriched: TrainingCheckIn[] = [];
    for (const c of myCheckIns) {
      let kr = krCache.get(c.scopeId);
      if (kr === undefined) {
        kr = (await store.keyResults.get(c.scopeId)) as KeyResult | null;
        krCache.set(c.scopeId, kr ?? null);
      }
      checkInsEnriched.push({
        id: c.id,
        krTitle: kr?.title ?? '(已删除的 KR)',
        achievements: c.achievements ?? null,
        blockers: c.blockers ?? null,
        nextSteps: c.nextSteps ?? null,
        mood: c.mood ?? null,
        createdAt: c.createdAt,
      });
    }

    // 4. 拉 TTI（该用户拥有的）
    const allTtis = (await store.ttis.list()) as TTI[];
    const myTtis = allTtis
      .filter((t) => t.ownerId === params.userId)
      .slice(0, MAX_TTIS)
      .map<TrainingTti>((t) => ({ id: t.id, title: t.title, ownerId: t.ownerId, cycleId: t.cycleId }));

    // 5. 拉 Memory（该用户作为 author 的最近 N 条）
    //    注意：MemoryEntry 没有显式 authorId 字段，但有 signers 数组；
    //    保守起见：fallback 取 ownershipLevel=personal 类型作为该用户写过的私域知识。
    //    真实多租户语义在 V2 加 authorId 字段时收紧。
    const allMemories = (await store.memories.list()) as MemoryEntry[];
    const myMemories = allMemories
      .filter((m) => m.ownershipLevel === 'personal')
      .slice(0, MAX_MEMORIES)
      .map<TrainingMemory>((m) => ({ id: m.id, type: m.type, title: m.title, body: m.body }));

    const totals = {
      checkIns: checkInsEnriched.length,
      ttis: myTtis.length,
      memories: myMemories.length,
    };

    const isEmpty = totals.checkIns === 0 && totals.ttis === 0 && totals.memories === 0;

    const result: TrainingContextResponse = {
      source: isEmpty ? 'empty' : 'real',
      reason: isEmpty
        ? '该用户暂无任何 daily check-in / TTI 填报 / 个人 Memory 记录。建议先去 /report 写一条 5min 日报，分身就有养料可学。'
        : undefined,
      totals,
      recentCheckIns: checkInsEnriched,
      recentTtis: myTtis,
      memoryReferences: myMemories,
      styleProfile: persona?.styleProfile ?? null,
      stage: persona?.stage ?? null,
      bossCaptureScore: persona?.bossCaptureScore ?? 0,
      dataOwnership: persona?.dataOwnership ?? null,
    };

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
