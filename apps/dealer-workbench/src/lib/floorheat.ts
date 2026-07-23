/**
 * 地暖楼板 2D 热传导求解器
 * 稳态有限差分: 盘管注热 + 向上散热到室内, Gauss-Seidel 松弛
 * 标准: GB 50736 地面辐射供暖 — 表面温度 26~29°C, 不超 30°C(人员长期停留区)
 */

export interface FloorHeatParams {
  roomW: number;       // 房间宽 mm
  roomD: number;       // 房间深 mm
  pipeSpacing: number; // 盘管间距 mm (100/150/200)
  supplyT: number;     // 供水温度 °C (低温辐射 35~45)
  returnT: number;     // 回水温度 °C
  roomTemp?: number;   // 室内设计温度 °C (默认 18)
  cell?: number;       // 网格尺寸 mm (默认 50)
  margin?: number;     // 盘管距墙边距 mm (默认 300)
}

export interface FloorHeatResult {
  NX: number; NZ: number; cell: number;
  T: Float32Array;                  // 表面温度场 °C (NX*NZ)
  pipePath: { x: number; y: number }[]; // 盘管路径 (mm, 房间局部坐标)
  pipeLength_m: number;             // 盘管总长
  avgSurface: number; minSurface: number; maxSurface: number;
  uniformity: number;               // 均匀度 max-min (越小越好)
  heatOutput: number;               // 单位散热量 W/m²
  comfortOk: boolean;               // 26~29°C 且峰值≤30 达标
}

export function solveFloorHeat(p: FloorHeatParams): FloorHeatResult {
  const cell = p.cell ?? 50;
  const margin = p.margin ?? 150;
  const roomTemp = p.roomTemp ?? 18;
  const NX = Math.max(4, Math.floor(p.roomW / cell));
  const NZ = Math.max(4, Math.floor(p.roomD / cell));
  const N = NX * NZ;
  const idx = (i: number, k: number) => i + NX * k;

  // 1. 蛇形盘管路径 (boustrophedon)
  const pipePath: { x: number; y: number }[] = [];
  const x0 = margin, x1 = p.roomW - margin;
  let z = margin, dir = 1;
  while (z <= p.roomD - margin) {
    if (dir === 1) for (let x = x0; x <= x1; x += cell) pipePath.push({ x, y: z });
    else           for (let x = x1; x >= x0; x -= cell) pipePath.push({ x, y: z });
    z += p.pipeSpacing;
    dir = -dir;
  }

  // 2. 标记盘管单元 + 沿程水温(线性衰减)
  const isPipe = new Uint8Array(N);
  const waterT = new Float32Array(N);
  const L = pipePath.length;
  for (let s = 0; s < L; s++) {
    const i = Math.min(NX - 1, Math.max(0, Math.floor(pipePath[s].x / cell)));
    const k = Math.min(NZ - 1, Math.max(0, Math.floor(pipePath[s].y / cell)));
    const n = idx(i, k);
    isPipe[n] = 1;
    waterT[n] = p.supplyT + (p.returnT - p.supplyT) * (s / Math.max(1, L - 1));
  }

  // 3. Gauss-Seidel 松弛 (稳态)
  const T = new Float32Array(N).fill(roomTemp + 6);
  const ALPHA = 0.6;  // 盘管→板表面耦合(经盖层衰减后)
  const BETA = 0.20;  // 板→室内散热
  for (let it = 0; it < 320; it++) {
    for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
      const n = idx(i, k);
      let sum = 0, cnt = 0;
      if (i > 0)    { sum += T[n - 1];  cnt++; }
      if (i < NX-1) { sum += T[n + 1];  cnt++; }
      if (k > 0)    { sum += T[n - NX]; cnt++; }
      if (k < NZ-1) { sum += T[n + NX]; cnt++; }
      sum += (4 - cnt) * T[n]; // Neumann 绝热边界
      const a = isPipe[n] ? ALPHA : 0;
      T[n] = (sum + a * waterT[n] + BETA * roomTemp) / (4 + a + BETA);
    }
  }

  // 4. 统计
  let avg = 0, mn = Infinity, mx = -Infinity;
  for (let n = 0; n < N; n++) { avg += T[n]; if (T[n] < mn) mn = T[n]; if (T[n] > mx) mx = T[n]; }
  avg /= N;
  const heatOutput = 11 * (avg - roomTemp); // q=h·ΔT, h≈11 W/(m²·K) 地面综合换热
  const pipeLength_m = Math.round((L * cell) / 1000 * 10) / 10;

  return {
    NX, NZ, cell, T, pipePath, pipeLength_m,
    avgSurface: Math.round(avg * 10) / 10,
    minSurface: Math.round(mn * 10) / 10,
    maxSurface: Math.round(mx * 10) / 10,
    uniformity: Math.round((mx - mn) * 10) / 10,
    heatOutput: Math.round(heatOutput),
    comfortOk: avg >= 26 && avg <= 29 && mx <= 30,
  };
}
