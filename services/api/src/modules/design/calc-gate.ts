/**
 * 必算校验闸（W1 · 软闸 + 签字越过）
 *
 * 决议#1：国标为底线（企标更严可经 override 收紧）。
 * 决议#4：我们是设备制造商，经销商自负合规——故为「软闸」：
 *   - block 级未达标默认拦截（拒出图/拒锁价）；
 *   - 但经销商可显式签署免责越过（留审计）。
 *
 * 纯函数、无框架/IO 依赖，便于单测与复核。数据不足报 insufficient_data，
 * 绝不以「缺数据」伪装为通过。
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const kernels = require('../../../../../packages/domain/hvac-kernels');

export type CheckStatus = 'pass' | 'fail' | 'insufficient_data';
export type CheckKey = 'noise' | 'diversity' | 'hydraulic' | 'condensation';

export interface GateCheck {
  key: CheckKey;
  label: string;
  standard: string;
  status: CheckStatus;
  level: 'block' | 'warn'; // block 级 fail 才触发拦截
  message: string;
  detail?: Record<string, unknown>;
}

export interface GateResult {
  pass: boolean | null;       // 整体结论：无 block 级 fail = true；全部 insufficient = null
  blocked: boolean;           // 存在 block 级 fail
  requiresOverride: boolean;  // 软闸：blocked 时需经销商签字越过
  checks: GateCheck[];
  blockers: string[];         // block 级 fail 的简述
  warnings: string[];         // insufficient_data / warn 级提示
}

export interface GateInput {
  // 噪声：房间+声源（交 noise kernel 评估）
  rooms?: Array<Record<string, unknown>>;
  // 同时使用系数：多区负荷聚合
  zones?: number;
  diversityFactor?: number;
  // 水力平衡：最不利环路偏差（%），或交由上游预算
  hydraulicBalanceDeviationPct?: number;
  // 结露：冷表面温度 vs 室内露点温度（℃）
  coilSurfaceTempC?: number;
  indoorDewPointC?: number;
  // 阈值覆盖（企标更严）
  thresholds?: Partial<GateThresholds>;
  // 噪声限值覆盖（企标）
  noiseLimitsOverride?: Record<string, { day: number; night: number }>;
}

export interface GateThresholds {
  diversityMin: number;          // 同时系数下限
  diversityMax: number;          // 同时系数上限（多区 >此视为未做同时系数）
  hydraulicMaxDeviationPct: number; // 水力平衡最大偏差
  condensationMarginC: number;   // 结露安全余量（表面温须高于露点该值）
}

export const DEFAULT_THRESHOLDS: GateThresholds = {
  diversityMin: 0.6,
  diversityMax: 1.0,
  hydraulicMaxDeviationPct: 15,
  condensationMarginC: 1.0,
};

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function checkNoise(input: GateInput): GateCheck {
  const rooms = Array.isArray(input.rooms) ? input.rooms : [];
  if (!rooms.length) {
    return { key: 'noise', label: '室内噪声（恒静）', standard: 'GB 50118-2010', level: 'block',
      status: 'insufficient_data', message: '缺房间/声源数据，无法评估噪声' };
  }
  const withOverride = input.noiseLimitsOverride
    ? rooms.map((r) => ({ ...r, limitsOverride: input.noiseLimitsOverride }))
    : rooms;
  const agg = kernels.noise.evaluateRooms(withOverride);
  if (agg.pass === null) {
    return { key: 'noise', label: '室内噪声（恒静）', standard: 'GB 50118-2010', level: 'block',
      status: 'insufficient_data', message: '声源声功率级缺失，无法计算' , detail: agg };
  }
  const worst = agg.worst || {};
  return {
    key: 'noise', label: '室内噪声（恒静）', standard: 'GB 50118-2010', level: 'block',
    status: agg.pass ? 'pass' : 'fail',
    message: agg.pass
      ? `全部房间达标（最差余量 ${worst.marginDb ?? '?'} dB）`
      : `${agg.failedCount} 间超标（最差 ${worst.predictedLp ?? '?'} > ${worst.limit ?? '?'} dB(A)）`,
    detail: agg,
  };
}

function checkDiversity(input: GateInput, t: GateThresholds): GateCheck {
  const zones = num(input.zones);
  const f = num(input.diversityFactor);
  const base = { key: 'diversity' as const, label: '同时使用系数', standard: 'GB 50736-2012', level: 'block' as const };
  if (zones === null || zones <= 1) {
    return { ...base, status: 'insufficient_data',
      message: zones === null ? '缺分区数，无法判定是否需同时系数' : '单区，无需同时系数' };
  }
  if (f === null) {
    return { ...base, status: 'fail', message: `多区(${zones})未给同时使用系数，禁按简单累加选型` };
  }
  if (f >= t.diversityMin && f <= t.diversityMax) {
    return { ...base, status: 'pass', message: `同时系数 ${f}（${t.diversityMin}–${t.diversityMax}）合理`, detail: { zones, factor: f } };
  }
  return { ...base, status: 'fail',
    message: `同时系数 ${f} 超出合理区间 ${t.diversityMin}–${t.diversityMax}`, detail: { zones, factor: f } };
}

function checkHydraulic(input: GateInput, t: GateThresholds): GateCheck {
  const dev = num(input.hydraulicBalanceDeviationPct);
  const base = { key: 'hydraulic' as const, label: '水力平衡', standard: 'GB 50736-2012', level: 'block' as const };
  if (dev === null) {
    return { ...base, status: 'insufficient_data', message: '缺环路压损/流量数据，无法校核水力平衡' };
  }
  const ok = Math.abs(dev) <= t.hydraulicMaxDeviationPct;
  return { ...base, status: ok ? 'pass' : 'fail',
    message: ok ? `环路偏差 ${dev}% ≤ ±${t.hydraulicMaxDeviationPct}%`
                : `环路偏差 ${dev}% 超 ±${t.hydraulicMaxDeviationPct}%，需平衡阀/重选管径`,
    detail: { deviationPct: dev } };
}

function checkCondensation(input: GateInput, t: GateThresholds): GateCheck {
  const surf = num(input.coilSurfaceTempC);
  const dew = num(input.indoorDewPointC);
  const base = { key: 'condensation' as const, label: '结露（恒湿/制冷）', standard: 'GB 50736-2012', level: 'block' as const };
  if (surf === null || dew === null) {
    return { ...base, status: 'insufficient_data', message: '缺冷表面温/室内露点温度，无法判定结露风险' };
  }
  const margin = surf - dew;
  const ok = margin >= t.condensationMarginC;
  return { ...base, status: ok ? 'pass' : 'fail',
    message: ok ? `表面温高于露点 ${margin.toFixed(1)}℃（≥${t.condensationMarginC}℃）`
                : `表面温仅高于露点 ${margin.toFixed(1)}℃，结露风险（需提温/除湿）`,
    detail: { coilSurfaceTempC: surf, indoorDewPointC: dew, marginC: Number(margin.toFixed(2)) } };
}

export function evaluateGate(input: GateInput = {}): GateResult {
  const t: GateThresholds = { ...DEFAULT_THRESHOLDS, ...(input.thresholds || {}) };
  const checks: GateCheck[] = [
    checkNoise(input),
    checkDiversity(input, t),
    checkHydraulic(input, t),
    checkCondensation(input, t),
  ];
  const blockFails = checks.filter((c) => c.level === 'block' && c.status === 'fail');
  const insufficient = checks.filter((c) => c.status === 'insufficient_data');
  const evaluatable = checks.some((c) => c.status === 'pass' || c.status === 'fail');
  const blocked = blockFails.length > 0;
  return {
    pass: !evaluatable ? null : !blocked,
    blocked,
    requiresOverride: blocked, // 软闸：blocked 时经销商需签字越过
    checks,
    blockers: blockFails.map((c) => `${c.label}: ${c.message}`),
    warnings: insufficient.map((c) => `${c.label}: ${c.message}`),
  };
}
