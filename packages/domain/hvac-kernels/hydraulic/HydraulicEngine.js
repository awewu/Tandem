/**
 * 管路液压计算引擎 — 中央热水 / 采暖系统
 * 标准: GB 50736-2012, GB 50015-2019, CJJ/T 等
 *
 * 物理模型:
 *   1. 负荷→流量: 采暖 ṁ=Q/(Cp·ΔT); 热水直接给定 L/h
 *   2. 管径选型: D=√(4Q/πv), 取最近标准管径(流速校核)
 *   3. 沿程压降: Darcy-Weisbach ΔP=λ·(L/D)·(ρv²/2)
 *   4. 摩擦系数: 层流 λ=64/Re; 紊流 Blasius λ=0.3164/Re^0.25
 *   5. 树状拓扑流量分配(后序遍历) + 最不利环路识别
 *   6. 水泵扬程 = 最不利环路总阻力 × 安全系数
 */

const Cp = 4187;        // 水比热 J/(kg·K)
const G  = 9.81;        // m/s²

// 标准管径表 (DN, 内径mm) — PPR/PEX 常用规格
const PIPE_SIZES = [
  { dn: 'DN15', id: 15 }, { dn: 'DN20', id: 20 }, { dn: 'DN25', id: 25 },
  { dn: 'DN32', id: 32 }, { dn: 'DN40', id: 40 }, { dn: 'DN50', id: 50 },
  { dn: 'DN65', id: 65 }, { dn: 'DN80', id: 80 }, { dn: 'DN100', id: 100 },
];

// 推荐流速范围 (m/s) — GB 50015 / GB 50736
const VELOCITY = {
  hot_water: { min: 0.8, max: 1.2, ideal: 1.0 },   // 热水管
  heating:   { min: 0.5, max: 1.0, ideal: 0.8 },   // 采暖管
  main:      { min: 0.8, max: 1.5, ideal: 1.2 },   // 主干管
};

// 局部阻力当量长度系数 (附件→当量管长倍数, ×D)
const LOCAL_RESIST = {
  elbow90: 30,    // 90°弯头
  tee: 60,        // 三通
  valve: 10,      // 阀门
  reducer: 15,    // 变径
};

class HydraulicEngine {
  constructor() {
    this.name = 'HydraulicEngine';
  }

  /* ── 水物性 ─────────────────────────────────────── */
  density(T) {
    // 水密度 kg/m³ (0~100°C 二次拟合)
    return 1000.6 - 0.0128 * T - 0.0035 * T * T;
  }

  kinematicViscosity(T) {
    // 运动粘度 m²/s — 分段插值 (常用工况)
    const table = [
      [10, 1.306e-6], [20, 1.004e-6], [30, 0.801e-6], [40, 0.658e-6],
      [50, 0.553e-6], [55, 0.511e-6], [60, 0.475e-6], [70, 0.413e-6],
      [80, 0.365e-6],
    ];
    if (T <= table[0][0]) return table[0][1];
    if (T >= table[table.length - 1][0]) return table[table.length - 1][1];
    for (let i = 0; i < table.length - 1; i++) {
      const [t0, v0] = table[i], [t1, v1] = table[i + 1];
      if (T >= t0 && T <= t1) return v0 + (v1 - v0) * (T - t0) / (t1 - t0);
    }
    return 0.5e-6;
  }

  /* ── 摩擦系数 ───────────────────────────────────── */
  frictionFactor(Re) {
    if (Re < 2300) return 64 / Re;                    // 层流
    if (Re < 1e5) return 0.3164 / Math.pow(Re, 0.25); // Blasius 紊流
    return 0.0032 + 0.221 / Math.pow(Re, 0.237);      // 高雷诺数
  }

