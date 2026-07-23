/**
 * P1-1 ②③ · 热水系统端到端真精算：负荷 → 选型 → BOM（纯函数，无 IO，可单测）。
 *
 * 诚实纪律（守宪章 1.1 红线 + MDM 契约 master-data.entity.ts:32）：
 *  - 仅 `dataTrustLevel === 'verified'` 且备齐核心参数（额定制热量）的产品可**驱动选型**；
 *  - `calibrated` / `unverified`（及 verified 但缺核心参数）产品**只进 BOM 备选**，
 *    标「参数未验证，不驱动精算」，绝不用于精算；
 *  - 输入缺参 → 采用**工程默认值**并显式标注为 calibrated（不伪装 verified）。
 *
 * 负荷方法（工程口径，可溯源）：
 *  日用热水量 L = 人数 × 人均日用水定额(L, 60℃口径, GB 50015 生活热水定额区间 40–80)；
 *  日加热热量 kWh = 日用水量 × 4.187 kJ/(kg·K) × ΔT / 3600（ρ≈1 kg/L）；
 *  所需制热量 kW = 日加热热量 / 恢复时长(h)；推荐水箱 L = 日用水量 × 峰值系数。
 */

export type ParamTrust = 'verified' | 'calibrated';

export interface HotWaterInput {
  residents?: number; // 常住人数
  area?: number; // 建筑面积㎡（缺人数时据此估算）
  city?: string; // 城市（用于进水温度季节缺省）
  inletTempC?: number; // 进水温度℃
  targetTempC?: number; // 目标热水温度℃
  perCapitaLiters?: number; // 人均日用水定额 L（60℃口径）
  recoveryHours?: number; // 设计恢复时长 h
}

export interface HotWaterCandidate {
  globalProductId?: string;
  sku?: string;
  name: string;
  dataTrustLevel: 'verified' | 'calibrated' | 'unverified';
  canonicalParams?: Record<string, unknown>; // { heatingCapacityKw, cop, tankVolumeL }
  listPrice?: number | null;
}

export interface HotWaterLoad {
  residents: number;
  perCapitaLiters: number;
  dailyDemandLiters: number;
  inletTempC: number;
  targetTempC: number;
  deltaTempC: number;
  dailyEnergyKwh: number;
  recoveryHours: number;
  requiredHeatingKw: number;
  recommendedTankLiters: number;
  trust: ParamTrust; // verified 仅当所有关键输入均来自显式入参
  assumptions: string[]; // 每条 calibrated 缺省的显式说明
}

export interface HotWaterSelection {
  recommended: {
    globalProductId?: string;
    sku?: string;
    name: string;
    heatingCapacityKw: number;
    cop: number | null;
    tankVolumeL: number | null;
    listPrice: number | null;
    marginKw: number; // 相对所需制热量的裕量
  } | null;
  selectionTrust: 'verified' | 'calibrated' | 'insufficient_data';
  // 只进 BOM、不驱动精算的备选（未验证/参数不全）
  bomOnlyAlternatives: Array<{ name: string; sku?: string; dataTrustLevel: string; reason: string; listPrice: number | null }>;
  warnings: string[];
}

export interface HotWaterCalcResult {
  system: 'hotWater';
  implemented: true;
  load: HotWaterLoad;
  selection: HotWaterSelection;
  disclaimer: string;
}

const round = (n: number, d = 2) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// 城市进水温度季节缺省（℃，calibrated 工程口径；未命中回退 15）。
const CITY_INLET_TEMP: Record<string, number> = {
  上海: 15, 北京: 12, 广州: 20, 深圳: 21, 杭州: 15, 南京: 14,
  成都: 16, 重庆: 17, 武汉: 14, 西安: 13, 青岛: 12, 济南: 13,
  哈尔滨: 8, 沈阳: 9, 昆明: 18,
};

const PER_CAPITA_DEFAULT = 60; // L/人·d @60℃（GB 50015 定额区间 40–80 取中）
const TARGET_TEMP_DEFAULT = 60; // ℃
const RECOVERY_HOURS_DEFAULT = 8; // h（设计恢复时长）
const AREA_PER_RESIDENT = 35; // ㎡/人（据面积估人数）
const TANK_PEAK_FRACTION = 0.6; // 推荐水箱 = 日用量 × 峰值系数
const WATER_C_KJ = 4.187; // kJ/(kg·K)

