// Converts design-page Room/Device data into CFD grid topology + sources
import { CFDSolver, CELL, Source } from './cfd';
import type { FloorPlan, Wall } from './floorplan';

const PX_PER_M = 40; // design page: GRID=40px = 1m
const NY = 12;       // 2.4m ceiling height in voxels

type Room   = { x: number; y: number; w: number; h: number };
type Device = { type: string; x: number; y: number; w: number; h: number };

function toVoxel(px: number) { return Math.floor(px / PX_PER_M / CELL); }
const mmToVoxel = (mm: number) => Math.floor(mm / 1000 / CELL); // mm → voxel idx

export function buildLayout(rooms: Room[], devices: Device[]) {
  // Bounding box → grid dimensions (add 2-cell border)
  let maxX = 0, maxZ = 0;
  for (const r of rooms) { maxX = Math.max(maxX, r.x+r.w); maxZ = Math.max(maxZ, r.y+r.h); }
  const NX = Math.max(20, toVoxel(maxX) + 4);
  const NZ = Math.max(20, toVoxel(maxZ) + 4);

  const solver = new CFDSolver(NX, NY, NZ);
  solver.solid.fill(1); // start all solid

  // Carve room interiors (1-cell inset to preserve walls)
  for (const r of rooms) {
    const i0 = toVoxel(r.x) + 1,         i1 = toVoxel(r.x + r.w) - 2;
    const k0 = toVoxel(r.y) + 1,         k1 = toVoxel(r.y + r.h) - 2;
    for (let k=k0; k<=k1; k++) for (let j=0; j<NY; j++) for (let i=i0; i<=i1; i++)
      if (i>=0&&i<NX&&k>=0&&k<NZ) solver.solid[solver.idx(i,j,k)] = 0;
  }

  solver.rebuildTopo();
  for (const n of solver.airCells) {
    const j = ((n / NX) | 0) % NY;
    solver.T[n] = 28 + j * 0.15;
  }

  const sources: Source[] = [];
  for (const d of devices) {
    const ci = toVoxel(d.x + d.w * PX_PER_M / 2);
    const ck = toVoxel(d.y + d.h * PX_PER_M / 2);
    _equipSources(d.type, ci, ck, NX, NZ, NY, sources);
  }

  return { solver, sources, NX, NZ };
}

/**
 * Build CFD layout directly from a FloorPlan (mm coordinates).
 * Rasterizes wall segments as solid voxels; everything else is air.
 */
export function buildLayoutFromFloorPlan(plan: FloorPlan, tOutdoor = 32) {
  // Bounding box from wall endpoints (mm)
  let maxXmm = 0, maxZmm = 0;
  for (const w of plan.walls) {
    maxXmm = Math.max(maxXmm, w.a.x, w.b.x);
    maxZmm = Math.max(maxZmm, w.a.y, w.b.y);
  }
  const NX = Math.max(20, mmToVoxel(maxXmm) + 4);
  const NZ = Math.max(20, mmToVoxel(maxZmm) + 4);
  const NY_fp = Math.max(8, Math.floor((plan.walls[0]?.height ?? 2800) / 1000 / CELL));

  const solver = new CFDSolver(NX, NY_fp, NZ);
  solver.solid.fill(0); // start all air

  // Rasterize each wall as a box of solid voxels
  for (const w of plan.walls) {
    _rasterizeWall(w, solver, NX, NY_fp, NZ);
  }

  solver.rebuildTopo();
  for (const n of solver.airCells) {
    const j = ((n / NX) | 0) % NY_fp;
    solver.T[n] = 26 + j * 0.15;
  }

  const sources: Source[] = [];
  for (const eq of plan.equipment) {
    const ci = mmToVoxel(eq.x);
    const ck = mmToVoxel(eq.y);
    _equipSources(eq.type, ci, ck, NX, NZ, NY_fp, sources);
  }

  return { solver, sources, NX, NZ };
}

function _rasterizeWall(w: Wall, solver: CFDSolver, NX: number, NY: number, NZ: number) {
  const dx = w.b.x - w.a.x, dz = w.b.y - w.a.y;
  const len = Math.hypot(dx, dz);
  if (len < 1) return;
  // Step along the wall at 0.5-cell intervals
  const steps = Math.ceil(len / (CELL * 1000 / 2));
  const hw = Math.ceil(w.thickness / 2 / (CELL * 1000));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const ci = mmToVoxel(w.a.x + dx * t);
    const ck = mmToVoxel(w.a.y + dz * t);
    for (let di = -hw; di <= hw; di++) for (let j = 0; j < NY; j++) for (let dk = -hw; dk <= hw; dk++) {
      const ii = ci + di, kk = ck + dk;
      if (ii >= 0 && ii < NX && kk >= 0 && kk < NZ)
        solver.solid[solver.idx(ii, j, kk)] = 1;
    }
  }
}

function _equipSources(type: string, ci: number, ck: number, NX: number, NZ: number, NY: number, sources: Source[]) {
  if (type === 'heat_pump' || type === 'air') {
    for (let di = -1; di <= 1; di++) {
      const i = ci + di;
      if (i >= 0 && i < NX)
        sources.push({ i, j: NY-1, k: ck, type: 'ac', power: 0.8, targetTemp: 18, vel: [0, -1.5, 0] });
    }
  } else if (type === 'fresh_air') {
    sources.push({ i: ci, j: (NY/2)|0, k: ck, type: 'fresh_air', power: 0.5, targetTemp: 26, vel: [0.6, 0, 0] });
  } else if (type === 'floor_heat') {
    for (let di=-2; di<=2; di++) for (let dk=-2; dk<=2; dk++) {
      const i=ci+di, k=ck+dk;
      if (i>=0&&i<NX&&k>=0&&k<NZ)
        sources.push({ i, j: 0, k, type: 'floor_heat', power: 0.3, targetTemp: 32 });
    }
  }
}

