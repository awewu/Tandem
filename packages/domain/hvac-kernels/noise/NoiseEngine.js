/**
 * NoiseEngine — 室内噪声（恒静维度）精算内核
 *
 * 决议#2：噪声作为独立内核（不并入负荷/水力引擎）。
 * 纯函数、无 HTTP/租户依赖，供 design calc 编排器与必算校验闸调用。
 *
 * 标准基线（决议#1：国标为底线，企标更严不更松）：
 * - GB 50118-2010《民用建筑隔声设计规范》室内允许噪声级（dB(A)，昼/夜）
 * - GB 3096 / GB/T 50155 术语
 * 声学模型（透明、可复核、保守）：
 * - 受声点声压级 Lp = 设备声功率级 Lw - 路径衰减 - 距离衰减 + 房间混响修正
 * - 距离衰减（半自由场点声源）：10·log10(1/(2πr²))  ≈ 8 + 20·log10(r)
 * - 房间修正（稳态混响场）：10·log10(4/R)，R=房间常数=Sα/(1-α)
 * - 多声源能量叠加：Lp_total = 10·log10(Σ 10^(Lp_i/10))
 *
 * 说明：本内核给出工程估算与达标判定，阈值与系数可由调用方覆盖（企标更严）。
 * 不替代第三方声学实测；输出含 assumptions 供复核。
 */

'use strict';

// GB 50118-2010 室内允许噪声级（dB(A)）——常用房间，昼间/夜间（高要求标准取严值）
const GB50118_INDOOR_LIMITS = {
  bedroom:    { day: 45, night: 37 }, // 卧室
  livingroom: { day: 45, night: 45 }, // 起居室（厅）
  study:      { day: 40, night: 40 }, // 书房（按高要求住宅）
  office:     { day: 45, night: 45 },
  meeting:    { day: 40, night: 40 },
  ward:       { day: 40, night: 35 }, // 病房
  classroom:  { day: 45, night: 45 },
};

const DEFAULT_ROOM_ABSORPTION = 0.15; // 平均吸声系数 α（家具/软装一般住宅经验值）
const TWO_PI = 2 * Math.PI;

function round(v, n = 1) {
  const f = Math.pow(10, n);
  return Math.round(v * f) / f;
}

