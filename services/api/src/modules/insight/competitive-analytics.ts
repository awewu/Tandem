/**
 * 竞争格局分析（纯函数层 · 8维10法的「法」侧首批落地）
 *
 * 背景：竞品情报此前只有「窗口内取份额」一项，看不出**趋势**与**格局**——
 * 份额 30% 是在涨还是在跌、这个品类是寡头还是分散，直接决定打法完全不同。
 *
 * 本模块只做**可从既有数据算出的**四件事，不引入无数据支撑的指标：
 *  - HHI 集中度（判断格局形态）
 *  - 动量（本窗口 vs 上一窗口，带小样本闸）
 *  - 与头部的差距
 *  - 威胁评分（份额 + 动量 + 头部地位，可解释）
 *
 * ⚠️ 诚实边界（基座4「不臆造」）：
 *  1. 样本不足时**明确返回 insufficient-data**，绝不用 n=1 的暴涨百分比冒充趋势。
 *  2. 份额口径依赖入账是否包含我方（isSelf）；不含我方时必须标注 universe，
 *     否则「我方份额」是无意义的（此前正是竞品-only 口径，易被误读为全量份额）。
 *  3. 威胁评分是**可解释的启发式合成**，不是统计模型；因子与权重全量返回供人复核。
 */

/** 一个竞争者在某窗口的被引次数（我方也是竞争者之一）。 */
export interface CompetitorHits {
  competitor: string;
  /** 是否我方品牌（决定 gap/威胁的参照系） */
  isSelf?: boolean;
  hits: number;
}

// ── HHI 集中度 ────────────────────────────────────────────────────────────

/** 美国 DOJ/FTC 2023 版合并指南阈值（1800 为高集中门槛；早期版本为 2500，此处采用现行口径）。 */
export type ConcentrationBand = 'unconcentrated' | 'moderately-concentrated' | 'highly-concentrated';

export interface HhiResult {
  /** 0-10000。单一主体垄断=10000 */
  hhi: number;
  band: ConcentrationBand;
  /** 参与计算的主体数 */
  players: number;
  /** 有效竞争者数 = 1/Σshare²（HHI 的倒数形态，比"家数"更能反映真实竞争强度） */
  effectivePlayers: number;
}

/** HHI = Σ(份额百分点²)。样本为空时返回 hhi=0 并标为分散（不臆造集中度）。 */
export function computeHhi(rows: CompetitorHits[]): HhiResult {
  const valid = rows.filter((r) => Number(r.hits) > 0);
  const total = valid.reduce((s, r) => s + Number(r.hits), 0);
  if (!total) return { hhi: 0, band: 'unconcentrated', players: 0, effectivePlayers: 0 };
  let sumSq = 0;
  for (const r of valid) {
    const share = Number(r.hits) / total;
    sumSq += share * share;
  }
  const hhi = Math.round(sumSq * 10000);
  const band: ConcentrationBand = hhi > 1800
    ? 'highly-concentrated'
    : hhi >= 1000 ? 'moderately-concentrated' : 'unconcentrated';
  return {
    hhi,
    band,
    players: valid.length,
    effectivePlayers: Math.round((1 / sumSq) * 100) / 100,
  };
}

// ── 动量（趋势）─────────────────────────────────────────────────────────────

export type MomentumVerdict = 'rising' | 'falling' | 'flat' | 'insufficient-data';

export interface MomentumResult {
  competitor: string;
  currentHits: number;
  previousHits: number;
  /** 份额变化（百分点）；样本不足时为 null */
  shareDeltaPp: number | null;
  verdict: MomentumVerdict;
  /** 为何判为该结论（供人复核，防"黑箱趋势"） */
  reason: string;
}

/** 小样本闸：两窗口合计低于此值不出趋势结论（n=1→n=2 不是"翻倍增长"）。 */
export const MOMENTUM_MIN_SAMPLE = 10;
/** 份额变化小于此百分点视为持平（噪声带）。 */
export const MOMENTUM_FLAT_PP = 2;

/**
 * 动量：比较两个**等长**窗口的份额变化（比较次数会被探测总量干扰，故用份额）。
 * @param minSample 两窗口合计样本下限，低于此值返回 insufficient-data
 */
