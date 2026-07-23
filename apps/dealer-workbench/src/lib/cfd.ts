// Stable Fluids CFD solver — ported from 対流 Airflow Study
// Semi-Lagrangian advection + Jacobi pressure projection + buoyancy

export const CELL = 0.2; // metres per voxel

export interface Source {
  i: number; j: number; k: number;
  type: 'ac' | 'floor_heat' | 'fresh_air';
  power: number;
  targetTemp: number;
  vel?: [number, number, number];
}

export class CFDSolver {
  NX: number; NY: number; NZ: number; N: number;
  solid:  Uint8Array;
  u: Float32Array; v: Float32Array; w: Float32Array;
  T: Float32Array;
  airCells: number[] = [];
  cellX: Float32Array; cellY: Float32Array; cellZ: Float32Array;

  private u2: Float32Array; private v2: Float32Array; private w2: Float32Array;
  private T2: Float32Array;
  private pr: Float32Array;  private pr2: Float32Array; private dv: Float32Array;
  private nb: Int32Array;

  constructor(NX: number, NY: number, NZ: number) {
    this.NX = NX; this.NY = NY; this.NZ = NZ;
    this.N  = NX * NY * NZ;
    this.solid = new Uint8Array(this.N);
    this.u  = new Float32Array(this.N); this.v  = new Float32Array(this.N); this.w  = new Float32Array(this.N);
    this.u2 = new Float32Array(this.N); this.v2 = new Float32Array(this.N); this.w2 = new Float32Array(this.N);
    this.T  = new Float32Array(this.N); this.T2 = new Float32Array(this.N);
    this.pr = new Float32Array(this.N); this.pr2= new Float32Array(this.N); this.dv = new Float32Array(this.N);
    this.nb = new Int32Array(this.N * 6).fill(-1);
    this.cellX = new Float32Array(this.N);
    this.cellY = new Float32Array(this.N);
    this.cellZ = new Float32Array(this.N);
    this.T.fill(28);
  }

  idx(i: number, j: number, k: number) { return i + this.NX * (j + this.NY * k); }

