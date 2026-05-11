/**
 * Insights — 跨模块信号聚合 (AI 智能层 · v1 启发式).
 *
 * 设计原则 (workflow 铁律):
 *  - 纯函数, 输入 zustand store 快照, 输出 Insight[]
 *  - 无副作用, 无 LLM 调用 (v1), 后续可在 generateInsights() 内挂 LLM
 *  - 不修改任何 schema, 只读
 *
 * 信号源:
 *  - OKR (objectives / keyResults / checkIns)
 *  - 1on1 (meetings / moodScore / actionItems)
 *  - 360 (submissions)
 */
import type {
  Objective,
  KeyResult,
  CheckIn,
  OneOnOneMeeting,
  Review360Submission,
  Review360CycleDef,
  Person,
} from '@/lib/store';

export type InsightSeverity = 'info' | 'warning' | 'critical' | 'positive';
export type InsightCategory =
  | 'okr-risk'
  | 'okr-stale'
  | 'okr-leading'
  | '1on1-cadence'
  | '1on1-mood'
  | '1on1-action-overdue'
  | '360-theme'
  | 'cross-link';

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** 相关实体, 用于跳转 / 关联 */
  refs: { type: 'objective' | 'kr' | 'meeting' | 'cycle' | 'person'; id: string; label?: string }[];
  /** 建议下一步动作 (可点击触发) */
  actions?: { label: string; href?: string; intent?: string }[];
  /** 信号生成时间 (ms) — 由调用方在 client useEffect 中赋值, 避免 SSR mismatch */
  generatedAt?: number;
}

export interface InsightInput {
  objectives: Objective[];
  keyResults: KeyResult[];
  checkIns: CheckIn[];
  meetings: OneOnOneMeeting[];
  submissions: Review360Submission[];
  cycles360: Review360CycleDef[];
  people: Person[];
  /** 现在时间 (ms), 由 client 传入 */
  now: number;
}

const DAY = 24 * 60 * 60 * 1000;