export function computeMomentum(
  current: CompetitorHits[],
  previous: CompetitorHits[],
  opts: { minSample?: number; flatPp?: number } = {},
): MomentumResult[] {
  const minSample = Math.max(Number(opts.minSample ?? MOMENTUM_MIN_SAMPLE), 0);
  const flatPp = Math.max(Number(opts.flatPp ?? MOMENTUM_FLAT_PP), 0);
  const curTotal = current.reduce((s, r) => s + Number(r.hits || 0), 0);
  const prevTotal = previous.reduce((s, r) => s + Number(r.hits || 0), 0);
  const curMap = new Map(current.map((r) => [r.competitor, Number(r.hits || 0)]));
  const prevMap = new Map(previous.map((r) => [r.competitor, Number(r.hits || 0)]));
  const names = [...new Set([...curMap.keys(), ...prevMap.keys()])];

  return names.map((competitor) => {
    const currentHits = curMap.get(competitor) ?? 0;
    const previousHits = prevMap.get(competitor) ?? 0;
    // 任一窗口总量为 0 → 份额无从比较；或合计样本过小 → 不出结论
    if (!curTotal || !prevTotal) {
      return {
        competitor, currentHits, previousHits, shareDeltaPp: null,
        verdict: 'insufficient-data' as const,
        reason: !curTotal && !prevTotal ? '两窗口均无探测数据' : '仅单个窗口有数据，无从比较趋势',
      };
    }
    if (currentHits + previousHits < minSample) {
      return {
        competitor, currentHits, previousHits, shareDeltaPp: null,
        verdict: 'insufficient-data' as const,
        reason: `样本不足（合计 ${currentHits + previousHits} < ${minSample}），不出趋势结论`,
      };
    }
    const deltaPp = Math.round(((currentHits / curTotal) - (previousHits / prevTotal)) * 1000) / 10;
    const verdict: MomentumVerdict = Math.abs(deltaPp) < flatPp ? 'flat' : deltaPp > 0 ? 'rising' : 'falling';
    return {
      competitor, currentHits, previousHits, shareDeltaPp: deltaPp, verdict,
      reason: verdict === 'flat'
        ? `份额变化 ${deltaPp}pp 落在噪声带（±${flatPp}pp）内`
        : `份额${deltaPp > 0 ? '上升' : '下降'} ${Math.abs(deltaPp)}pp`,
    };
  });
}

// ── 威胁评分 ───────────────────────────────────────────────────────────────

export interface ThreatScore {
  competitor: string;
  /** 0-100，越高越需优先应对 */
  score: number;
  factors: { share: number; momentum: number; leader: number };
  reason: string;
}

/**
 * 威胁评分 = 份额存量(0-60) + 动量增量(0-30) + 头部加成(0-10)。
 * 设计意图：**只大不涨**的老牌与**小而猛涨**的新秀都要被看见，前者靠存量、后者靠动量。
 * ⚠️ 这是可解释启发式而非统计模型；因子全量返回，权重写死在此便于审阅与争论。
 */
export function scoreThreats(
  current: CompetitorHits[],
  momentum: MomentumResult[],
): ThreatScore[] {
  const total = current.reduce((s, r) => s + Number(r.hits || 0), 0);
  const momMap = new Map(momentum.map((m) => [m.competitor, m]));
  const leaderHits = Math.max(...current.map((r) => Number(r.hits || 0)), 0);

  return current
    .filter((r) => !r.isSelf) // 我方不构成对自己的威胁
    .map((r) => {
      const hits = Number(r.hits || 0);
      const share = total ? hits / total : 0;
      const shareFactor = Math.round(share * 60);
      const mom = momMap.get(r.competitor);
      // 动量因子：份额上升 1pp 记 3 分，上限 30；无结论/下降记 0（不因样本不足而扣分或加分）
      const momentumFactor = mom?.verdict === 'rising' && mom.shareDeltaPp !== null
        ? Math.min(Math.round(mom.shareDeltaPp * 3), 30)
        : 0;
      const leaderFactor = leaderHits > 0 && hits === leaderHits ? 10 : 0;
      const score = Math.min(shareFactor + momentumFactor + leaderFactor, 100);
      const bits = [`份额 ${(share * 100).toFixed(1)}%`];
      if (momentumFactor) bits.push(`且上升 ${mom!.shareDeltaPp}pp`);
      else if (mom?.verdict === 'insufficient-data') bits.push('趋势未知（样本不足）');
      if (leaderFactor) bits.push('当前头部');
      return {
        competitor: r.competitor,
        score,
        factors: { share: shareFactor, momentum: momentumFactor, leader: leaderFactor },
        reason: bits.join('，'),
      };
    })
    .sort((a, b) => b.score - a.score || a.competitor.localeCompare(b.competitor));
}

// ── 与头部的差距 ───────────────────────────────────────────────────────────

export interface LeaderGap {
  /** 头部（可能就是我方） */
  leader: string | null;
  leaderShare: number;
  /** 我方份额；入账不含我方时为 null（诚实：无数据不填 0，0 会被误读为"我方毫无声量"） */
  selfShare: number | null;
  /** 我方与头部的份额差（百分点）；我方即头部时为 0；无我方数据时为 null */
  gapPp: number | null;
  selfIsLeader: boolean;
}

/** 我方与头部的份额差距。注意 selfShare=null 表示**没有我方口径**，与"份额为 0"是两件事。 */
export function computeLeaderGap(rows: CompetitorHits[]): LeaderGap {
  const total = rows.reduce((s, r) => s + Number(r.hits || 0), 0);
  if (!total) return { leader: null, leaderShare: 0, selfShare: null, gapPp: null, selfIsLeader: false };
  const sorted = [...rows].sort((a, b) => Number(b.hits || 0) - Number(a.hits || 0));
  const leader = sorted[0];
  const leaderShare = Number(leader.hits || 0) / total;
  const self = rows.find((r) => r.isSelf);
  if (!self) {
    return { leader: leader.competitor, leaderShare, selfShare: null, gapPp: null, selfIsLeader: false };
  }
  const selfShare = Number(self.hits || 0) / total;
  return {
    leader: leader.competitor,
    leaderShare,
    selfShare,
    gapPp: Math.round((leaderShare - selfShare) * 1000) / 10,
    selfIsLeader: leader.competitor === self.competitor,
  };
}
