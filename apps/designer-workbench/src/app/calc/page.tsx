'use client';
import { useEffect, useState } from 'react';
import '../globals.css';
import { getToken, setToken } from '@rhautt/shared-auth';
import {
  auth, design,
  type CalcInput, type CalcResult, type SystemKey, type DesignRelease,
} from '../../lib/api';

const SYSTEMS: { key: SystemKey; label: string; hint: string }[] = [
  { key: 'hotWater',        label: '热水', hint: '生活热水（独立）' },
  { key: 'water',           label: '净水', hint: '直饮/软水（独立）' },
  { key: 'heating',         label: '采暖', hint: '辐射/地暖 → 恒温' },
  { key: 'airConditioning', label: '制冷', hint: '辐射/空调 → 恒温' },
  { key: 'freshAir',        label: '新风', hint: '置换新风 → 恒氧+恒洁' },
  { key: 'humidity',        label: '恒湿', hint: '独立除湿(DOAS) → 恒湿' },
  { key: 'control',         label: '控制', hint: '五恒联动大脑' },
];

const CITIES = ['上海', '杭州', '南京', '苏州', '宁波', '成都', '北京', '广州'];

type Phase = 'form' | 'result';

export default function CalcPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [phone, setPhone] = useState('13900000002');
  const [password, setPassword] = useState('Design@2026');
  const [loginErr, setLoginErr] = useState('');

  const [area, setArea] = useState(180);
  const [city, setCity] = useState('上海');
  const [systems, setSystems] = useState<SystemKey[]>(['heating', 'airConditioning', 'freshAir', 'hotWater', 'humidity', 'control']);
  const [phase, setPhase] = useState<Phase>('form');
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // 签章
  const [release, setRelease] = useState<DesignRelease | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [disclaimer, setDisclaimer] = useState(false);
  const [signBusy, setSignBusy] = useState(false);

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
    } catch (e: any) { setLoginErr(e.message || '登录失败'); }
  }

  function toggleSystem(k: SystemKey) {
    setSystems((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  }

  async function runCalc() {
    setBusy(true); setErr(''); setRelease(null); setDisclaimer(false); setOverrideReason('');
    try {
      const input: CalcInput = { area: Number(area), city, buildingType: 'residential', systems };
      const res = await design.calc(input);
      setCalc(res); setPhase('result');
    } catch (e: any) { setErr(e.message || '精算失败'); }
    finally { setBusy(false); }
  }

  async function draft() {
    if (!calc) return;
    setSignBusy(true); setErr('');
    try {
      const input: CalcInput & { customerId?: string } = { area: Number(area), city, buildingType: 'residential', systems };
      const r = await design.createRelease(input);
      const full = await design.getRelease(r.id);
      setRelease(full);
    } catch (e: any) { setErr(e.message || '起草失败'); }
    finally { setSignBusy(false); }
  }

  async function step(fn: () => Promise<any>) {
    if (!release) return;
    setSignBusy(true); setErr('');
    try { await fn(); const full = await design.getRelease(release.id); setRelease(full); }
    catch (e: any) { setErr(e.message || '操作失败'); }
    finally { setSignBusy(false); }
  }

  if (authed === null) return <div style={{ padding: 40, color: 'var(--color-muted)' }}>加载中…</div>;

  if (!authed) {
    return (
      <div className="dw-auth">
        <div className="dw-card" style={{ width: 360 }}>
          <div className="dw-h1">设计师登录</div>
          <div className="dw-sub" style={{ marginBottom: 20 }}>瑞诺瓦 · 方案精算与签章</div>
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
          <div className="dw-h1">一键精算 · 签章放行</div>
          <div className="dw-sub">七系统 · 五恒维度 · 必算校验闸 · 复核签章（经销商为责任主体）</div>
        </div>
        <a className="dw-link" href="/">← 返回工作台</a>
      </header>

      <div className="dw-grid">
        {/* 左：入参 */}
        <section className="dw-card">
          <div className="dw-h2">方案入参</div>
          <label className="dw-label">建筑面积（㎡）</label>
          <input className="dw-input" type="number" value={area} onChange={(e) => setArea(Number(e.target.value))} />
          <label className="dw-label">城市</label>
          <select className="dw-input" value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="dw-label" style={{ marginTop: 12 }}>选用系统（独立系统层）</label>
          <div className="dw-sys-grid">
            {SYSTEMS.map((s) => (
              <button key={s.key} type="button"
                className={`dw-chip ${systems.includes(s.key) ? 'on' : ''}`}
                onClick={() => toggleSystem(s.key)} title={s.hint}>
                {s.label}
              </button>
            ))}
          </div>
          {err && <div className="dw-err">{err}</div>}
          <button className="dw-btn dw-btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={busy} onClick={runCalc}>
            {busy ? '精算中…' : '运行一键精算'}
          </button>
        </section>

        {/* 右：结果 */}
        <section className="dw-card">
          {phase !== 'result' || !calc ? (
            <div className="dw-empty">填写入参并运行精算，查看七系统 / 五恒维度 / 校验闸结论。</div>
          ) : (
            <>
              <div className="dw-h2">负荷估算</div>
              {calc.load ? (
                <div className="dw-loadrow">
                  <div><span className="dw-num">{calc.load.coolingLoad ?? '—'}</span><span className="dw-unit"> kW 冷</span></div>
                  <div><span className="dw-num">{calc.load.heatingLoad ?? '—'}</span><span className="dw-unit"> kW 热</span></div>
                  <div className="dw-tag">{calc.load.method} · {calc.load.accuracy}</div>
                </div>
              ) : <div className="dw-empty-sm">面积为 0，未计算负荷</div>}

              <div className="dw-h2" style={{ marginTop: 20 }}>五恒维度达标</div>
              <div className="dw-dims">
                {calc.comfortDimensions.map((d) => (
                  <div key={d.key} className={`dw-dim ${d.ok === true ? 'ok' : d.ok === false ? 'no' : 'na'}`}>
                    <div className="dw-dim-label">{d.label}</div>
                    <div className="dw-dim-status">{d.ok === true ? '达标' : d.ok === false ? '未达标' : '数据不足'}</div>
                    <div className="dw-dim-basis">{d.basis}</div>
                  </div>
                ))}
              </div>

              <div className="dw-h2" style={{ marginTop: 20 }}>必算校验闸</div>
              <div className={`dw-gate ${calc.releasable ? 'pass' : 'block'}`}>
                <span className="dw-gate-dot" />
                {calc.releasable
                  ? (calc.requiresOverride ? '软闸告警：可放行但需经销商签字越过' : '校验闸通过，可直接出图/锁价')
                  : '校验闸拦截：不可出图/锁价，须签字越过'}
              </div>
              <div className="dw-checks">
                {calc.gate?.checks?.map((c) => (
                  <div key={c.key} className="dw-check">
                    <span className={`dw-check-badge ${c.status}`}>{c.status}</span>
                    <span className="dw-check-key">{c.label || c.key}</span>
                    {c.detail && <span className="dw-check-detail">{c.detail}</span>}
                  </div>
                ))}
              </div>

              <div className="dw-disclaimer">{calc.disclaimer}</div>

              {/* 签章 */}
              <div className="dw-h2" style={{ marginTop: 20 }}>复核签章</div>
              {!release ? (
                <button className="dw-btn" disabled={signBusy} onClick={draft}>
                  {signBusy ? '起草中…' : '起草方案（落台账 + 快照闸结论）'}
                </button>
              ) : (
                <div className="dw-signflow">
                  <Steps status={release.status} />
                  {release.status === 'draft' && (
                    <button className="dw-btn" disabled={signBusy} onClick={() => step(() => design.review(release.id))}>提交评审</button>
                  )}
                  {release.status === 'reviewed' && (
                    <>
                      {release.gateBlocked && !release.overrideSigned && (
                        <div className="dw-override">
                          <label className="dw-label">校验闸拦截 — 签字越过须填写免责理由</label>
                          <textarea className="dw-input" rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
                          <button className="dw-btn dw-btn-warn" disabled={signBusy || !overrideReason.trim()} onClick={() => step(() => design.override(release.id, overrideReason))}>签字越过</button>
                        </div>
                      )}
                      <label className="dw-check-inline">
                        <input type="checkbox" checked={disclaimer} onChange={(e) => setDisclaimer(e.target.checked)} />
                        我已阅读并确认免责声明：精算为工具辅助，经销商为设计合规责任主体。
                      </label>
                      <button className="dw-btn dw-btn-primary" disabled={signBusy || !disclaimer || (!!release.gateBlocked && !release.overrideSigned)} onClick={() => step(() => design.release(release.id, true))}>放行（released）</button>
                    </>
                  )}
                  {release.status === 'released' && (
                    <div className="dw-released">✓ 已放行 · {release.overrideSigned ? '经签字越过' : '校验闸通过'} · 可驱动 Rysnova BIM 出图与锁价</div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Steps({ status }: { status: string }) {
  const order = ['draft', 'reviewed', 'released'];
  const labels: Record<string, string> = { draft: '起草', reviewed: '评审', released: '放行' };
  const idx = order.indexOf(status);
  return (
    <div className="dw-steps">
      {order.map((s, i) => (
        <div key={s} className={`dw-step ${i <= idx ? 'done' : ''} ${i === idx ? 'cur' : ''}`}>
          <span className="dw-step-dot">{i + 1}</span>{labels[s]}
        </div>
      ))}
    </div>
  );
}
