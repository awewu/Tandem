/**
 * lib/okr/cockpit.ts · 组织级 AI 风险驾驶舱聚合 (2026-06-27)
 *
 * 对标 Tita 首页"风险分析"一句话摘要 (见 docs/COMPETITOR-TITA-2026-06.md §截图3):
 *   "当前检测到 N 个目标严重滞后、M 个风险 KR、X 个逾期项目…"
 *
 * 本文件把已落地的客观算法聚合成一个组织级摘要 (纯函数, 不替代单条 insights):
 *   - 目标滞后/预警: lib/okr/risk.ts objectiveScheduleRisk (时间基准偏差)
 *   - 填写/对齐率:   lib/okr/adoption.ts computeAdoptionRates
 *   - 逾期行动项:     Initiative.dueDate < now 且未完成 (本周期范围内)
 *
 * 全部派生自真实 store 快照, 无写死, 无 mock。
 */

import type { Cycle, Initiative, KeyResult, Objective, Person } from '../store';
import { objectiveScheduleRisk, type RiskBand } from './risk';
import { computeAdoptionRates } from './adoption';

export interface CockpitObjectiveRisk {
  objectiveId: string;
  title: string;
  ownerId: string;
  variance: number;
  band: RiskBand;
}

export interface RiskCockpit {
  /** 当前激活周期 id; 无激活周期为 null (UI 应隐藏) */
  activeCycleId: string | null;
  /** 本周期活跃 O 总数 */
  totalActiveObjectives: number;
  /** 按时间基准: 严重滞后 (off-track) 目标数 */
  offTrack: number;
  /** 按时间基准: 预警 (at-risk) 目标数 */
  atRisk: number;
  /** 按时间基准: 在轨 (on-track) 目标数 */
  onTrack: number;
  /** 逾期未完成的行动项数 (本周期范围内) */
  overdueInitiatives: number;
  /** 填写率 0-100 */
  coverage: number;
  /** 对齐率 0-100 */
  alignment: number;
  /** 最该关注的目标 (off-track/at-risk, 按落后幅度降序, 最多 5) */
  topRisks: CockpitObjectiveRisk[];
  /** 是否存在任何需要关注的信号 (UI 用来决定是否高亮) */
  hasRisk: boolean;
}

const EMPTY: RiskCockpit = {
  activeCycleId: null,
  totalActiveObjectives: 0,
  offTrack: 0,
  atRisk: 0,
  onTrack: 0,
  overdueInitiatives: 0,
  coverage: 0,
  alignment: 0,
  topRisks: [],
  hasRisk: false,
};

function isActive(o: Objective): boolean {
  return o.status === 'active' || o.status === undefined;
}

export function computeRiskCockpit(opts: {
  objectives: Objective[];
  keyResults: KeyResult[];
  initiatives: Initiative[];
  people: Person[];
  cycle: Cycle | undefined;
  now?: number;
}): RiskCockpit {
  const { objectives, keyResults, initiatives, people, cycle } = opts;
  if (!cycle) return { ...EMPTY };
  const now = opts.now ?? Date.now();

  const cycleObjectives = objectives.filter((o) => o.cycleId === cycle.id);
  const activeObjectives = cycleObjectives.filter(isActive);

  let offTrack = 0;
  let atRisk = 0;
  let onTrack = 0;
  const risks: CockpitObjectiveRisk[] = [];

  for (const o of activeObjectives) {
    const r = objectiveScheduleRisk(o, cycle, keyResults, now);
    if (!r) continue;
    if (r.band === 'off-track') offTrack++;
    else if (r.band === 'at-risk') atRisk++;
    else onTrack++;
    if (r.band !== 'on-track') {
      risks.push({
        objectiveId: o.id,
        title: o.title,
        ownerId: o.ownerId,
        variance: r.variance,
        band: r.band,
      });
    }
  }

  risks.sort((a, b) => b.variance - a.variance);

  // 逾期行动项: 限定在本周期 O / KR 范围内, 避免把别周期的算进来
  const cycleObjIds = new Set(cycleObjectives.map((o) => o.id));
  const cycleKrIds = new Set(
    keyResults.filter((k) => cycleObjIds.has(k.objectiveId)).map((k) => k.id),
  );
  const overdueInitiatives = initiatives.filter((i) => {
    if (i.dueDate == null || i.dueDate >= now) return false;
    if (i.status === 'done' || i.status === 'cancelled') return false;
    return (
      (i.scope === 'objective' && cycleObjIds.has(i.scopeId)) ||
      (i.scope === 'kr' && cycleKrIds.has(i.scopeId))
    );
  }).length;

  const rates = computeAdoptionRates({
    objectives: cycleObjectives,
    keyResults,
    initiatives,
    people,
  });

  return {
    activeCycleId: cycle.id,
    totalActiveObjectives: activeObjectives.length,
    offTrack,
    atRisk,
    onTrack,
    overdueInitiatives,
    coverage: rates.coverage,
    alignment: rates.alignment,
    topRisks: risks.slice(0, 5),
    hasRisk: offTrack > 0 || atRisk > 0 || overdueInitiatives > 0,
  };
}