  rebuildTopo() {
    const { NX, NY, NZ, solid, nb } = this;
    this.airCells = [];
    for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const n = this.idx(i, j, k);
      this.cellX[n] = (i + 0.5) * CELL;
      this.cellY[n] = (j + 0.5) * CELL;
      this.cellZ[n] = (k + 0.5) * CELL;
      if (solid[n]) { this.u[n] = this.v[n] = this.w[n] = 0; continue; }
      this.airCells.push(n);
      const o = n * 6;
      nb[o]   = (i > 0     && !solid[n - 1])      ? n - 1      : -1;
      nb[o+1] = (i < NX-1  && !solid[n + 1])      ? n + 1      : -1;
      nb[o+2] = (j > 0     && !solid[n - NX])     ? n - NX     : -1;
      nb[o+3] = (j < NY-1  && !solid[n + NX])     ? n + NX     : -1;
      nb[o+4] = (k > 0     && !solid[n - NX*NY])  ? n - NX*NY  : -1;
      nb[o+5] = (k < NZ-1  && !solid[n + NX*NY])  ? n + NX*NY  : -1;
    }
  }

  private sample(f: Float32Array, x: number, y: number, z: number): number {
    const { NX, NY, NZ } = this;
    const gx = Math.max(0, Math.min(NX-1.001, x/CELL - 0.5));
    const gy = Math.max(0, Math.min(NY-1.001, y/CELL - 0.5));
    const gz = Math.max(0, Math.min(NZ-1.001, z/CELL - 0.5));
    const i0 = gx|0, j0 = gy|0, k0 = gz|0;
    const fx = gx-i0, fy = gy-j0, fz = gz-k0;
    const i1 = i0+1, j1 = j0+1, k1 = k0+1;
    const g = (i:number,j:number,k:number) => f[i + NX*(j + NY*k)];
    const a = g(i0,j0,k0)+(g(i1,j0,k0)-g(i0,j0,k0))*fx;
    const b = g(i0,j1,k0)+(g(i1,j1,k0)-g(i0,j1,k0))*fx;
    const c = g(i0,j0,k1)+(g(i1,j0,k1)-g(i0,j0,k1))*fx;
    const d = g(i0,j1,k1)+(g(i1,j1,k1)-g(i0,j1,k1))*fx;
    return (a+(b-a)*fy) + ((c+(d-c)*fy) - (a+(b-a)*fy)) * fz;
  }

  step(dt: number, sources: Source[], tOutdoor = 32) {
    const { u, v, w, T, nb, cellX, cellY, cellZ, airCells } = this;
    const BUOY = 0.055, VMAX = 3.4, DIFFK = 1.1;
    const relax = (k: number) => 1 - Math.exp(-k * dt);

    // Buoyancy
    let Tsum = 0;
    for (const n of airCells) Tsum += T[n];
    const Tref = Tsum / airCells.length;
    for (const n of airCells) v[n] += BUOY * (T[n] - Tref) * dt;

    // Sources
    for (const s of sources) {
      const n = this.idx(s.i, s.j, s.k);
      if (this.solid[n]) continue;
      T[n] += (s.targetTemp - T[n]) * relax(s.type === 'ac' ? 6 : 2) * s.power;
      if (s.vel) {
        const r = relax(s.type === 'ac' ? 9 : 4);
        u[n] += (s.vel[0] - u[n]) * r;
        v[n] += (s.vel[1] - v[n]) * r;
        w[n] += (s.vel[2] - w[n]) * r;
      }
    }

    // Damping + speed clamp
    const damp = Math.exp(-0.04 * dt);
    for (const n of airCells) {
      u[n] *= damp; v[n] *= damp; w[n] *= damp;
      const spd = Math.sqrt(u[n]*u[n] + v[n]*v[n] + w[n]*w[n]);
      if (spd > VMAX) { const f = VMAX/spd; u[n]*=f; v[n]*=f; w[n]*=f; }
    }

    // Semi-Lagrangian velocity advection
    this.u2.fill(0); this.v2.fill(0); this.w2.fill(0);
    for (const n of airCells) {
      const x=cellX[n]-u[n]*dt, y=cellY[n]-v[n]*dt, z=cellZ[n]-w[n]*dt;
      this.u2[n]=this.sample(u,x,y,z); this.v2[n]=this.sample(v,x,y,z); this.w2[n]=this.sample(w,x,y,z);
    }
    [this.u, this.u2]=[this.u2,this.u]; [this.v, this.v2]=[this.v2,this.v]; [this.w, this.w2]=[this.w2,this.w];

    this._project();

    // Temperature advection
    this.T2.set(T);
    for (const n of airCells) {
      this.T2[n] = this.sample(this.T, cellX[n]-this.u[n]*dt, cellY[n]-this.v[n]*dt, cellZ[n]-this.w[n]*dt);
    }
    [this.T, this.T2]=[this.T2,this.T];

    // Turbulent diffusion
    this.T2.set(this.T);
    for (const n of airCells) {
      const o=n*6; let s=0, c=0, m: number;
      for (let d=0; d<6; d++) if ((m=nb[o+d])>=0) { s+=this.T[m]; c++; }
      if (c) this.T2[n] = this.T[n] + DIFFK*dt*(s - c*this.T[n])/6;
    }
    [this.T, this.T2]=[this.T2,this.T];

    // Exterior wall heat exchange
    const { NX, NZ } = this;
    for (const n of airCells) {
      const i=n%NX, k=(n/(NX*this.NY))|0;
      if (i===0||i===NX-1||k===0||k===NZ-1) this.T[n] += 0.006*(tOutdoor - this.T[n])*dt;
    }
    for (const n of airCells) { if (this.T[n]<16) this.T[n]=16; else if (this.T[n]>45) this.T[n]=45; }
  }

  private _project() {
    const { airCells, nb, dv } = this;
    const u=this.u, v=this.v, w=this.w;
    for (const n of airCells) {
      const o=n*6; let m: number;
      const uL=(m=nb[o])>=0?u[m]:0,   uR=(m=nb[o+1])>=0?u[m]:0;
      const vD=(m=nb[o+2])>=0?v[m]:0, vU=(m=nb[o+3])>=0?v[m]:0;
      const wB=(m=nb[o+4])>=0?w[m]:0, wF=(m=nb[o+5])>=0?w[m]:0;
      dv[n] = -0.5*CELL*(uR-uL + vU-vD + wF-wB);
    }
    let a=this.pr, b=this.pr2; a.fill(0); b.fill(0);
    for (let it=0; it<18; it++) {
      for (const n of airCells) {
        const o=n*6, pc=a[n]; let s=0, m: number;
        for (let d=0; d<6; d++) s += (m=nb[o+d])>=0 ? a[m] : pc;
        b[n] = (dv[n]+s)/6;
      }
      [a,b]=[b,a];
    }
    for (const n of airCells) {
      const o=n*6, pc=a[n]; let m: number;
      const pL=(m=nb[o])>=0?a[m]:pc,   pR=(m=nb[o+1])>=0?a[m]:pc;
      const pD=(m=nb[o+2])>=0?a[m]:pc, pU=(m=nb[o+3])>=0?a[m]:pc;
      const pB=(m=nb[o+4])>=0?a[m]:pc, pF=(m=nb[o+5])>=0?a[m]:pc;
      u[n] -= 0.5*(pR-pL)/CELL; v[n] -= 0.5*(pU-pD)/CELL; w[n] -= 0.5*(pF-pB)/CELL;
      if (nb[o+1]===-1&&u[n]>0) u[n]=0; if (nb[o]===-1&&u[n]<0) u[n]=0;
      if (nb[o+3]===-1&&v[n]>0) v[n]=0; if (nb[o+2]===-1&&v[n]<0) v[n]=0;
      if (nb[o+5]===-1&&w[n]>0) w[n]=0; if (nb[o+4]===-1&&w[n]<0) w[n]=0;
    }
    this.pr=a; this.pr2=b;
  }
}
