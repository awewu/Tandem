'use client';
import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CELL } from '../lib/cfd';
import { buildLayout } from '../lib/voxelize';

type Room   = { id: string; x: number; y: number; w: number; h: number; label?: string };
type Device = { id: string; type: string; x: number; y: number; w: number; h: number };

const PX_PER_M = 40;
const PARTICLES = 1500;

// Brand palette: navy=#16407a (cold) → red=#E4002B (hot)
function tempColor(t: number, out: Float32Array, off: number) {
  const tc = Math.max(0, Math.min(1, (t - 20) / 18));
  out[off]   = (0x16 + (0xE4 - 0x16) * tc) / 255;
  out[off+1] = (0x40 * (1 - tc))            / 255;
  out[off+2] = (0x7a + (0x2B - 0x7a) * tc) / 255;
}

function Scene({ rooms, devices }: { rooms: Room[]; devices: Device[] }) {
  const { solver, sources, NX, NZ } = useMemo(() => buildLayout(rooms, devices), []);

  // Heatmap canvas texture
  const hmCv  = useMemo(() => { const c = document.createElement('canvas'); c.width = NX; c.height = NZ; return c; }, []);
  const hmTex = useMemo(() => new THREE.CanvasTexture(hmCv), [hmCv]);

  // Particle buffers
  const posArr = useMemo(() => new Float32Array(PARTICLES * 3), []);
  const colArr = useMemo(() => new Float32Array(PARTICLES * 3), []);
  const ages   = useMemo(() => new Float32Array(PARTICLES), []);
  const geoRef = useRef<THREE.BufferGeometry>(null!);

  const OX = NX * CELL / 2, OZ = NZ * CELL / 2; // world-space centering offset

  // Seed particles into air cells
  useEffect(() => {
    const air = solver.airCells;
    if (!air.length) return;
    for (let p = 0; p < PARTICLES; p++) {
      const n = air[(Math.random() * air.length) | 0];
      posArr[p*3]   = solver.cellX[n] - OX;
      posArr[p*3+1] = solver.cellY[n];
      posArr[p*3+2] = solver.cellZ[n] - OZ;
      ages[p] = (Math.random() * 150) | 0;
      tempColor(solver.T[n], colArr, p * 3);
    }
    if (geoRef.current) {
      geoRef.current.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
      geoRef.current.setAttribute('color',    new THREE.BufferAttribute(colArr, 3));
    }
  }, [solver]);

  useFrame(({ clock }) => {
    const dt = Math.min(0.05, clock.getDelta());

    // Run 3 sub-steps per frame for stability
    for (let s = 0; s < 3; s++) solver.step(dt / 3, sources);

    // Update heatmap texture (mid-height slice)
    const ctx = hmCv.getContext('2d')!;
    const img = ctx.createImageData(NX, NZ);
    const jMid = (solver.NY / 2) | 0;
    for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
      const t  = solver.T[solver.idx(i, jMid, k)];
      const tc = Math.max(0, Math.min(1, (t - 20) / 18));
      const px = (k * NX + i) * 4;
      img.data[px]   = (0x16 + (0xE4 - 0x16) * tc) | 0;
      img.data[px+1] = (0x40 * (1 - tc))             | 0;
      img.data[px+2] = (0x7a + (0x2B - 0x7a) * tc)   | 0;
      img.data[px+3] = 180;
    }
    ctx.putImageData(img, 0, 0);
    hmTex.needsUpdate = true;

    // Advect + recolor particles
    const { u, v, w, T, solid, NX: nx, NY: ny, NZ: nz } = solver;
    const air = solver.airCells;
    for (let p = 0; p < PARTICLES; p++) {
      ages[p]++;
      const wx = posArr[p*3] + OX, wy = posArr[p*3+1], wz = posArr[p*3+2] + OZ;
      const gi = Math.min(nx-1, Math.max(0, wx / CELL | 0));
      const gj = Math.min(ny-1, Math.max(0, wy / CELL | 0));
      const gk = Math.min(nz-1, Math.max(0, wz / CELL | 0));
      const n  = solver.idx(gi, gj, gk);

      if (ages[p] > 180 || solid[n] || wx<0 || wx>nx*CELL || wy<0 || wy>ny*CELL || wz<0 || wz>nz*CELL) {
        const an = air[(Math.random() * air.length) | 0];
        posArr[p*3]   = solver.cellX[an] - OX;
        posArr[p*3+1] = solver.cellY[an];
        posArr[p*3+2] = solver.cellZ[an] - OZ;
        ages[p] = 0; continue;
      }

      posArr[p*3]   += u[n] * dt * 4;
      posArr[p*3+1] += v[n] * dt * 4;
      posArr[p*3+2] += w[n] * dt * 4;
      tempColor(T[n], colArr, p * 3);
    }

    if (geoRef.current) {
      (geoRef.current.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geoRef.current.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  // Room wireframe boxes
  const roomBoxes = useMemo(() =>
    rooms.map(r => {
      const wm = r.w / PX_PER_M, hm = r.h / PX_PER_M;
      return {
        key: r.id, label: r.label,
        x: r.x / PX_PER_M - OX + wm / 2,
        z: r.y / PX_PER_M - OZ + hm / 2,
        wm, hm,
        edges: new THREE.EdgesGeometry(new THREE.BoxGeometry(wm, 2.4, hm)),
      };
    }),
  [rooms]);

  return (
    <>
      <hemisphereLight args={[0xffffff, 0xcfc8b8, 0.95]} />
      <directionalLight position={[6, 10, 4]} intensity={0.5} />

      {/* Ground plane */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[NX*CELL + 2, NZ*CELL + 2]} />
        <meshBasicMaterial color={0xefeae0} />
      </mesh>

      {/* Temperature heatmap (mid-height slice projected on floor) */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[NX*CELL, NZ*CELL]} />
        <meshBasicMaterial map={hmTex} transparent opacity={0.6} depthWrite={false} />
      </mesh>

      {/* Room wireframes */}
      {roomBoxes.map(b => (
        <lineSegments key={b.key} geometry={b.edges} position={[b.x, 1.2, b.z]}>
          <lineBasicMaterial color={0x1a1f36} transparent opacity={0.35} />
        </lineSegments>
      ))}

      {/* Airflow particles */}
      <points>
        <bufferGeometry ref={geoRef} />
        <pointsMaterial size={0.04} vertexColors sizeAttenuation />
      </points>

      <OrbitControls target={[0, 1, 0]} enableDamping dampingFactor={0.08}
        maxPolarAngle={Math.PI * 0.48} minDistance={2} maxDistance={35} />
    </>
  );
}

export default function AirflowSim({ rooms, devices }: { rooms: Room[]; devices: Device[] }) {
  return (
    <div style={{ width: '100%', height: 520, borderRadius: 12, overflow: 'hidden', background: '#efeae0',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.10)' }}>
      <Canvas camera={{ position: [0, 9, -14], fov: 46 }}>
        <Scene rooms={rooms} devices={devices} />
      </Canvas>
    </div>
  );
}
