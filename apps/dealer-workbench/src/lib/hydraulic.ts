/**
 * 管路液压求解器 — 客户端 TypeScript 版（移植自 server/core/HydraulicEngine.js）
 * Darcy-Weisbach 压降 + 树状流量分配 + 最不利环路 + 水泵扬程
 */

const Cp = 4187, G = 9.81;

export const PIPE_SIZES = [
  { dn: 'DN15', id: 15 }, { dn: 'DN20', id: 20 }, { dn: 'DN25', id: 25 },
  { dn: 'DN32', id: 32 }, { dn: 'DN40', id: 40 }, { dn: 'DN50', id: 50 },
  { dn: 'DN65', id: 65 }, { dn: 'DN80', id: 80 }, { dn: 'DN100', id: 100 },
];

const VELOCITY: Record<string, { min: number; max: number; ideal: number }> = {
  hot_water: { min: 0.8, max: 1.2, ideal: 1.0 },
  heating:   { min: 0.5, max: 1.0, ideal: 0.8 },
  main:      { min: 0.8, max: 1.5, ideal: 1.2 },
};

const LOCAL_RESIST: Record<string, number> = { elbow90: 30, tee: 60, valve: 10, reducer: 15 };

export interface PipeNode {
  id: string;
  type: 'source' | 'manifold' | 'terminal';
  demand_Lh?: number;
  power_W?: number;
  x?: number; y?: number; // 可选坐标(可视化用, px)
}
export interface Pipe {
  id: string; from: string; to: string;
  length_m: number; fittings?: Record<string, number>;
}
export interface Segment {
  pipeId: string; from: string; to: string; isMain: boolean;
  flow_Lh: number; dn: string; innerDiameter: number;
  velocity: number; velocityOk: boolean; reynolds: number;
  flowRegime: string; lambda: number; length_m: number;
  totalLoss_Pa: number; totalLoss_kPa: number;
}

function density(T: number) { return 1000.6 - 0.0128 * T - 0.0035 * T * T; }

function kinematicViscosity(T: number) {
  const tbl: [number, number][] = [
    [10, 1.306e-6], [20, 1.004e-6], [30, 0.801e-6], [40, 0.658e-6],
    [50, 0.553e-6], [55, 0.511e-6], [60, 0.475e-6], [70, 0.413e-6], [80, 0.365e-6],
  ];
  if (T <= tbl[0][0]) return tbl[0][1];
  if (T >= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [t0, v0] = tbl[i], [t1, v1] = tbl[i + 1];
    if (T >= t0 && T <= t1) return v0 + (v1 - v0) * (T - t0) / (t1 - t0);
  }
  return 0.5e-6;
}

function frictionFactor(Re: number) {
  if (Re < 2300) return 64 / Re;
  if (Re < 1e5) return 0.3164 / Math.pow(Re, 0.25);
  return 0.0032 + 0.221 / Math.pow(Re, 0.237);
}

export function powerToFlow(power_W: number, supplyT: number, returnT: number) {
  const dT = supplyT - returnT;
  if (dT <= 0) throw new Error('供回水温差必须>0');
  const rho = density((supplyT + returnT) / 2);
  return power_W / (Cp * dT) / rho * 1000 * 3600;
}

function calcSegment(flow_Lh: number, length_m: number, systemType: string, T: number, fittings: Record<string, number>) {
  const Q = flow_Lh / 1000 / 3600;
  const rho = density(T), nu = kinematicViscosity(T);
  const vSpec = VELOCITY[systemType] || VELOCITY.heating;
  let chosen = PIPE_SIZES[PIPE_SIZES.length - 1];
  for (const p of PIPE_SIZES) {
    const v = Q / (Math.PI * Math.pow(p.id / 2000, 2));
    if (v <= vSpec.max) { chosen = p; break; }
  }
  const D = chosen.id / 1000;
  const v = Q / (Math.PI * Math.pow(D / 2, 2));
  const Re = v * D / nu;
  const lambda = frictionFactor(Re);
  const frictionLoss = lambda * (length_m / D) * (rho * v * v / 2);
  let equivLen = 0;
  for (const [type, count] of Object.entries(fittings)) equivLen += (LOCAL_RESIST[type] || 0) * D * count;
  const localLoss = lambda * (equivLen / D) * (rho * v * v / 2);
  const totalLoss = frictionLoss + localLoss;
  return {
    flow_Lh: Math.round(flow_Lh), dn: chosen.dn, innerDiameter: chosen.id,
    velocity: Math.round(v * 1000) / 1000, velocityOk: v >= vSpec.min && v <= vSpec.max,
    reynolds: Math.round(Re), flowRegime: Re < 2300 ? '层流' : Re < 4000 ? '过渡' : '紊流',
    lambda: Math.round(lambda * 10000) / 10000, length_m,
    totalLoss_Pa: Math.round(totalLoss), totalLoss_kPa: Math.round(totalLoss / 10) / 100,
  };
}

