'use client';
import { useEffect, useState } from 'react';
import '../globals.css';
import { getToken, setToken } from '@rhautt/shared-auth';
import {
  auth, design,
  type AutoRoutePoint, type AutoRouteData, type CfdData,
} from '../../lib/api';

const ROUTE_COLORS = ['#4E9A3D', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#db2777'];
const DIST = [
  { key: 'cold', label: '冷', color: '#2563eb' },
  { key: 'cool', label: '凉', color: '#0891b2' },
  { key: 'comfortable', label: '舒适', color: '#4E9A3D' },
  { key: 'warm', label: '暖', color: '#d97706' },
  { key: 'hot', label: '热', color: '#dc2626' },
] as const;

type Tab = 'route' | 'cfd';

export default function LayoutCfdPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('13900000002');
  const [password, setPassword] = useState('Design@2026');
  const [loginErr, setLoginErr] = useState('');
  const [tab, setTab] = useState<Tab>('route');

  useEffect(() => {
    const t = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;
    if (!t) { setAuthed(false); return; }
    auth.me().then(() => setAuthed(true)).catch(() => setAuthed(false));
  }, []);

  async function doLogin() {
    setLoginErr('');
    try {
      const r = await auth.login(phone, password);
      if (r?.token) { localStorage.setItem('token', r.token); setToken(r.token); setAuthed(true); }
      else setLoginErr('登录失败：无 token');
    } catch (e) { setLoginErr((e as Error).message || '登录失败'); }
  }

  if (authed === null) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>加载中…</div>;

  if (!authed) {
    return (
      <div className="dw-auth">
        <div className="dw-card" style={{ width: 360 }}>
          <div className="dw-h1">设计师登录</div>
          <div className="dw-sub" style={{ marginBottom: 20 }}>瑞诺瓦 · 布局寻路与 CFD 仿真</div>
          <input className="dw-input" placeholder="手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input className="dw-input" type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} />
          {loginErr && <div className="dw-err">{loginErr}</div>}
          <button className="dw-btn dw-btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={doLogin}>登录</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dw-page">
      <header className="dw-topbar">
        <div>
          <div className="dw-h1">布局寻路 · CFD 仿真</div>
          <div className="dw-sub">A* 管线自动寻路（主干复用） · CFD 气流组织与热舒适（PMV/PPD）</div>
        </div>
        <a className="dw-link" href="/">← 返回工作台</a>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button type="button" className={`dw-chip ${tab === 'route' ? 'on' : ''}`} onClick={() => setTab('route')}>① 管线自动寻路</button>
        <button type="button" className={`dw-chip ${tab === 'cfd' ? 'on' : ''}`} onClick={() => setTab('cfd')}>② CFD 气流/热舒适</button>
      </div>

      {tab === 'route' ? <AutoRoutePanel /> : <CfdPanel />}
    </div>
  );
}

/* ───────────────────────── 自动寻路 ───────────────────────── */
function AutoRoutePanel() {
  const [W, setW] = useState(6000);
  const [H, setH] = useState(4000);
  const [gridStepMm, setGridStepMm] = useState(300);
  const [sx, setSx] = useState(300);
  const [sy, setSy] = useState(300);
  const [terminals, setTerminals] = useState<AutoRoutePoint[]>([
    { x: 5000, y: 3000 }, { x: 1000, y: 3500 }, { x: 5200, y: 800 },
  ]);
  const [obstaclesRaw, setObstaclesRaw] = useState('[{"x":2200,"y":1400,"w":900,"h":1300}]');
  const [res, setRes] = useState<AutoRouteData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function setTerm(i: number, k: 'x' | 'y', v: number) {
    setTerminals((prev) => prev.map((t, idx) => idx === i ? { ...t, [k]: v } : t));
  }
  const addTerm = () => setTerminals((p) => [...p, { x: Math.round(W / 2), y: Math.round(H / 2) }]);
  const rmTerm = (i: number) => setTerminals((p) => p.filter((_, idx) => idx !== i));

  async function run() {
    setBusy(true); setErr(''); setRes(null);
    try {
      let obstacles: Array<{ x: number; y: number; w: number; h: number }> = [];
      try { obstacles = obstaclesRaw.trim() ? JSON.parse(obstaclesRaw) : []; }
      catch { throw new Error('障碍物 JSON 格式错误'); }
      const data = await design.autoRoute({
        bounds: { width: Number(W), height: Number(H) },
        source: { x: Number(sx), y: Number(sy) },
        terminals: terminals.map((t) => ({ x: Number(t.x), y: Number(t.y) })),
        obstacles, gridStepMm: Number(gridStepMm),
      });
      setRes(data);
    } catch (e) { setErr((e as Error).message || '寻路失败'); }
    finally { setBusy(false); }
  }

  let obstacles: Array<{ x: number; y: number; w: number; h: number }> = [];
  try { obstacles = obstaclesRaw.trim() ? JSON.parse(obstaclesRaw) : []; } catch { /* preview only */ }

  return (
    <div className="dw-grid">
      <section className="dw-card">
        <div className="dw-h2">楼层与末端（单位 mm）</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label className="dw-label">外包宽 W</label><input className="dw-input" type="number" value={W} onChange={(e) => setW(Number(e.target.value))} /></div>
          <div><label className="dw-label">外包高 H</label><input className="dw-input" type="number" value={H} onChange={(e) => setH(Number(e.target.value))} /></div>
          <div><label className="dw-label">机房 X</label><input className="dw-input" type="number" value={sx} onChange={(e) => setSx(Number(e.target.value))} /></div>
          <div><label className="dw-label">机房 Y</label><input className="dw-input" type="number" value={sy} onChange={(e) => setSy(Number(e.target.value))} /></div>
          <div><label className="dw-label">栅格步长</label><input className="dw-input" type="number" value={gridStepMm} onChange={(e) => setGridStepMm(Number(e.target.value))} /></div>
        </div>

        <label className="dw-label" style={{ marginTop: 12 }}>末端点</label>
        {terminals.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: ROUTE_COLORS[i % ROUTE_COLORS.length], flexShrink: 0 }} />
            <input className="dw-input" style={{ margin: 0 }} type="number" value={t.x} onChange={(e) => setTerm(i, 'x', Number(e.target.value))} />
            <input className="dw-input" style={{ margin: 0 }} type="number" value={t.y} onChange={(e) => setTerm(i, 'y', Number(e.target.value))} />
            <button className="dw-btn" style={{ padding: '4px 10px' }} onClick={() => rmTerm(i)} disabled={terminals.length <= 1}>✕</button>
          </div>
        ))}
        <button className="dw-btn" style={{ marginTop: 4 }} onClick={addTerm}>+ 添加末端</button>

        <label className="dw-label" style={{ marginTop: 12 }}>障碍物（JSON，可选）</label>
        <textarea className="dw-input" rows={2} value={obstaclesRaw} onChange={(e) => setObstaclesRaw(e.target.value)} />

        {err && <div className="dw-err">{err}</div>}
        <button className="dw-btn dw-btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={busy} onClick={run}>
          {busy ? '寻路中…' : '运行自动寻路'}
        </button>
      </section>

      <section className="dw-card">
        {!res ? (
          <div className="dw-empty">设置楼层/机房/末端后运行，查看正交绕障路径与用管量。</div>
        ) : (
          <>
            <RouteSvg W={W} H={H} source={res.source} routes={res.routes} obstacles={obstacles} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 14 }}>
              <Metric label="实际用管量" value={`${res.totalNetworkLengthM} m`} hint="主干去重" />
              <Metric label="支管长度和" value={`${res.sumBranchLengthM} m`} hint="含共享段" />
              <Metric label="主干复用节省" value={`${res.savedByTrunkM} m`} good />
            </div>
            <div className="dw-h2" style={{ marginTop: 18 }}>各末端路径</div>
            <div className="dw-checks">
              {res.routes.map((r, i) => (
                <div key={r.id} className="dw-check">
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: ROUTE_COLORS[i % ROUTE_COLORS.length], display: 'inline-block' }} />
                  <span className="dw-check-key">{r.id}</span>
                  <span className="dw-check-detail">{r.reachable ? `${r.lengthM} m · ${r.pathMm.length} 拐点` : '不可达'}</span>
                </div>
              ))}
            </div>
            {res.unreachable.length > 0 && <div className="dw-err">不可达末端：{res.unreachable.join('、')}（被障碍完全包围）</div>}
            <div className="dw-disclaimer">{res.note}</div>
          </>
        )}
      </section>
    </div>
  );
}