  /* ── 单段管道水力计算 ───────────────────────────── */
  calcSegment(flow_Lh, length_m, systemType = 'heating', T = 60, fittings = {}) {
    const Q = flow_Lh / 1000 / 3600;        // m³/s
    const rho = this.density(T);
    const nu = this.kinematicViscosity(T);
    const vSpec = VELOCITY[systemType] || VELOCITY.heating;

    // 管径选型: 取流速达标的最小标准管径
    const idealD = Math.sqrt(4 * Q / (Math.PI * vSpec.ideal)) * 1000; // mm
    let chosen = PIPE_SIZES[PIPE_SIZES.length - 1];
    for (const p of PIPE_SIZES) {
      const v = Q / (Math.PI * Math.pow(p.id / 2000, 2)); // m/s
      if (v <= vSpec.max) { chosen = p; break; }
    }

    const D = chosen.id / 1000;             // m
    const area = Math.PI * Math.pow(D / 2, 2);
    const v = Q / area;                     // 实际流速 m/s
    const Re = v * D / nu;
    const lambda = this.frictionFactor(Re);

    // 沿程阻力
    const frictionLoss = lambda * (length_m / D) * (rho * v * v / 2); // Pa

    // 局部阻力 (当量长度法)
    let equivLen = 0;
    for (const [type, count] of Object.entries(fittings)) {
      equivLen += (LOCAL_RESIST[type] || 0) * D * count;
    }
    const localLoss = lambda * (equivLen / D) * (rho * v * v / 2);
    const totalLoss = frictionLoss + localLoss;

    return {
      flow_Lh: Math.round(flow_Lh),
      dn: chosen.dn,
      innerDiameter: chosen.id,
      idealDiameter: Math.round(idealD * 10) / 10,
      velocity: Math.round(v * 1000) / 1000,
      velocityOk: v >= vSpec.min && v <= vSpec.max,
      reynolds: Math.round(Re),
      flowRegime: Re < 2300 ? '层流' : Re < 4000 ? '过渡' : '紊流',
      lambda: Math.round(lambda * 10000) / 10000,
      length_m,
      frictionLoss_Pa: Math.round(frictionLoss),
      localLoss_Pa: Math.round(localLoss),
      totalLoss_Pa: Math.round(totalLoss),
      totalLoss_kPa: Math.round(totalLoss / 10) / 100,
    };
  }

  /* ── 负荷→流量 ─────────────────────────────────── */
  powerToFlow(power_W, supplyT, returnT) {
    const dT = supplyT - returnT;
    if (dT <= 0) throw new Error('供回水温差必须>0');
    const rho = this.density((supplyT + returnT) / 2);
    const mDot = power_W / (Cp * dT);       // kg/s
    return mDot / rho * 1000 * 3600;        // L/h
  }