export interface SolveResult {
  totalFlow_Lh: number;
  segments: Segment[];
  worstLoop: { terminal: string | null; pipes: string[]; dropOneWay_kPa: number };
  pump: { head_kPa: number; head_m: number; flow_Lh: number };
  warnings: string[];
}

export function solveNetwork(
  network: { nodes: PipeNode[]; pipes: Pipe[] },
  opts: { systemType?: string; supplyT?: number; returnT?: number } = {}
): SolveResult {
  const { systemType = 'heating', supplyT = 60, returnT = 50 } = opts;
  const T = (supplyT + returnT) / 2;
  const nodeMap = new Map(network.nodes.map(n => [n.id, n]));
  const children = new Map<string, Pipe[]>();
  for (const p of network.pipes) {
    if (!children.has(p.from)) children.set(p.from, []);
    children.get(p.from)!.push(p);
  }
  const terminalFlow = (n: PipeNode) =>
    n.demand_Lh != null ? n.demand_Lh : n.power_W != null ? powerToFlow(n.power_W, supplyT, returnT) : 0;

  const pipeFlow = new Map<string, number>(), pipeTermCount = new Map<string, number>();
  const subtree = (nodeId: string): { flow: number; terms: number } => {
    const node = nodeMap.get(nodeId);
    let flow = node && node.type === 'terminal' ? terminalFlow(node) : 0;
    let terms = node && node.type === 'terminal' ? 1 : 0;
    for (const p of (children.get(nodeId) || [])) {
      const c = subtree(p.to);
      pipeFlow.set(p.id, c.flow); pipeTermCount.set(p.id, c.terms);
      flow += c.flow; terms += c.terms;
    }
    return { flow, terms };
  };
  const source = network.nodes.find(n => n.type === 'source');
  if (!source) throw new Error('管网缺少热源节点');
  const totalFlow = subtree(source.id).flow;

  const segments: Segment[] = network.pipes.map(p => {
    const flow = pipeFlow.get(p.id) || 0;
    const isMain = (pipeTermCount.get(p.id) || 0) > 1;
    const r = calcSegment(flow, p.length_m, isMain ? 'main' : systemType, T, p.fittings || {});
    return { pipeId: p.id, from: p.from, to: p.to, isMain, ...r };
  });
  const segMap = new Map(segments.map(s => [s.pipeId, s]));

  const parentPipe = new Map<string, Pipe>();
  for (const p of network.pipes) parentPipe.set(p.to, p);
  let worst = { terminal: null as string | null, drop: 0, path: [] as string[] };
  for (const n of network.nodes) {
    if (n.type !== 'terminal') continue;
    let cur = n.id, drop = 0; const path: string[] = [];
    while (parentPipe.has(cur)) {
      const p = parentPipe.get(cur)!; const s = segMap.get(p.id);
      drop += s ? s.totalLoss_Pa : 0; path.unshift(p.id); cur = p.from;
    }
    if (drop > worst.drop) worst = { terminal: n.id, drop, path };
  }
  const pumpHead_Pa = worst.drop * 2 * 1.2;
  const rho = density(T);
  return {
    totalFlow_Lh: Math.round(totalFlow), segments,
    worstLoop: { terminal: worst.terminal, pipes: worst.path, dropOneWay_kPa: Math.round(worst.drop / 10) / 100 },
    pump: { head_kPa: Math.round(pumpHead_Pa / 10) / 100, head_m: Math.round(pumpHead_Pa / (rho * G) * 100) / 100, flow_Lh: Math.round(totalFlow) },
    warnings: segments.reduce((acc: string[], s) => {
      const spec = VELOCITY[s.isMain ? 'main' : systemType] || VELOCITY.heating;
      if (s.velocity > spec.max) acc.push(`管段 ${s.pipeId} 流速 ${s.velocity} m/s 超上限，建议加大管径`);
      else if (s.isMain && s.velocity < 0.15) acc.push(`主干管 ${s.pipeId} 流速仅 ${s.velocity} m/s，管径偏大`);
      return acc;
    }, []),
  };
}