/** 房间常数 R = Sα/(1-α)；S=总内表面积(m²) */
function roomConstant(surfaceArea, absorption) {
  const a = clamp(absorption, 0.01, 0.99);
  return (surfaceArea * a) / (1 - a);
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 估算房间总内表面积（m²）；若未给则按 长宽高 估，再不给按地面积+高度近似
 */
function estimateSurfaceArea({ surfaceArea, length, width, height, floorArea }) {
  if (Number.isFinite(surfaceArea) && surfaceArea > 0) return surfaceArea;
  if ([length, width, height].every((x) => Number.isFinite(x) && x > 0)) {
    return 2 * (length * width + length * height + width * height);
  }
  if (Number.isFinite(floorArea) && floorArea > 0) {
    const h = Number.isFinite(height) && height > 0 ? height : 2.8;
    // 近似：地面+顶面 + 四周（按正方形地面估周长）
    const side = Math.sqrt(floorArea);
    return 2 * floorArea + 4 * side * h;
  }
  return 60; // 兜底：一般住宅房间近似内表面积
}

/**
 * 单设备在受声点产生的声压级 Lp（dB(A)）
 * @param {object} src
 * @param {number} src.soundPowerLevel  设备 A 计权声功率级 Lw, dB(A)（厂家样本）
 * @param {number} src.distance         设备到受声点距离 r, m
 * @param {number} [src.pathAttenuation] 路径衰减（管路/消声器/隔墙）dB，默认 0
 * @param {number} roomR                房间常数 R
 */
function sourceLpAtReceiver(src, roomR) {
  const Lw = Number(src.soundPowerLevel);
  const r = clamp(Number(src.distance) || 1, 0.3, 50);
  const path = Number(src.pathAttenuation) || 0;
  if (!Number.isFinite(Lw)) return null;
  // 直达声（半自由场）+ 混响声 的稳态合成项
  const directTerm = 1 / (TWO_PI * r * r);
  const reverbTerm = 4 / Math.max(roomR, 1e-6);
  const Lp = Lw + 10 * Math.log10(directTerm + reverbTerm) - path;
  return Lp;
}

/** 能量叠加多个声压级 */
function energySum(levels) {
  const valid = levels.filter((x) => Number.isFinite(x));
  if (!valid.length) return null;
  return 10 * Math.log10(valid.reduce((s, L) => s + Math.pow(10, L / 10), 0));
}

/**
 * 主入口：预测房间室内噪声并对照 GB 50118 判定
 * @param {object} params
 * @param {string} [params.roomType='bedroom']  房间类型（见 GB50118_INDOOR_LIMITS）
 * @param {('day'|'night')} [params.period='night'] 昼/夜（取严默认夜间）
 * @param {object} [params.room]  房间几何 { surfaceArea|length,width,height|floorArea, absorption }
 * @param {Array}  params.sources  声源数组 [{ name, soundPowerLevel, distance, pathAttenuation }]
 * @param {object} [params.limitsOverride]  企标更严限值覆盖 { [roomType]: {day,night} }
 * @param {number} [params.backgroundLp]  本底噪声 dB(A)（可选，参与叠加）
 * @returns {{predictedLp, limit, pass, marginDb, perSource, assumptions}}
 */
function evaluateRoomNoise(params = {}) {
  const roomType = params.roomType || 'bedroom';
  const period = params.period === 'day' ? 'day' : 'night';
  const room = params.room || {};
  const absorption = Number.isFinite(room.absorption) ? room.absorption : DEFAULT_ROOM_ABSORPTION;
  const surfaceArea = estimateSurfaceArea(room);
  const R = roomConstant(surfaceArea, absorption);

  const sources = Array.isArray(params.sources) ? params.sources : [];
  const perSource = sources.map((s) => ({
    name: s.name || 'source',
    soundPowerLevel: Number(s.soundPowerLevel),
    distance: Number(s.distance) || null,
    lpAtReceiver: round(sourceLpAtReceiver(s, R) ?? NaN),
  }));

  const lpList = perSource.map((s) => s.lpAtReceiver);
  if (Number.isFinite(params.backgroundLp)) lpList.push(Number(params.backgroundLp));
  const predicted = energySum(lpList);

  const limitsTable = { ...GB50118_INDOOR_LIMITS, ...(params.limitsOverride || {}) };
  const limitRow = limitsTable[roomType] || GB50118_INDOOR_LIMITS.bedroom;
  const limit = limitRow[period];

  const predictedLp = predicted === null ? null : round(predicted);
  const marginDb = predictedLp === null ? null : round(limit - predictedLp);
  const pass = predictedLp === null ? null : predictedLp <= limit;

  return {
    metric: 'indoor_noise_dba',
    roomType,
    period,
    predictedLp,            // 预测受声点 A 声级 dB(A)
    limit,                  // GB 50118（或企标覆盖）允许噪声级
    pass,                   // 是否达标
    marginDb,               // 余量（正=达标余量，负=超标量）
    perSource,
    assumptions: {
      standard: 'GB 50118-2010',
      surfaceArea: round(surfaceArea),
      absorption,
      roomConstant: round(R),
      model: 'half-free-field direct + steady reverberant; energy summation',
      note: '工程估算，企标更严可经 limitsOverride/pathAttenuation 收紧；不替代实测',
    },
  };
}

/**
 * 批量评估多个房间，汇总最差项（供必算校验闸取整体结论）
 */
function evaluateRooms(rooms = []) {
  const results = (Array.isArray(rooms) ? rooms : []).map((r) => evaluateRoomNoise(r));
  const evaluated = results.filter((r) => r.pass !== null);
  const failed = evaluated.filter((r) => r.pass === false);
  const worst = evaluated.reduce((w, r) => (w === null || (r.marginDb ?? Infinity) < (w.marginDb ?? Infinity) ? r : w), null);
  return {
    pass: evaluated.length ? failed.length === 0 : null,
    failedCount: failed.length,
    worst,
    rooms: results,
  };
}

module.exports = {
  GB50118_INDOOR_LIMITS,
  roomConstant,
  estimateSurfaceArea,
  sourceLpAtReceiver,
  energySum,
  evaluateRoomNoise,
  evaluateRooms,
};