/** 热水负荷计算：显式入参优先，缺项用工程默认并标注 calibrated。 */
export function sizeHotWaterLoad(input: HotWaterInput = {}): HotWaterLoad {
  const assumptions: string[] = [];
  let allVerified = true;

  let residents = numOrNull(input.residents);
  if (residents == null) {
    const area = numOrNull(input.area);
    if (area != null) {
      residents = Math.max(1, Math.round(area / AREA_PER_RESIDENT));
      assumptions.push(`人数未填：按 ${AREA_PER_RESIDENT} ㎡/人 由面积 ${area}㎡ 估算为 ${residents} 人（calibrated）`);
    } else {
      residents = 3;
      assumptions.push('人数与面积均未填：按 3 人户工程缺省（calibrated）');
    }
    allVerified = false;
  }

  let perCapita = numOrNull(input.perCapitaLiters);
  if (perCapita == null) {
    perCapita = PER_CAPITA_DEFAULT;
    assumptions.push(`人均日用热水定额未填：取 ${PER_CAPITA_DEFAULT} L/人·d（GB 50015 区间 40–80，calibrated）`);
    allVerified = false;
  }

  let targetTemp = numOrNull(input.targetTempC);
  if (targetTemp == null) {
    targetTemp = TARGET_TEMP_DEFAULT;
    assumptions.push(`目标水温未填：取 ${TARGET_TEMP_DEFAULT}℃（calibrated）`);
    allVerified = false;
  }

  let inletTemp = numOrNull(input.inletTempC);
  if (inletTemp == null) {
    const city = (input.city || '').trim();
    inletTemp = CITY_INLET_TEMP[city] ?? 15;
    assumptions.push(`进水温度未填：按城市「${city || '未指定'}」季节缺省取 ${inletTemp}℃（calibrated）`);
    allVerified = false;
  }

  let recoveryHours = numOrNull(input.recoveryHours);
  if (recoveryHours == null) {
    recoveryHours = RECOVERY_HOURS_DEFAULT;
    assumptions.push(`设计恢复时长未填：取 ${RECOVERY_HOURS_DEFAULT} h（calibrated）`);
    allVerified = false;
  }

  const deltaTemp = Math.max(1, targetTemp - inletTemp);
  const dailyDemandLiters = round(residents * perCapita, 1);
  const dailyEnergyKwh = round((dailyDemandLiters * WATER_C_KJ * deltaTemp) / 3600, 2);
  const requiredHeatingKw = round(dailyEnergyKwh / recoveryHours, 2);
  const recommendedTankLiters = Math.round(dailyDemandLiters * TANK_PEAK_FRACTION);

  return {
    residents, perCapitaLiters: perCapita, dailyDemandLiters,
    inletTempC: inletTemp, targetTempC: targetTemp, deltaTempC: deltaTemp,
    dailyEnergyKwh, recoveryHours, requiredHeatingKw, recommendedTankLiters,
    trust: allVerified ? 'verified' : 'calibrated',
    assumptions,
  };
}

/**
 * 选型：仅 verified 且备齐额定制热量的产品可驱动选型；其余进 BOM 备选、不驱动精算。
 * 选型规则：制热量 ≥ 所需值的最小机型，同容量优先高 COP。
 */
export function selectHotWaterUnit(requiredHeatingKw: number, candidates: HotWaterCandidate[]): HotWaterSelection {
  const warnings: string[] = [];
  const bomOnlyAlternatives: HotWaterSelection['bomOnlyAlternatives'] = [];

  const eligible: Array<{ c: HotWaterCandidate; cap: number; cop: number | null; tank: number | null }> = [];
  for (const c of candidates || []) {
    const cap = numOrNull(c.canonicalParams?.heatingCapacityKw);
    if (c.dataTrustLevel === 'verified' && cap != null) {
      eligible.push({
        c, cap,
        cop: numOrNull(c.canonicalParams?.cop),
        tank: numOrNull(c.canonicalParams?.tankVolumeL),
      });
    } else {
      const reason = c.dataTrustLevel !== 'verified'
        ? `数据可信度为 ${c.dataTrustLevel}（参数未验证），仅供选配、不驱动精算`
        : '缺额定制热量（参数不全），仅供选配、不驱动精算';
      bomOnlyAlternatives.push({
        name: c.name, sku: c.sku, dataTrustLevel: c.dataTrustLevel, reason,
        listPrice: c.listPrice ?? null,
      });
    }
  }

  if (!eligible.length) {
    warnings.push('无 verified 且参数齐备的热水主机可驱动选型；请补充产品额定制热量并核验数据可信度。');
    return { recommended: null, selectionTrust: 'insufficient_data', bomOnlyAlternatives, warnings };
  }

  const meeting = eligible.filter((e) => e.cap >= requiredHeatingKw)
    .sort((a, b) => (a.cap - b.cap) || ((b.cop ?? 0) - (a.cop ?? 0)));
  let chosen = meeting[0];
  if (!chosen) {
    // 无机型满足 → 取最大 verified 机型并告警（诚实：未满足所需负荷）
    chosen = [...eligible].sort((a, b) => b.cap - a.cap)[0];
    warnings.push(`最大可选 verified 机型制热量 ${chosen.cap}kW 仍低于所需 ${requiredHeatingKw}kW，需并联或升级机型。`);
  }

  const selCalibrated: string[] = [];
  if (chosen.cop == null) selCalibrated.push('COP');
  if (chosen.tank == null) selCalibrated.push('水箱容积');
  if (selCalibrated.length) warnings.push(`所选机型缺 ${selCalibrated.join('/')}（该项按 calibrated 处理）。`);

  const meetsLoad = chosen.cap >= requiredHeatingKw;
  return {
    recommended: {
      globalProductId: chosen.c.globalProductId, sku: chosen.c.sku, name: chosen.c.name,
      heatingCapacityKw: chosen.cap, cop: chosen.cop, tankVolumeL: chosen.tank,
      listPrice: chosen.c.listPrice ?? null,
      marginKw: round(chosen.cap - requiredHeatingKw, 2),
    },
    selectionTrust: meetsLoad && selCalibrated.length === 0 ? 'verified' : 'calibrated',
    bomOnlyAlternatives,
    warnings,
  };
}

/** 端到端编排：负荷 → 选型；输出结构化真精算结果（供 runCalc / 计算书）。 */
export function computeHotWaterDesign(input: HotWaterInput, candidates: HotWaterCandidate[]): HotWaterCalcResult {
  const load = sizeHotWaterLoad(input);
  const selection = selectHotWaterUnit(load.requiredHeatingKw, candidates);
  const overall = load.trust === 'verified' && selection.selectionTrust === 'verified' ? 'verified' : 'calibrated';
  return {
    system: 'hotWater',
    implemented: true,
    load,
    selection,
    disclaimer: overall === 'verified'
      ? '负荷与选型均基于 verified 参数；正式合规与选型仍由经销商确认。'
      : '含 calibrated（工程缺省/参数不全）项，不可作合规辩护依据；正式选型以合同为准。',
  };
}
