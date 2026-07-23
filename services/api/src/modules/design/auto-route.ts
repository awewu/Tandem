/**
 * 管线/风管自动寻路（LATS 对标）—— 栅格 A* + 主干复用。
 *
 * 在楼层栅格上，从机房/立管(source)向各末端(terminals)正交寻路，绕开障碍(obstacles)，
 * 已布线的格子对后续末端以近零代价复用 → 支管自然汇入主干（贪心 Steiner 近似）。
 * 纯几何/确定性，无外部依赖。坐标单位 mm。
 */

export interface RoutePoint { x: number; y: number }
export interface RouteObstacle { x: number; y: number; w: number; h: number }
export interface AutoRouteInput {
  bounds: { width: number; height: number };   // 楼层外包 mm
  source: RoutePoint;                            // 机房/立管起点 mm
  terminals: Array<RoutePoint & { id?: string }>;
  obstacles?: RouteObstacle[];                   // 需绕开的矩形(柱/墙/设备) mm
  gridStepMm?: number;                           // 栅格步长 mm，默认 300
  turnPenalty?: number;                          // 转弯代价(格数)，默认 0.4
}

interface Cell { r: number; c: number }

export function autoRoutePipes(input: AutoRouteInput) {
  const step = Number(input.gridStepMm) > 0 ? Number(input.gridStepMm) : 300;
  const turnPenalty = Number.isFinite(input.turnPenalty as number) ? Number(input.turnPenalty) : 0.4;
  const W = input.bounds.width, H = input.bounds.height;
  if (!(W > 0 && H > 0)) throw new Error('bounds.width/height 必须为正');
  const cols = Math.max(1, Math.ceil(W / step));
  const rows = Math.max(1, Math.ceil(H / step));

  const blocked: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (const o of input.obstacles || []) {
    const c0 = Math.max(0, Math.floor(o.x / step));
    const r0 = Math.max(0, Math.floor(o.y / step));
    const c1 = Math.min(cols - 1, Math.ceil((o.x + o.w) / step) - 1);
    const r1 = Math.min(rows - 1, Math.ceil((o.y + o.h) / step) - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) blocked[r][c] = true;
  }

  const toCell = (p: RoutePoint): Cell => ({ r: clamp(Math.round(p.y / step), 0, rows - 1), c: clamp(Math.round(p.x / step), 0, cols - 1) });
  const freeNear = (cell: Cell): Cell => {
    if (!blocked[cell.r][cell.c]) return cell;
    // 螺旋搜索最近的空闲格
    for (let radius = 1; radius < Math.max(rows, cols); radius++) {
      for (let dr = -radius; dr <= radius; dr++) for (let dc = -radius; dc <= radius; dc++) {
        const r = cell.r + dr, c = cell.c + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols && !blocked[r][c]) return { r, c };
      }
    }
    return cell;
  };

  const source = freeNear(toCell(input.source));
  const network = new Set<string>([key(source)]); // 已成网格子（可零代价复用）
  const routes: Array<{ id: string; pathMm: Array<[number, number]>; lengthM: number; reachable: boolean }> = [];

  // 远端优先：先给最远末端建主干，近端更易汇入
  const terms = (input.terminals || []).map((t, i) => ({ ...t, id: t.id || `t${i + 1}` }))
    .sort((a, b) => manhattan(toCell(b), source) - manhattan(toCell(a), source));

  for (const term of terms) {
    const goal = freeNear(toCell(term));
    const path = astar(source, goal, rows, cols, blocked, network, turnPenalty);
    if (!path) { routes.push({ id: term.id, pathMm: [], lengthM: 0, reachable: false }); continue; }
    for (const cl of path) network.add(key(cl));
    const poly = simplify(path).map((cl) => [cl.c * step, cl.r * step] as [number, number]);
    const lengthM = Math.round((edgeLen(path) * step) / 1000 * 10) / 10;
    routes.push({ id: term.id, pathMm: poly, lengthM, reachable: true });
  }

  const totalNetworkM = Math.round((network.size - 1) * step / 1000 * 10) / 10; // 唯一成网格子数×步长（去重后主干+支管）
  const sumBranchM = Math.round(routes.reduce((s, r) => s + r.lengthM, 0) * 10) / 10;
  return {
    gridStepMm: step, grid: { rows, cols },
    source: { x: source.c * step, y: source.r * step },
    routes,
    totalNetworkLengthM: totalNetworkM,     // 去重后实际用管量（主干只计一次）
    sumBranchLengthM: sumBranchM,           // 各末端路径长度之和（含共享段重复计）
    savedByTrunkM: Math.round((sumBranchM - totalNetworkM) * 10) / 10, // 主干复用节省
    unreachable: routes.filter((r) => !r.reachable).map((r) => r.id),
  };
}