  /* ── 管网树状求解 ───────────────────────────────── */
  /**
   * @param {Object} network
   *   nodes: [{id, type:'source'|'manifold'|'terminal', demand_Lh?, power_W?}]
   *   pipes: [{id, from, to, length_m, fittings?}]
   * @param {Object} opts {systemType, supplyT, returnT}
   */
  solveNetwork(network, opts = {}) {
    const { systemType = 'heating', supplyT = 60, returnT = 50 } = opts;
    const T = (supplyT + returnT) / 2;
    const nodeMap = new Map(network.nodes.map(n => [n.id, n]));

    // 邻接: from→[pipe]
    const children = new Map();
    for (const p of network.pipes) {
      if (!children.has(p.from)) children.set(p.from, []);
      children.get(p.from).push(p);
    }

    // 各末端流量 (负荷或直接给定)
    const terminalFlow = (n) => {
      if (n.demand_Lh != null) return n.demand_Lh;
      if (n.power_W != null) return this.powerToFlow(n.power_W, supplyT, returnT);
      return 0;
    };

    // 后序: 每段管流量 = 下游所有末端流量之和; 同时记录下游末端数量
    const pipeFlow = new Map();
    const pipeTermCount = new Map();
    const subtree = (nodeId) => {
      const node = nodeMap.get(nodeId);
      let flow = node && node.type === 'terminal' ? terminalFlow(node) : 0;
      let terms = node && node.type === 'terminal' ? 1 : 0;
      for (const p of (children.get(nodeId) || [])) {
        const c = subtree(p.to);
        pipeFlow.set(p.id, c.flow);
        pipeTermCount.set(p.id, c.terms);
        flow += c.flow;
        terms += c.terms;
      }
      return { flow, terms };
    };
    const source = network.nodes.find(n => n.type === 'source');
    if (!source) throw new Error('管网缺少热源节点(source)');
    const totalFlow = subtree(source.id).flow;

    // 逐段水力 — 主管判定: 承担多个末端流量的管段才是主干管
    const segments = network.pipes.map(p => {
      const flow = pipeFlow.get(p.id) || 0;
      const isMain = (pipeTermCount.get(p.id) || 0) > 1;
      const r = this.calcSegment(flow, p.length_m, isMain ? 'main' : systemType, T, p.fittings || {});
      return { pipeId: p.id, from: p.from, to: p.to, isMain, ...r };
    });
    const segMap = new Map(segments.map(s => [s.pipeId, s]));

    // 最不利环路: 从 source 到各 terminal 累计压降最大的路径
    const parentPipe = new Map();
    for (const p of network.pipes) parentPipe.set(p.to, p);
    let worst = { terminal: null, drop: 0, path: [] };
    for (const n of network.nodes) {
      if (n.type !== 'terminal') continue;
      let cur = n.id, drop = 0; const path = [];
      while (parentPipe.has(cur)) {
        const p = parentPipe.get(cur);
        const s = segMap.get(p.id);
        drop += s ? s.totalLoss_Pa : 0;
        path.unshift(p.id);
        cur = p.from;
      }
      if (drop > worst.drop) worst = { terminal: n.id, drop, path };
    }

    // 水泵扬程: 最不利环路阻力(供回水往返×2) × 1.2 安全系数
    const pumpHead_Pa = worst.drop * 2 * 1.2;
    const rho = this.density(T);
    const pumpHead_m = pumpHead_Pa / (rho * G);

    return {
      systemType, supplyT, returnT,
      totalFlow_Lh: Math.round(totalFlow),
      segments,
      worstLoop: {
        terminal: worst.terminal,
        pipes: worst.path,
        dropOneWay_kPa: Math.round(worst.drop / 10) / 100,
      },
      pump: {
        head_kPa: Math.round(pumpHead_Pa / 10) / 100,
        head_m: Math.round(pumpHead_m * 100) / 100,
        flow_Lh: Math.round(totalFlow),
        note: '扬程含供回水往返 ×2 与 1.2 安全系数',
      },
      warnings: segments.reduce((acc, s) => {
        const spec = VELOCITY[s.isMain ? 'main' : systemType] || VELOCITY.heating;
        // 真正的问题: 流速超上限(噪音/冲蚀)
        if (s.velocity > spec.max)
          acc.push(`管段 ${s.pipeId} 流速 ${s.velocity} m/s 超上限 ${spec.max}，存在噪音/冲蚀风险，建议加大管径`);
        // 主干管流速过低(<0.15)才提示选型偏大; 支管低流速在住宅系统属正常
        else if (s.isMain && s.velocity < 0.15)
          acc.push(`主干管 ${s.pipeId} 流速仅 ${s.velocity} m/s，管径偏大（已是最小 DN15 则属正常小流量）`);
        return acc;
      }, []),
    };
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * 风系统（空气）自动变径与阻力 — LATS 对标
 *   标准: GB 50736-2012 风管风速/比摩阻；圆风管 Darcy-Weisbach。
 *   自动变径: 每段按其承担风量独立选径 → 下游随风量减小逐级变径。
 * ══════════════════════════════════════════════════════════════════════ */
// 标准圆风管公称直径 (mm) — 通风常用系列
const DUCT_SIZES = [100, 120, 140, 160, 180, 200, 220, 250, 280, 320, 360, 400, 450, 500, 560, 630, 700, 800, 900, 1000, 1120, 1250];
// 风速上限 (m/s) — 住宅/公建低速风管 GB 50736 建议
const AIR_VELOCITY = {
  main: { max: 6.5, ideal: 5.0 },     // 主风管
  branch: { max: 4.5, ideal: 3.5 },   // 支风管
  terminal: { max: 3.0, ideal: 2.5 }, // 末端/风口支管
};
const RHO_AIR = 1.2;            // 空气密度 kg/m³ (20°C)
const NU_AIR = 1.53e-5;         // 空气运动粘度 m²/s (20°C)

HydraulicEngine.prototype.frictionFactorAir = function (Re) {
  if (Re < 2300) return 64 / Re;
  if (Re < 1e5) return 0.3164 / Math.pow(Re, 0.25);
  return 0.0032 + 0.221 / Math.pow(Re, 0.237);
};

/** 单段风管：按风量自动选径(圆风管) + 比摩阻/沿程阻力 + 局部阻力(当量长度)。 */
HydraulicEngine.prototype.calcDuctSegment = function (flow_m3h, length_m, role = 'branch', fittings = {}) {
  const Q = flow_m3h / 3600;                    // m³/s
  const spec = AIR_VELOCITY[role] || AIR_VELOCITY.branch;
  // 选径：取风速≤上限的最小标准圆风管
  let chosen = DUCT_SIZES[DUCT_SIZES.length - 1];
  for (const d of DUCT_SIZES) {
    const v = Q / (Math.PI * Math.pow(d / 2000, 2));
    if (v <= spec.max) { chosen = d; break; }
  }
  const D = chosen / 1000;                       // m
  const v = Q / (Math.PI * Math.pow(D / 2, 2));  // 实际风速 m/s
  const Re = v * D / NU_AIR;
  const lambda = this.frictionFactorAir(Re);
  const specificFriction = lambda * (1 / D) * (RHO_AIR * v * v / 2); // Pa/m 比摩阻
  const frictionLoss = specificFriction * length_m;                  // Pa
  let equivLen = 0;
  for (const [type, count] of Object.entries(fittings)) equivLen += (LOCAL_RESIST[type] || 0) * D * count;
  const localLoss = lambda * (equivLen / D) * (RHO_AIR * v * v / 2);
  const totalLoss = frictionLoss + localLoss;
  const idealD = Math.sqrt(4 * Q / (Math.PI * spec.ideal)) * 1000;
  return {
    flow_m3h: Math.round(flow_m3h),
    dn: `D${chosen}`, diameter: chosen, idealDiameter: Math.round(idealD * 10) / 10,
    velocity: Math.round(v * 1000) / 1000, velocityOk: v <= spec.max,
    reynolds: Math.round(Re), lambda: Math.round(lambda * 10000) / 10000,
    specificFriction_PaPerM: Math.round(specificFriction * 100) / 100,
    length_m, frictionLoss_Pa: Math.round(frictionLoss), localLoss_Pa: Math.round(localLoss),
    totalLoss_Pa: Math.round(totalLoss),
  };
};

/**
 * 风管管网求解：树状风量分配(后序) + 逐段自动变径 + 最不利环路 + 风机余压。
 * network.nodes: [{id, type:'source'|'branch'|'terminal', flow_m3h?}]
 * network.pipes: [{id, from, to, length_m, fittings?}]
 */
HydraulicEngine.prototype.solveDuctNetwork = function (network) {
  const nodeMap = new Map(network.nodes.map((n) => [n.id, n]));
  const children = new Map();
  for (const p of network.pipes) {
    if (!children.has(p.from)) children.set(p.from, []);
    children.get(p.from).push(p);
  }
  const segFlow = new Map();
  const segTerms = new Map();
  const subtree = (nid) => {
    const node = nodeMap.get(nid);
    let flow = node && node.type === 'terminal' ? (Number(node.flow_m3h) || 0) : 0;
    let terms = node && node.type === 'terminal' ? 1 : 0;
    for (const p of (children.get(nid) || [])) {
      const c = subtree(p.to);
      segFlow.set(p.id, c.flow); segTerms.set(p.id, c.terms);
      flow += c.flow; terms += c.terms;
    }
    return { flow, terms };
  };
  const source = network.nodes.find((n) => n.type === 'source');
  if (!source) throw new Error('风管网缺少风机/风源节点(source)');
  const totalFlow = subtree(source.id).flow;

  const segments = network.pipes.map((p) => {
    const flow = segFlow.get(p.id) || 0;
    const tc = segTerms.get(p.id) || 0;
    const role = tc > 1 ? 'main' : (tc === 1 ? 'branch' : 'terminal');
    return { pipeId: p.id, from: p.from, to: p.to, role, ...this.calcDuctSegment(flow, p.length_m, role, p.fittings || {}) };
  });
  const segMap = new Map(segments.map((s) => [s.pipeId, s]));

  const parentPipe = new Map();
  for (const p of network.pipes) parentPipe.set(p.to, p);
  let worst = { terminal: null, drop: 0, path: [] };
  for (const n of network.nodes) {
    if (n.type !== 'terminal') continue;
    let cur = n.id, drop = 0; const path = [];
    while (parentPipe.has(cur)) {
      const p = parentPipe.get(cur);
      const s = segMap.get(p.id);
      drop += s ? s.totalLoss_Pa : 0;
      path.unshift(p.id); cur = p.from;
    }
    if (drop > worst.drop) worst = { terminal: n.id, drop, path };
  }
  // 风机余压 = 最不利环路阻力 × 1.1 附加 (送风单程；回风另计)
  const fanStatic_Pa = Math.round(worst.drop * 1.1);
  return {
    system: 'air-duct', totalFlow_m3h: Math.round(totalFlow), segments,
    worstLoop: { terminal: worst.terminal, ducts: worst.path, drop_Pa: Math.round(worst.drop) },
    fan: { staticPressure_Pa: fanStatic_Pa, flow_m3h: Math.round(totalFlow), note: '风机余压=最不利环路阻力×1.1（送风单程）' },
    warnings: segments.filter((s) => !s.velocityOk).map((s) => `风管 ${s.pipeId} 风速 ${s.velocity} m/s 超上限，建议加大截面`),
  };
};

module.exports = HydraulicEngine;
module.exports.PIPE_SIZES = PIPE_SIZES;
module.exports.VELOCITY = VELOCITY;
module.exports.DUCT_SIZES = DUCT_SIZES;
module.exports.AIR_VELOCITY = AIR_VELOCITY;
