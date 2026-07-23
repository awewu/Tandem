'use client';
import { useState } from 'react';
import { getToken } from '@rhautt/shared-auth';

const C = {
  hdr:   { background: 'var(--t-strong)', color: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 } as const,
  title: { fontSize: 22, fontWeight: 700, letterSpacing: '-0.005em' } as const,
  back:  { fontSize: 22, cursor: 'pointer', color: 'var(--t-secondary)', lineHeight: 1 } as const,
  label: { fontSize: 12, color: 'var(--t-secondary)', marginBottom: 5, display: 'block' } as const,
  input: { width: '100%', border: '1px solid var(--border-2)', borderRadius: 8, padding: '12px', fontSize: 15, outline: 'none', marginBottom: 10 } as const,
  row:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } as const,
  pain:  (a:boolean) => ({ padding: '10px', border: `2px solid ${a?'var(--brand)':'var(--border-2)'}`, borderRadius: 8, background: a?'var(--brand-tint)':'#fff', cursor: 'pointer', textAlign:'center' as const, fontSize: 13 }),
  btn:   { width: '100%', background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 10, padding: '15px', fontSize: 16, fontWeight: 700, marginTop: 8 } as const,
  pkg:   (t:number) => ({ borderRadius: 10, padding: 14, marginBottom: 10, border: `2px solid ${t===0?'var(--brand)':'var(--border-2)'}`, background: t===0?'var(--brand-tint)':'#fff' }),
  pkgN:  { fontSize: 14, fontWeight: 700 } as const,
  pkgP:  { fontSize: 24, fontWeight: 700, color: 'var(--brand)', margin: '4px 0', fontVariantNumeric: 'tabular-nums' } as const,
  pkgD:  { fontSize: 12, color: 'var(--t-secondary)' } as const,
  share: { background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 10, padding: '15px', fontSize: 16, fontWeight: 700, width: '100%', marginTop: 8 } as const,
};

const PAINS = [
  { id: 'hot_water',     label: '🚿 热水', desc: '等待久/不够用' },
  { id: 'heating',       label: '🔥 采暖', desc: '地暖/暖气' },
  { id: 'water_quality', label: '💧 净水', desc: '水质差/水垢' },
  { id: 'fresh_air',     label: '🌬️ 新风', desc: '空气闷/过敏' },
  { id: 'air',           label: '❄️ 空调', desc: '制冷/恒温' },
  { id: 'smart',         label: '📱 智控', desc: 'Econet联动' },
];

const PRICES: Record<string, number> = { hot_water: 32000, heating: 42000, water_quality: 16000, fresh_air: 26000, air: 52000, smart: 0 };