function RouteSvg({ W, H, source, routes, obstacles }: {
  W: number; H: number; source: { x: number; y: number };
  routes: AutoRouteData['routes']; obstacles: Array<{ x: number; y: number; w: number; h: number }>;
}) {
  const pad = W * 0.03;
  return (
    <svg viewBox={`${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`} style={{ width: '100%', height: 'auto', maxHeight: 340, background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="#d1d5db" strokeWidth={W * 0.004} />
      {obstacles.map((o, i) => (
        <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill="#9ca3af33" stroke="#9ca3af" strokeWidth={W * 0.003} />
      ))}
      {routes.map((r, i) => r.reachable && r.pathMm.length > 1 && (
        <polyline key={r.id} points={r.pathMm.map((p) => `${p[0]},${p[1]}`).join(' ')}
          fill="none" stroke={ROUTE_COLORS[i % ROUTE_COLORS.length]} strokeWidth={W * 0.006}
          strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      ))}
      {routes.map((r, i) => r.pathMm.length > 0 && (
        <circle key={r.id + '-t'} cx={r.pathMm[r.pathMm.length - 1][0]} cy={r.pathMm[r.pathMm.length - 1][1]} r={W * 0.012} fill={ROUTE_COLORS[i % ROUTE_COLORS.length]} />
      ))}
      <rect x={source.x - W * 0.014} y={source.y - W * 0.014} width={W * 0.028} height={W * 0.028} fill="#111827" transform={`rotate(45 ${source.x} ${source.y})`} />
    </svg>
  );
}

/* ───────────────────────── CFD 仿真 ───────────────────────── */
function CfdPanel() {
  const [length, setLength] = useState(5);
  const [width, setWidth] = useState(4);
  const [height, setHeight] = useState(2.8);
  const [season, setSeason] = useState<'summer' | 'winter'>('summer');
  const [resolutionM, setResolutionM] = useState(0.3);
  const [res, setRes] = useState<CfdData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function run() {
    setBusy(true); setErr(''); setRes(null);
    try {
      const data = await design.simulateCfd({
        roomDimensions: { length: Number(length), width: Number(width), height: Number(height) },
        season, resolutionM: Number(resolutionM),
      });
      setRes(data);
    } catch (e) { setErr((e as Error).message || 'CFD 仿真失败'); }
    finally { setBusy(false); }
  }

  return (
    <div className="dw-grid">
      <section className="dw-card">
        <div className="dw-h2">房间与工况</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div><label className="dw-label">长 (m)</label><input className="dw-input" type="number" step="0.1" value={length} onChange={(e) => setLength(Number(e.target.value))} /></div>
          <div><label className="dw-label">宽 (m)</label><input className="dw-input" type="number" step="0.1" value={width} onChange={(e) => setWidth(Number(e.target.value))} /></div>
          <div><label className="dw-label">高 (m)</label><input className="dw-input" type="number" step="0.1" value={height} onChange={(e) => setHeight(Number(e.target.value))} /></div>
        </div>
        <label className="dw-label" style={{ marginTop: 12 }}>季节工况</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className={`dw-chip ${season === 'summer' ? 'on' : ''}`} onClick={() => setSeason('summer')}>夏季制冷</button>
          <button type="button" className={`dw-chip ${season === 'winter' ? 'on' : ''}`} onClick={() => setSeason('winter')}>冬季采暖</button>
        </div>
        <label className="dw-label" style={{ marginTop: 12 }}>网格分辨率 (m，越小越精但越慢)</label>
        <input className="dw-input" type="number" step="0.05" min="0.1" value={resolutionM} onChange={(e) => setResolutionM(Number(e.target.value))} />
        {err && <div className="dw-err">{err}</div>}
        <button className="dw-btn dw-btn-primary" style={{ width: '100%', marginTop: 12 }} disabled={busy} onClick={run}>
          {busy ? '仿真计算中…' : '运行 CFD 仿真'}
        </button>
      </section>

      <section className="dw-card">
        {!res ? (
          <div className="dw-empty">设置房间尺寸与季节后运行，查看 PMV/PPD、舒适分布与优化建议。</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <Metric label="PMV" value={String(res.comfort.overall.pmv)} hint="预测平均热感 (-3~3)" />
              <Metric label="PPD" value={`${res.comfort.overall.ppd}%`} hint="不满意率" />
              <Metric label="总体" value={res.comfort.overall.isComfortable ? '舒适' : '不达标'} good={res.comfort.overall.isComfortable} bad={!res.comfort.overall.isComfortable} />
            </div>

            <div className="dw-h2" style={{ marginTop: 18 }}>热舒适分布</div>
            <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              {DIST.map((d) => {
                const pct = (res.comfort.distribution as Record<string, number>)[d.key] || 0;
                return pct > 0 ? (
                  <div key={d.key} title={`${d.label} ${pct}%`} style={{ width: `${pct}%`, background: d.color, color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {pct >= 8 ? `${pct}%` : ''}
                  </div>
                ) : null;
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
              {DIST.map((d) => (
                <span key={d.key} style={{ fontSize: 12, color: 'var(--color-subtle)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />{d.label}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
              <Metric label="局部过热点" value={String(res.comfort.hotspotCount)} bad={res.comfort.hotspotCount > 0} />
              <Metric label="吹风感区域" value={String(res.comfort.draftCount)} bad={res.comfort.draftCount > 0} />
            </div>

            <div className="dw-h2" style={{ marginTop: 18 }}>优化建议</div>
            {res.recommendations.length === 0 ? (
              <div className="dw-empty-sm">无优化建议，气流组织良好。</div>
            ) : (
              <div className="dw-checks">
                {res.recommendations.map((r, i) => (
                  <div key={i} className="dw-check" style={{ alignItems: 'flex-start' }}>
                    <span className={`dw-check-badge ${r.priority === 'high' ? 'fail' : r.priority === 'medium' ? 'warn' : 'pass'}`}>{r.priority}</span>
                    <span>
                      <span className="dw-check-key">{r.issue}</span>
                      <div className="dw-check-detail" style={{ marginTop: 2 }}>{r.suggestion} · <em>{r.impact}</em></div>
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="dw-disclaimer">{res.note}</div>
          </>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, hint, good, bad }: { label: string; value: string; hint?: string; good?: boolean; bad?: boolean }) {
  return (
    <div style={{ padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff' }}>
      <div style={{ fontSize: 12, color: 'var(--color-subtle)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: good ? '#16a34a' : bad ? '#dc2626' : 'var(--color-text)' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>{hint}</div>}
    </div>
  );
}
