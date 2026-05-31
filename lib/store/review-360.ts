/**
 * lib/store/review-360.ts · 360 评估 UI layer (region 8)
 *
 * 从 lib/store.ts 机械拆分 (B8, 2026-05-31). 行为不变 (无 persist, dual-write API).
 * 服务端真值见 lib/types/review-360.ts.
 */

import { create } from 'zustand';

// #region 8 · Review360 (see lib/types/review-360.ts for server) ─────
export type Review360RaterType = 'self' | 'manager' | 'peer' | 'report' | 'cross';
export type Review360CycleStatus = 'draft' | 'active' | 'closed';

export interface Review360Question {
  id: string;
  /** 维度 (业绩/协作/创新...) */
  dimension: string;
  /** 题干 */
  prompt: string;
  /** 是否要求评分 (1-5) */
  rated: boolean;
  /** 是否要求文字回答 */
  qualitative: boolean;
}

export interface Review360CycleDef {
  id: string;
  name: string;          // 'Q3-2025 360 评估' 等
  startDate: number;
  endDate: number;
  status: Review360CycleStatus;
  /** 评估题目 */
  questions: Review360Question[];
  /** peer 匿名 */
  anonymizePeers: boolean;
  createdAt: number;
}

export interface Review360Submission {
  id: string;
  cycleId: string;
  /** 被评估人 */
  subjectId: string;
  /** 评估人 (匿名时仍存, UI 不暴露) */
  raterId: string;
  raterType: Review360RaterType;
  /** 每题答案 */
  answers: {
    questionId: string;
    score?: number;       // 1-5
    text?: string;
  }[];
  /** 整体强项 (≥1 条) */
  strengths: string;
  /** 整体改进点 (≥1 条) */
  improvements: string;
  /** 总评分 (可选, 1-5) */
  overallScore?: number;
  submittedAt: number;
}

export interface Review360Assignment {
  id: string;
  cycleId: string;
  subjectId: string;
  raterId: string;
  raterType: Review360RaterType;
  /** 是否已提交 */
  submitted: boolean;
  submittedAt?: number;
}

interface Review360Store {
  cycles: Review360CycleDef[];
  assignments: Review360Assignment[];
  submissions: Review360Submission[];
  /** A2.3 hydration flag */
  _hydrated: boolean;
  /** A2.3 从 API 拉全量 */
  loadFromApi: () => Promise<void>;

  addCycle: (c: Omit<Review360CycleDef, 'id' | 'createdAt'>) => string;
  updateCycle: (id: string, patch: Partial<Review360CycleDef>) => void;
  deleteCycle: (id: string) => void;
  /** 添加评估关系 (subject 由谁评) */
  addAssignment: (a: Omit<Review360Assignment, 'id' | 'submitted' | 'submittedAt'>) => void;
  removeAssignment: (id: string) => void;
  submitReview: (s: Omit<Review360Submission, 'id' | 'submittedAt'>) => void;
}

const DEFAULT_360_QUESTIONS: Review360Question[] = [
  { id: 'q-perf', dimension: '业绩', prompt: '在过去周期内, 该同事的核心产出/目标完成度如何?', rated: true, qualitative: true },
  { id: 'q-collab', dimension: '协作', prompt: '在跨团队配合中表现如何? 是否主动拉动协作?', rated: true, qualitative: true },
  { id: 'q-innovate', dimension: '创新', prompt: '是否带来过新方法/新工具/新思路?', rated: true, qualitative: false },
  { id: 'q-own', dimension: '责任', prompt: '面对模糊问题或意外情况时, 是否主动 ownership?', rated: true, qualitative: false },
  { id: 'q-comm', dimension: '沟通', prompt: '表达是否清晰? 倾听是否充分? 是否能在分歧中达成共识?', rated: true, qualitative: true },
  { id: 'q-learn', dimension: '学习', prompt: '是否在主动迭代自己的能力 / 复盘失败?', rated: true, qualitative: false },
  { id: 'q-lead', dimension: '领导力', prompt: '能否带动他人 / 提供方向 (即便没正式职称)?', rated: true, qualitative: false },
  { id: 'q-values', dimension: '价值观', prompt: '行为是否与组织价值观一致 (诚信/客户/敬业...)?', rated: true, qualitative: false },
];

export { DEFAULT_360_QUESTIONS };

/**
 * A2.3: 真后端切换. 同 useOneOnOneStore 模式 — drop persist + dual-write.
 */
export const useReview360Store = create<Review360Store>()((set) => ({
  cycles: [],
  assignments: [],
  submissions: [],
  _hydrated: false,
  loadFromApi: async () => {
    if (typeof window === 'undefined') return;
    const { loadAllFromApi } = await import('@/lib/api/review-360-sync');
    const data = await loadAllFromApi();
    set({ ...data, _hydrated: true });
  },

  addCycle: (c) => {
    const id = crypto.randomUUID();
    const cycle: Review360CycleDef = { id, createdAt: Date.now(), ...c };
    set((s) => ({ cycles: [...s.cycles, cycle] }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/review-360-sync').then((m) => m.syncCreateCycle(cycle));
    }
    return id;
  },
  updateCycle: (id, patch) => {
    set((s) => ({
      cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/review-360-sync').then((m) => m.syncUpdateCycle(id, patch));
    }
  },
  deleteCycle: (id) => {
    set((s) => ({
      cycles: s.cycles.filter((c) => c.id !== id),
      assignments: s.assignments.filter((a) => a.cycleId !== id),
      submissions: s.submissions.filter((sub) => sub.cycleId !== id),
    }));
    if (typeof window !== 'undefined') {
      void import('@/lib/api/review-360-sync').then((m) => m.syncDeleteCycle(id));
    }
  },

  addAssignment: (a) => {
    let created: Review360Assignment | null = null;
    set((s) => {
      const exists = s.assignments.some(
        (x) => x.cycleId === a.cycleId && x.subjectId === a.subjectId && x.raterId === a.raterId,
      );
      if (exists) return {};
      created = { id: crypto.randomUUID(), submitted: false, ...a };
      return { assignments: [...s.assignments, created] };
    });
    if (created && typeof window !== 'undefined') {
      const c = created as Review360Assignment;
      void import('@/lib/api/review-360-sync').then((m) => m.syncCreateAssignment(c));
    }
  },
  removeAssignment: (id) =>
    set((s) => ({ assignments: s.assignments.filter((a) => a.id !== id) })),

  submitReview: (sub) => {
    let created: Review360Submission | null = null;
    set((s) => {
      const id = crypto.randomUUID();
      const now = Date.now();
      const newSubs = s.submissions.filter(
        (x) => !(x.cycleId === sub.cycleId && x.subjectId === sub.subjectId && x.raterId === sub.raterId),
      );
      created = { id, submittedAt: now, ...sub };
      newSubs.push(created);
      const newAssigns = s.assignments.map((a) =>
        a.cycleId === sub.cycleId && a.subjectId === sub.subjectId && a.raterId === sub.raterId
          ? { ...a, submitted: true, submittedAt: now }
          : a,
      );
      return { submissions: newSubs, assignments: newAssigns };
    });
    if (created && typeof window !== 'undefined') {
      const c = created as Review360Submission;
      void import('@/lib/api/review-360-sync').then((m) => m.syncSubmitReview(c));
    }
  },
}));
// #endregion