export default function MobilePage() {
  const [step, setStep]     = useState(0);
  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [area, setArea]     = useState('');
  const [city, setCity]     = useState('上海');
  const [address, setAddress] = useState('');
  const [pains, setPains]   = useState<string[]>([]);
  const [result, setResult] = useState<{ packages: { name:string; price:number; desc:string }[] } | null>(null);
  const [saved, setSaved]   = useState(false);
  const [loading, setLoading] = useState(false);
  const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token') || '') : '';

  const go = async () => {
    if (step === 0) { if (!name || !phone || !area) return alert('请填写完整'); setStep(1); return; }
    if (step === 1) { if (!pains.length) return alert('请选择痛点'); setStep(2); calc(); }
  };

  const calc = async () => {
    setLoading(true);
    try {
      const loadR = await fetch('/api/v2/quotation/load-calc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: Number(area), city }),
      });
      const { coolingLoad = Number(area) * 0.12 } = loadR.ok ? (await loadR.json()) : {};
      const base = pains.reduce((s, p) => s + (PRICES[p] || 20000), Math.round(coolingLoad * 7500));
      const smart = pains.includes('smart');
      const econet = smart ? Math.round(base * 0.12) : 0;
      setResult({ packages: [
        { name: '推荐方案', price: base,                        desc: '高性价比，满足核心需求' },
        { name: '升级方案', price: Math.round(base * 1.28),     desc: '品质升级，优选设备' },
        { name: `旗舰方案${smart?'·Econet':''}`, price: Math.round(base * 1.65 + econet), desc: `全屋舒适${smart?'，智能联动加成12%':''}` },
      ]});
    } catch {}
    setLoading(false);
  };

  const saveLead = async () => {
    if (saved) return;
    try {
      await fetch('/api/v2/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone, name, source: 'mobile_quick', city, address, profile: { area: Number(area), systems: pains } }),
      });
      setSaved(true);
    } catch {}
  };

  const shareLink = () => {
    const url = `${window.location.origin.replace('5000', '5001')}`;
    if (navigator.share) navigator.share({ title: '瑞诺瓦舒适家方案', url });
    else { navigator.clipboard.writeText(url); alert('问诊链接已复制，可发给客户'); }
  };

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container" style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 80px' }}>
        <div style={C.hdr}>
          {step > 0 && <span style={C.back} onClick={() => setStep(s => s - 1)}>‹</span>}
          <span style={C.title}>{['录入客户信息', '选择舒适痛点', '查看方案报价'][step]}</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--t-secondary)' }}>{step + 1}/3</span>
        </div>

        {step === 0 && (
          <div className="card-elevated" style={{ padding: '16px', margin: '16px' }}>
            <label style={C.label}>客户姓名</label>
            <input style={C.input} placeholder="称呼" value={name} onChange={e => setName(e.target.value)} />
            <label style={C.label}>手机号</label>
            <input style={C.input} type="tel" placeholder="13800000000" value={phone} onChange={e => setPhone(e.target.value)} />
            <div style={C.row}>
              <div><label style={C.label}>建筑面积（㎡）</label><input style={C.input} type="number" placeholder="150" value={area} onChange={e => setArea(e.target.value)} /></div>
              <div><label style={C.label}>城市</label><input style={C.input} placeholder="上海" value={city} onChange={e => setCity(e.target.value)} /></div>
            </div>
            <label style={C.label}>项目地址</label>
            <input style={C.input} placeholder="小区 / 楼栋 / 门牌（项目唯一标识）" value={address} onChange={e => setAddress(e.target.value)} />
            <button style={C.btn} onClick={go}>下一步 →</button>
          </div>
        )}

        {step === 1 && (
          <div className="card-elevated" style={{ padding: '16px', margin: '16px' }}>
            <p style={{ fontSize: 13, color: 'var(--t-secondary)', marginBottom: 12 }}>客户有哪些舒适痛点？（可多选）</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {PAINS.map(p => (
                <div key={p.id} style={C.pain(pains.includes(p.id))} onClick={() => setPains(ps => ps.includes(p.id) ? ps.filter(x => x !== p.id) : [...ps, p.id])}>
                  <div style={{ fontSize: 20 }}>{p.label.split(' ')[0]}</div>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{p.label.split(' ')[1]}</div>
                  <div style={{ fontSize: 11, color: 'var(--t-secondary)', marginTop: 1 }}>{p.desc}</div>
                </div>
              ))}
            </div>
            <button style={C.btn} onClick={go}>生成方案 →</button>
          </div>
        )}

        {step === 2 && (
          <div className="card-elevated" style={{ padding: '16px', margin: '16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--t-secondary)' }}>⚡ 正在计算方案...</div>
            ) : result && (
              <>
                <p style={{ fontSize: 13, color: 'var(--t-secondary)', marginBottom: 12 }}>
                  {name} · {area}㎡ · {city} · {pains.length}个系统
                </p>
                {result.packages.map((p, i) => (
                  <div key={i} style={C.pkg(i)}>
                    <div style={C.pkgN}>{p.name}</div>
                    <div style={C.pkgP}>¥{p.price.toLocaleString()}</div>
                    <div style={C.pkgD}>{p.desc}</div>
                  </div>
                ))}
                <button style={{ ...C.btn, background: saved ? 'var(--t-secondary)' : 'var(--brand)' }} onClick={saveLead}>
                  {saved ? '✓ 已录入 CRM' : '📋 录入 CRM 跟进'}
                </button>
                <button style={C.share} onClick={shareLink}>
                  📲 发给客户自助问诊
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