function astar(start: Cell, goal: Cell, rows: number, cols: number, blocked: boolean[][], network: Set<string>, turnPenalty: number): Cell[] | null {
  const open = new MinHeap();
  const gScore = new Map<string, number>();
  const came = new Map<string, { prev: string; dir: number }>();
  const sk = key(start);
  gScore.set(sk, 0);
  open.push(sk, manhattan(start, goal));
  const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
  const parse = (s: string): Cell => { const [r, c] = s.split(',').map(Number); return { r, c }; };

  while (!open.isEmpty()) {
    const current = open.pop()!;
    if (current === key(goal)) return reconstruct(came, current, parse);
    const { r, c } = parse(current);
    const prevDir = came.get(current)?.dir ?? -1;
    for (let d = 0; d < 4; d++) {
      const nr = r + dirs[d].dr, nc = c + dirs[d].dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || blocked[nr][nc]) continue;
      const nkey = `${nr},${nc}`;
      // 复用已成网格子代价近零；转弯加罚
      const stepCost = network.has(nkey) ? 0.05 : 1;
      const turn = prevDir !== -1 && prevDir !== d ? turnPenalty : 0;
      const tentative = (gScore.get(current) ?? Infinity) + stepCost + turn;
      if (tentative < (gScore.get(nkey) ?? Infinity)) {
        came.set(nkey, { prev: current, dir: d });
        gScore.set(nkey, tentative);
        open.push(nkey, tentative + manhattan({ r: nr, c: nc }, goal));
      }
    }
  }
  return null;
}

function reconstruct(came: Map<string, { prev: string; dir: number }>, cur: string, parse: (s: string) => Cell): Cell[] {
  const path = [parse(cur)];
  while (came.has(cur)) { cur = came.get(cur)!.prev; path.unshift(parse(cur)); }
  return path;
}

/** 折叠共线点，仅保留拐点。 */
function simplify(path: Cell[]): Cell[] {
  if (path.length <= 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1], b = path[i], c = path[i + 1];
    const collinear = (b.r - a.r) * (c.c - b.c) === (b.c - a.c) * (c.r - b.r);
    if (!collinear) out.push(b);
  }
  out.push(path[path.length - 1]);
  return out;
}

function edgeLen(path: Cell[]): number { return Math.max(0, path.length - 1); }
function manhattan(a: Cell, b: Cell): number { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }
function key(c: Cell): string { return `${c.r},${c.c}`; }
function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }

/** 极简二叉堆（字符串键 + 优先级）。 */
class MinHeap {
  private a: Array<{ k: string; p: number }> = [];
  private idx = new Map<string, number>();
  isEmpty() { return this.a.length === 0; }
  push(k: string, p: number) {
    const existing = this.idx.get(k);
    if (existing !== undefined) { if (p < this.a[existing].p) { this.a[existing].p = p; this.up(existing); } return; }
    this.a.push({ k, p }); this.idx.set(k, this.a.length - 1); this.up(this.a.length - 1);
  }
  pop(): string | undefined {
    if (!this.a.length) return undefined;
    const top = this.a[0];
    const last = this.a.pop()!; this.idx.delete(top.k);
    if (this.a.length) { this.a[0] = last; this.idx.set(last.k, 0); this.down(0); }
    return top.k;
  }
  private up(i: number) { while (i > 0) { const p = (i - 1) >> 1; if (this.a[p].p <= this.a[i].p) break; this.swap(i, p); i = p; } }
  private down(i: number) { const n = this.a.length; for (;;) { let s = i; const l = 2 * i + 1, r = 2 * i + 2; if (l < n && this.a[l].p < this.a[s].p) s = l; if (r < n && this.a[r].p < this.a[s].p) s = r; if (s === i) break; this.swap(i, s); i = s; } }
  private swap(i: number, j: number) { [this.a[i], this.a[j]] = [this.a[j], this.a[i]]; this.idx.set(this.a[i].k, i); this.idx.set(this.a[j].k, j); }
}
