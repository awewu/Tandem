'use client';
/**
 * 地暖热分布可视化 — 楼板表面温度热力图 + 盘管路径 + 实时控制
 * 调用 floorheat.ts 求解器，间距/供水温度滑块实时重算
 */
import { useMemo, useRef, useEffect, useState } from 'react';
import { solveFloorHeat } from '../lib/floorheat';

interface Props { roomW?: number; roomD?: number; title?: string }

// 温度色带 18~32°C：蓝→绿→黄→红
function rampRGB(t: number): [number, number, number] {
  const stops: [number, number[]][] = [
    [18, [30, 58, 138]], [22, [59, 130, 246]], [26, [34, 197, 94]],
    [28, [234, 179, 8]], [30, [249, 115, 22]], [32, [220, 38, 38]],
  ];
  if (t <= stops[0][0]) return stops[0][1] as [number, number, number];
  if (t >= stops[stops.length - 1][0]) return stops[stops.length - 1][1] as [number, number, number];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [0, 1, 2].map(j => Math.round(c0[j] + (c1[j] - c0[j]) * f)) as [number, number, number];
    }
  }
  return [128, 128, 128];
}

export default function FloorHeatViz({ roomW = 4000, roomD = 5000, title }: Props) {
  const [spacing, setSpacing] = useState(150);
  const [supplyT, setSupplyT] = useState(42);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const result = useMemo(
    () => solveFloorHeat({ roomW, roomD, pipeSpacing: spacing, supplyT, returnT: supplyT - 7 }),
    [roomW, roomD, spacing, supplyT]
  );

  // 绘制热力图
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const { NX, NZ, T } = result;
    cv.width = NX; cv.height = NZ;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(NX, NZ);
    for (let n = 0; n < NX * NZ; n++) {
      const [r, g, b] = rampRGB(T[n]);
      img.data[n * 4] = r; img.data[n * 4 + 1] = g; img.data[n * 4 + 2] = b; img.data[n * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [result]);

  // 盘管路径 SVG (mm → viewBox)
  const pipeD = useMemo(() => {
    if (!result.pipePath.length) return '';
    return 'M ' + result.pipePath.map(p => `${p.x} ${p.y}`).join(' L ');
  }, [result]);

  const aspect = roomD / roomW;
  const W = 420, H = W * aspect;

  return (
    <div style={{ display: 'flex', gap: 20, background: '#fff', borderRadius: 10, padding: 18, boxShadow: '0 2px 16px rgba(0,0,0,0.10)' }}>
      {/* 热力图 */}
      <div style={{ position: 'relative', width: W, height: H, flex: 'none' }}>
        <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'auto', borderRadius: 6 }} />
        <svg viewBox={`0 0 ${roomW} ${roomD}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d={pipeD} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={28} strokeLinejoin="round" strokeLinecap="round" />
          <path d={pipeD} fill="none" stroke="#1a2a5e" strokeWidth={14} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="0" />
          {result.pipePath[0] && <circle cx={result.pipePath[0].x} cy={result.pipePath[0].y} r={70} fill="#dc2626" />}
          {result.pipePath.length > 1 && <circle cx={result.pipePath[result.pipePath.length-1].x} cy={result.pipePath[result.pipePath.length-1].y} r={70} fill="#1e40af" />}
        </svg>
      </div>

      {/* 控制 + 指标 */}
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a2a5e', marginBottom: 14 }}>
          {title || '地暖热分布仿真'}
          <span style={{ fontSize: 11, fontWeight: 400, color: '#888', marginLeft: 8 }}>
            {(roomW/1000).toFixed(1)}×{(roomD/1000).toFixed(1)}m
          </span>
        </div>

        <label style={{ fontSize: 13, color: '#444', display: 'block', marginBottom: 4 }}>
          盘管间距 <b>{spacing}mm</b>
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {[100, 150, 200].map(s => (
            <button key={s} onClick={() => setSpacing(s)}
              style={{ flex: 1, padding: '6px 0', fontSize: 13, borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${spacing === s ? '#1a2a5e' : '#ccc'}`,
                background: spacing === s ? '#1a2a5e' : '#fff', color: spacing === s ? '#fff' : '#444' }}>
              {s}
            </button>
          ))}
        </div>

        <label style={{ fontSize: 13, color: '#444', display: 'block', marginBottom: 4 }}>
          供水温度 <b>{supplyT}°C</b> <span style={{ color: '#888' }}>(回水 {supplyT-7}°C)</span>
        </label>
        <input type="range" min={35} max={50} value={supplyT} onChange={e => setSupplyT(+e.target.value)}
          style={{ width: '100%', accentColor: '#1a2a5e', marginBottom: 16 }} />

        {/* 指标卡 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
          <Metric label="表面均温" value={`${result.avgSurface}°C`} ok={result.avgSurface >= 26 && result.avgSurface <= 29} />
          <Metric label="温度范围" value={`${result.minSurface}~${result.maxSurface}`} />
          <Metric label="散热量" value={`${result.heatOutput} W/m²`} />
          <Metric label="盘管长度" value={`${result.pipeLength_m} m`} />
        </div>

        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 8, fontSize: 13,
          background: result.comfortOk ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${result.comfortOk ? '#bbf7d0' : '#fecaca'}`,
          color: result.comfortOk ? '#16a34a' : '#dc2626' }}>
          {result.comfortOk
            ? '✓ 表面温度达标 (GB 50736: 26~29°C, 峰值≤30°C)'
            : `⚠ 峰值 ${result.maxSurface}°C — 建议${result.maxSurface > 30 ? '降低供水温度或加大间距' : '调整参数'}`}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: '#999', display: 'flex', gap: 14 }}>
          <span><span style={{ color: '#dc2626' }}>●</span> 供水</span>
          <span><span style={{ color: '#1e40af' }}>●</span> 回水</span>
          <span>蓝=冷 → 红=热</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ background: '#f7f9fc', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 11, color: '#888' }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: ok === false ? '#dc2626' : ok ? '#16a34a' : '#1a2a5e' }}>{value}</div>
    </div>
  );
}
