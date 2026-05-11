/**
 * 360 store ↔ API sync (A2.3)
 *
 * 适配:
 *   - zustand 用 number ms epoch
 *   - 后端 ISO string + tenantId/createdBy 由服务端注入
 */

import type {
  Review360CycleDef as LocalCycle,
  Review360Assignment as LocalAssignment,
  Review360Submission as LocalSubmission,
} from '@/lib/store';
import type {
  Review360Cycle as ApiCycle,
  Review360Assignment as ApiAssignment,
  Review360Submission as ApiSubmission,
} from '@/lib/types/review-360';

function isoToMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function cycleFromApi(api: ApiCycle): LocalCycle {
  return {
    id: api.id,
    name: api.name,
    startDate: isoToMs(api.startDate),
    endDate: isoToMs(api.endDate),
    status: api.status,
    questions: api.questions,
    anonymizePeers: api.anonymizePeers,
    createdAt: isoToMs(api.createdAt),
  };
}

export function assignmentFromApi(api: ApiAssignment): LocalAssignment {
  return {
    id: api.id,
    cycleId: api.cycleId,
    subjectId: api.subjectId,
    raterId: api.raterId,
    raterType: api.raterType,
    submitted: api.submitted,
    submittedAt: api.submittedAt ? isoToMs(api.submittedAt) : undefined,
  };
}

export function submissionFromApi(api: ApiSubmission): LocalSubmission {
  return {
    id: api.id,
    cycleId: api.cycleId,
    subjectId: api.subjectId,
    raterId: api.raterId,
    raterType: api.raterType,
    answers: api.answers,
    strengths: api.strengths,
    improvements: api.improvements,
    overallScore: api.overallScore ?? undefined,
    submittedAt: isoToMs(api.submittedAt),
  };
}

async function safeFetch(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      credentials: 'include',
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.warn(`[360-sync] ${init?.method ?? 'GET'} ${url} -> ${res.status}`);
    }
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[360-sync] network err ${url}:`, err);
    return null;
  }
}

export async function loadAllFromApi(): Promise<{
  cycles: LocalCycle[];
  assignments: LocalAssignment[];
  submissions: LocalSubmission[];
}> {
  const [cyclesRes, subsRes] = await Promise.all([
    safeFetch('/api/360/cycles'),
    safeFetch('/api/360/submissions'),
  ]);
  const cycles: LocalCycle[] = [];
  const assignments: LocalAssignment[] = [];
  const submissions: LocalSubmission[] = [];

  if (cyclesRes && cyclesRes.ok) {
    const data = (await cyclesRes.json()) as { cycles: ApiCycle[] };
    for (const c of data.cycles ?? []) cycles.push(cycleFromApi(c));
  }
  if (subsRes && subsRes.ok) {
    const data = (await subsRes.json()) as { submissions: ApiSubmission[] };
    for (const s of data.submissions ?? []) submissions.push(submissionFromApi(s));
  }

  // 拉每个 cycle 的 assignments (mine 范围)
  await Promise.all(
    cycles.map(async (c) => {
      const r = await safeFetch(`/api/360/cycles/${c.id}/assignments`);
      if (!r || !r.ok) return;
      const data = (await r.json()) as { assignments: ApiAssignment[] };
      for (const a of data.assignments ?? []) assignments.push(assignmentFromApi(a));
    }),
  );

  return { cycles, assignments, submissions };
}

export function syncCreateCycle(local: LocalCycle): void {
  void safeFetch('/api/360/cycles', {
    method: 'POST',
    body: JSON.stringify({
      id: local.id, // accept client uuid
      name: local.name,
      startDate: msToIso(local.startDate),
      endDate: msToIso(local.endDate),
      questions: local.questions,
      anonymizePeers: local.anonymizePeers,
    }),
  });
}

export function syncUpdateCycle(id: string, patch: Partial<LocalCycle>): void {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'startDate' || k === 'endDate' || k === 'createdAt') {
      if (typeof v === 'number') out[k] = msToIso(v);
    } else if (k !== 'id') {
      out[k] = v;
    }
  }
  void safeFetch(`/api/360/cycles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(out),
  });
}

export function syncDeleteCycle(_id: string): void {
  // 后端没暴露 DELETE cycle (D6 隐私: cycle 关闭走 status='closed').
  // 这里 fire-and-forget 改 status=closed 作为软删.
  void safeFetch(`/api/360/cycles/${_id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'closed' }),
  });
}

export function syncCreateAssignment(local: LocalAssignment): void {
  void safeFetch(`/api/360/cycles/${local.cycleId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({
      assignments: [
        {
          subjectId: local.subjectId,
          raterId: local.raterId,
          raterType: local.raterType,
        },
      ],
    }),
  });
}

export function syncSubmitReview(local: LocalSubmission): void {
  void safeFetch('/api/360/submissions', {
    method: 'POST',
    body: JSON.stringify({
      cycleId: local.cycleId,
      subjectId: local.subjectId,
      raterType: local.raterType,
      answers: local.answers,
      strengths: local.strengths,
      improvements: local.improvements,
      overallScore: local.overallScore,
    }),
  });
}