function calcKRProgress(kr: KeyResult): number {
  if (kr.type === 'binary') return kr.currentValue >= 1 ? 100 : 0;
  if (kr.type === 'milestone') return Math.max(0, Math.min(100, Math.round(kr.currentValue)));
  const span = kr.targetValue - kr.startValue;
  if (span === 0) return kr.currentValue >= kr.targetValue ? 100 : 0;
  const pct = ((kr.currentValue - kr.startValue) / span) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

function nameOf(people: Person[], id: string): string {
  return people.find((p) => p.id === id)?.name ?? id;
}

// ---------------------------------------------------------------------------
// 启发式 1: OKR 风险 — confidence=at-risk/off-track 或 进度 < 40% 且 cycle 已过半
// ---------------------------------------------------------------------------
function detectOKRRisks(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  for (const obj of input.objectives) {
    if (obj.status !== 'active' && obj.status !== undefined) continue;
    const krs = input.keyResults.filter((k) => k.objectiveId === obj.id);
    if (krs.length === 0) continue;
    const avg =
      krs.reduce((sum, k) => sum + calcKRProgress(k), 0) / Math.max(1, krs.length);
    const hasRisk =
      obj.confidence === 'at-risk' || obj.confidence === 'off-track';
    const lowProgress = avg < 40;
    if (!hasRisk && !lowProgress) continue;

    const severity: InsightSeverity =
      obj.confidence === 'off-track' ? 'critical' : 'warning';
    out.push({
      id: `okr-risk-${obj.id}`,
      category: 'okr-risk',
      severity,
      title: `OKR 落后风险: ${obj.title}`,
      detail: `负责人 ${nameOf(input.people, obj.ownerId)} · 平均进度 ${avg.toFixed(
        0
      )}% · 信心 ${obj.confidence}. 建议立即 check-in 并在 1on1 上同步.`,
      refs: [{ type: 'objective', id: obj.id, label: obj.title }],
      actions: [
        { label: '打开 OKR', href: `/okr#obj-${obj.id}` },
        { label: '约 1on1', href: `/1on1?reportId=${obj.ownerId}` },
      ],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 启发式 2: OKR Check-in 长期失联 — 14 天无 check-in
// ---------------------------------------------------------------------------
function detectStaleOKRs(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const cutoff = input.now - 14 * DAY;
  for (const obj of input.objectives) {
    const lastCheck = input.checkIns
      .filter((c) => c.scope === 'objective' && c.scopeId === obj.id)
      .reduce((m, c) => Math.max(m, c.createdAt), 0);
    const krIds = input.keyResults.filter((k) => k.objectiveId === obj.id).map((k) => k.id);
    const lastKrCheck = input.checkIns
      .filter((c) => c.scope === 'kr' && krIds.includes(c.scopeId))
      .reduce((m, c) => Math.max(m, c.createdAt), 0);
    const latest = Math.max(lastCheck, lastKrCheck, obj.updatedAt);
    if (latest < cutoff) {
      const days = Math.floor((input.now - latest) / DAY);
      out.push({
        id: `okr-stale-${obj.id}`,
        category: 'okr-stale',
        severity: days > 30 ? 'warning' : 'info',
        title: `${days} 天无 check-in: ${obj.title}`,
        detail: `负责人 ${nameOf(input.people, obj.ownerId)} 已连续 ${days} 天未更新. 数据可能失真.`,
        refs: [{ type: 'objective', id: obj.id, label: obj.title }],
        actions: [{ label: '催更', href: `/okr#obj-${obj.id}` }],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 启发式 3: 领先案例 — 进度 > 70% 且 confidence=on-track, 标记为正向信号
// ---------------------------------------------------------------------------
function detectLeading(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  for (const obj of input.objectives) {
    const krs = input.keyResults.filter((k) => k.objectiveId === obj.id);
    if (krs.length === 0) continue;
    const avg = krs.reduce((s, k) => s + calcKRProgress(k), 0) / krs.length;
    if (avg >= 70 && obj.confidence === 'on-track') {
      out.push({
        id: `okr-leading-${obj.id}`,
        category: 'okr-leading',
        severity: 'positive',
        title: `领先案例: ${obj.title}`,
        detail: `${nameOf(input.people, obj.ownerId)} 已完成 ${avg.toFixed(
          0
        )}%. 建议在月度复盘中分享方法论.`,
        refs: [{ type: 'objective', id: obj.id, label: obj.title }],
        actions: [{ label: '查看 OKR', href: `/okr#obj-${obj.id}` }],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 启发式 4: 1on1 节奏断档 — manager-report 配对 > 30 天无完成会议
// ---------------------------------------------------------------------------
function detect1on1Cadence(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const pairs = new Map<string, { managerId: string; reportId: string; last: number }>();
  for (const m of input.meetings) {
    const k = `${m.managerId}::${m.reportId}`;
    const t = m.completedAt ?? m.scheduledAt;
    const prev = pairs.get(k);
    if (!prev || t > prev.last) pairs.set(k, { managerId: m.managerId, reportId: m.reportId, last: t });
  }
  for (const v of Array.from(pairs.values())) {
    const days = Math.floor((input.now - v.last) / DAY);
    if (days >= 30) {
      out.push({
        id: `1on1-gap-${v.managerId}-${v.reportId}`,
        category: '1on1-cadence',
        severity: days >= 60 ? 'warning' : 'info',
        title: `1on1 断档 ${days} 天: ${nameOf(input.people, v.managerId)} → ${nameOf(input.people, v.reportId)}`,
        detail: `上次 1on1 已是 ${days} 天前. 建议本周内补一次.`,
        refs: [
          { type: 'person', id: v.managerId },
          { type: 'person', id: v.reportId },
        ],
        actions: [{ label: '安排 1on1', href: `/1on1?reportId=${v.reportId}` }],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 启发式 5: 1on1 mood 走低 — 同一报告者最近 3 次 mood 平均 < 3
// ---------------------------------------------------------------------------
function detectMoodDrop(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const byReport = new Map<string, OneOnOneMeeting[]>();
  for (const m of input.meetings) {
    if (m.status !== 'completed' || typeof m.moodScore !== 'number') continue;
    const arr = byReport.get(m.reportId) ?? [];
    arr.push(m);
    byReport.set(m.reportId, arr);
  }
  for (const [reportId, arr] of Array.from(byReport.entries())) {
    const recent = [...arr]
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
      .slice(0, 3);
    if (recent.length < 2) continue;
    const avg = recent.reduce((s, m) => s + (m.moodScore ?? 0), 0) / recent.length;
    if (avg < 3) {
      out.push({
        id: `mood-${reportId}`,
        category: '1on1-mood',
        severity: avg < 2 ? 'critical' : 'warning',
        title: `干劲走低: ${nameOf(input.people, reportId)}`,
        detail: `最近 ${recent.length} 次 1on1 平均干劲 ${avg.toFixed(1)}/5. 建议主管主动介入.`,
        refs: [{ type: 'person', id: reportId }],
        actions: [{ label: '约谈', href: `/1on1?reportId=${reportId}` }],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 启发式 6: 1on1 action-item 逾期未完成
// ---------------------------------------------------------------------------
function detectOverdueActions(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  for (const m of input.meetings) {
    for (const a of m.actionItems) {
      if (a.done) continue;
      if (typeof a.dueDate !== 'number') continue;
      if (a.dueDate >= input.now) continue;
      const days = Math.floor((input.now - a.dueDate) / DAY);
      out.push({
        id: `action-overdue-${m.id}-${a.id}`,
        category: '1on1-action-overdue',
        severity: days > 7 ? 'warning' : 'info',
        title: `Action 逾期 ${days} 天: ${a.text}`,
        detail: `1on1 任务 (${nameOf(input.people, m.managerId)} ↔ ${nameOf(
          input.people,
          m.reportId
        )}) · 负责人 ${nameOf(input.people, a.assigneeId)}.`,
        refs: [{ type: 'meeting', id: m.id }],
        actions: [{ label: '打开 1on1', href: '/1on1' }],
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 启发式 7: 360 主题词频 — 抽取定性回答 top 关键词 (v1 简单分词)
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
  '好', '自己', '这', '那', '与', '或', '及', '等', '以', '为', '能', '会',
  '我们', '他们', '可以', '需要',
]);

function detectThemes360(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  if (input.submissions.length === 0) return out;
  const bySubject = new Map<string, string[]>();
  for (const s of input.submissions) {
    const arr = bySubject.get(s.subjectId) ?? [];
    for (const ans of s.answers ?? []) {
      if (typeof ans.text === 'string' && ans.text.trim()) arr.push(ans.text);
    }
    if (s.strengths?.trim()) arr.push(s.strengths);
    if (s.improvements?.trim()) arr.push(s.improvements);
    bySubject.set(s.subjectId, arr);
  }
  for (const [subjectId, texts] of Array.from(bySubject.entries())) {
    if (texts.length < 2) continue;
    const counts = new Map<string, number>();
    for (const t of texts) {
      // 简单分词: 连续 2-4 字汉字 / 英文单词
      const tokens = t.match(/[\u4e00-\u9fa5]{2,4}|[A-Za-z]{3,}/g) ?? [];
      for (const tok of tokens) {
        const k = tok.toLowerCase();
        if (STOPWORDS.has(k)) continue;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const top = Array.from(counts.entries())
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (top.length === 0) continue;
    out.push({
      id: `360-theme-${subjectId}`,
      category: '360-theme',
      severity: 'info',
      title: `360 反馈主题: ${nameOf(input.people, subjectId)}`,
      detail: top.map(([k, n]) => `${k} ×${n}`).join(' · '),
      refs: [{ type: 'person', id: subjectId }],
      actions: [{ label: '查看 360', href: '/360' }],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 启发式 8: 跨模块联动 — KR 负责人 1on1 断档 + OKR 风险 = 双重信号
// ---------------------------------------------------------------------------
function detectCrossLink(input: InsightInput, existing: Insight[]): Insight[] {
  const out: Insight[] = [];
  const riskOwners = new Set(
    existing
      .filter((i) => i.category === 'okr-risk')
      .flatMap((i) =>
        i.refs
          .filter((r) => r.type === 'objective')
          .map((r) => input.objectives.find((o) => o.id === r.id)?.ownerId)
          .filter((x): x is string => !!x)
      )
  );
  const gapReports = new Set(
    existing
      .filter((i) => i.category === '1on1-cadence' || i.category === '1on1-mood')
      .flatMap((i) => i.refs.filter((r) => r.type === 'person').map((r) => r.id))
  );
  for (const personId of Array.from(riskOwners)) {
    if (!gapReports.has(personId)) continue;
    out.push({
      id: `cross-${personId}`,
      category: 'cross-link',
      severity: 'critical',
      title: `双重风险: ${nameOf(input.people, personId)} OKR 落后 + 1on1 失联`,
      detail: `OKR 风险与 1on1 节奏 / 干劲信号同时出现, 建议优先介入.`,
      refs: [{ type: 'person', id: personId }],
      actions: [
        { label: '立即 1on1', href: `/1on1?reportId=${personId}` },
        { label: '查看 OKR', href: `/okr` },
      ],
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------
export function generateInsights(input: InsightInput): Insight[] {
  const base = [
    ...detectOKRRisks(input),
    ...detectStaleOKRs(input),
    ...detectLeading(input),
    ...detect1on1Cadence(input),
    ...detectMoodDrop(input),
    ...detectOverdueActions(input),
    ...detectThemes360(input),
  ];
  const cross = detectCrossLink(input, base);
  const all = [...cross, ...base];
  // 排序: critical → warning → info → positive
  const order: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };
  return all.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ---------------------------------------------------------------------------
// 组织级分析指标 (供 /analytics 使用)
// ---------------------------------------------------------------------------
export interface OrgMetrics {
  /** OKR 健康度 0-100 (on-track 占比) */
  okrHealth: number;
  /** OKR 平均进度 */
  okrAvgProgress: number;
  /** OKR check-in 频次 (最近 30 天 / 活跃 objective 数) */
  okrCheckInFreq: number;
  /** 1on1 节奏达成率 (30 天内有完成会议的 manager-report 配对 / 总配对) */
  oneOnOneCoverage: number;
  /** 平均 1on1 干劲分 (最近 90 天) */
  oneOnOneAvgMood: number;
  /** 360 当期进度 (提交数 / 应交数) */
  review360Progress: number;
  /** 信号总览: 各严重度计数 */
  insightCounts: Record<InsightSeverity, number>;
  /** 进度直方图: 10 bucket × count */
  okrProgressHistogram: number[];
}

export function computeOrgMetrics(input: InsightInput, insights: Insight[]): OrgMetrics {
  const activeObjs = input.objectives.filter(
    (o) => o.status === 'active' || o.status === undefined
  );
  const onTrack = activeObjs.filter((o) => o.confidence === 'on-track').length;
  const okrHealth = activeObjs.length
    ? Math.round((onTrack / activeObjs.length) * 100)
    : 0;

  const progresses = activeObjs.map((o) => {
    const krs = input.keyResults.filter((k) => k.objectiveId === o.id);
    if (krs.length === 0) return 0;
    return krs.reduce((s, k) => s + calcKRProgress(k), 0) / krs.length;
  });
  const okrAvgProgress = progresses.length
    ? Math.round(progresses.reduce((s, x) => s + x, 0) / progresses.length)
    : 0;

  const recentCutoff = input.now - 30 * DAY;
  const recentCheckIns = input.checkIns.filter((c) => c.createdAt >= recentCutoff).length;
  const okrCheckInFreq = activeObjs.length
    ? +(recentCheckIns / activeObjs.length).toFixed(1)
    : 0;

  const pairs = new Map<string, number>();
  for (const m of input.meetings) {
    const k = `${m.managerId}::${m.reportId}`;
    const t = m.completedAt ?? 0;
    if (!pairs.has(k) || t > (pairs.get(k) ?? 0)) pairs.set(k, t);
  }
  const totalPairs = pairs.size;
  const recentPairs = Array.from(pairs.values()).filter((t) => t >= recentCutoff).length;
  const oneOnOneCoverage = totalPairs ? Math.round((recentPairs / totalPairs) * 100) : 0;

  const moodCutoff = input.now - 90 * DAY;
  const moodVals = input.meetings
    .filter(
      (m) =>
        m.status === 'completed' &&
        typeof m.moodScore === 'number' &&
        (m.completedAt ?? 0) >= moodCutoff
    )
    .map((m) => m.moodScore as number);
  const oneOnOneAvgMood = moodVals.length
    ? +(moodVals.reduce((s, x) => s + x, 0) / moodVals.length).toFixed(2)
    : 0;

  const activeCycle = input.cycles360.find((c) => c.status === 'active');
  let review360Progress = 0;
  if (activeCycle) {
    const subs = input.submissions.filter((s) => s.cycleId === activeCycle.id).length;
    // 估算应交数: subject 数 × 平均 5 个 rater
    const subjects = new Set(input.submissions.map((s) => s.subjectId)).size || 1;
    const expected = subjects * 5;
    review360Progress = Math.min(100, Math.round((subs / expected) * 100));
  }

  const insightCounts: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
    positive: 0,
  };
  for (const i of insights) insightCounts[i.severity]++;

  const okrProgressHistogram = Array(10).fill(0) as number[];
  for (const p of progresses) {
    const bucket = Math.min(9, Math.floor(p / 10));
    okrProgressHistogram[bucket]++;
  }

  return {
    okrHealth,
    okrAvgProgress,
    okrCheckInFreq,
    oneOnOneCoverage,
    oneOnOneAvgMood,
    review360Progress,
    insightCounts,
    okrProgressHistogram,
  };
}
