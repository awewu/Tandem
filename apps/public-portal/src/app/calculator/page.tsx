'use client';
import { useState } from 'react';
import { LINKS } from '../../lib/brand';
import PageHero from '../../components/PageHero';

/* ── 能效对比计算器（估算模型，展示用）──
   模型假设：
   - 采暖负荷 ≈ 面积 × 单位热负荷（气候分区系数）
   - 采暖季运行小时数按气候分区取典型值
   - 热泵 COP 4.2 / 电采暖 COP 1.0 / 燃气炉效率 92%
   - 电价 0.6 元/kWh，气价 3.2 元/m³（燃气热值 10 kWh/m³）
   - 碳排因子：电 0.581 kgCO₂/kWh（全国电网平均）、天然气 2.16 kgCO₂/m³
   正式发布须由工程部核定参数 */

const CLIMATE = [
  { key: 'north',   label: '严寒/寒冷（北方）',   wPerSqm: 70, hours: 2400 },
  { key: 'yangtze', label: '夏热冬冷（长江流域）', wPerSqm: 55, hours: 1500 },
  { key: 'south',   label: '夏热冬暖（华南）',     wPerSqm: 40, hours: 600  },
];

const ELEC_PRICE = 0.6;      // 元/kWh
const GAS_PRICE = 3.2;       // 元/m³
const GAS_KWH = 10;          // kWh/m³
const GAS_EFF = 0.92;
const HP_COP = 4.2;
const CO2_ELEC = 0.581;      // kgCO₂/kWh
const CO2_GAS = 2.16;        // kgCO₂/m³

export default function CalculatorPage() {
  const [area, setArea] = useState(120);
  const [climate, setClimate] = useState(CLIMATE[1]);

  /* 采暖季总热量需求 kWh */
  const heatDemand = (area * climate.wPerSqm * climate.hours) / 1000;

  /* 三种方案 */
  const hpElec = heatDemand / HP_COP;
  const hpCost = hpElec * ELEC_PRICE;
  const hpCO2 = hpElec * CO2_ELEC;

  const ehElec = heatDemand / 1.0;
  const ehCost = ehElec * ELEC_PRICE;
  const ehCO2 = ehElec * CO2_ELEC;

  const gasM3 = heatDemand / (GAS_KWH * GAS_EFF);
  const gasCost = gasM3 * GAS_PRICE;
  const gasCO2 = gasM3 * CO2_GAS;

  const fmt = (n: number) => Math.round(n).toLocaleString('zh-CN');

  const ROWS = [
    { name: 'Rhautt 变频热泵', note: `COP ${HP_COP}`, cost: hpCost, co2: hpCO2, hero: true },
    { name: '电采暖（电暖器/电锅炉）', note: 'COP 1.0', cost: ehCost, co2: ehCO2, hero: false },
    { name: '燃气壁挂炉', note: `效率 ${GAS_EFF * 100}%`, cost: gasCost, co2: gasCO2, hero: false },
  ];

  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        minHeight={300}
        eyebrow="ENERGY SAVINGS CALCULATOR · 能效对比"
        title={<>能效<span style={{ color: 'var(--rh-green)' }}>计算器</span></>}
        lead={<>输入采暖面积与所在气候区，对比热泵、电采暖与燃气炉的采暖季运行费用与碳排放。结果为模型估算，实际以现场勘测为准。</>}
      />

      {/* ── 输入区 ── */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
        <div className="rh-container" style={{ maxWidth: 860 }}>
          <div style={{
            background: '#fff', border: '1px solid var(--rh-border)',
            borderRadius: 'var(--rh-r-lg)', padding: '36px 36px 32px',
            borderTop: '4px solid var(--rh-green)',
          }}>
            {/* 面积滑块 */}
            <label style={{ display: 'block', marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>采暖面积</span>
                <span style={{ fontFamily: 'var(--rh-display)', fontSize: 26, color: 'var(--rh-green)', lineHeight: 1 }}>{area} ㎡</span>
              </div>
              <input
                type="range" min={40} max={500} step={10} value={area}
                onChange={e => setArea(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#4E9A3D' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--rh-t3)', marginTop: 4 }}>
                <span>40㎡</span><span>500㎡</span>
              </div>
            </label>

            {/* 气候区 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>所在气候区</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {CLIMATE.map(c => (
                  <button key={c.key} onClick={() => setClimate(c)} style={{
                    padding: '11px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: climate.key === c.key ? '2px solid var(--rh-green)' : '1px solid var(--rh-border)',
                    borderRadius: 'var(--rh-r-md)',
                    background: climate.key === c.key ? 'var(--rh-green-soft)' : '#fff',
                    color: climate.key === c.key ? 'var(--rh-green)' : 'var(--rh-t2)',
                  }}>{c.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 结果对比 ── */}
          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>采暖季运行对比</h2>
            <p style={{ fontSize: 12, color: 'var(--rh-t3)', marginBottom: 20 }}>
              估算总热量需求 {fmt(heatDemand)} kWh/采暖季 · 电价 {ELEC_PRICE} 元/kWh · 气价 {GAS_PRICE} 元/m³（模型估算，实际以现场勘测为准）
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ROWS.map(r => (
                <div key={r.name} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 24, alignItems: 'center',
                  padding: '22px 26px', borderRadius: 'var(--rh-r-lg)',
                  background: r.hero ? 'var(--rh-green-dk)' : '#fff',
                  color: r.hero ? '#fff' : 'var(--rh-t1)',
                  border: r.hero ? 'none' : '1px solid var(--rh-border)',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {r.name}
                      {r.hero && <span style={{
                        marginLeft: 10, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                        background: 'var(--rh-green-2)', color: '#fff', letterSpacing: '0.06em', verticalAlign: 'middle',
                      }}>推荐</span>}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3 }}>{r.note}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--rh-display)', fontSize: 24, color: r.hero ? 'var(--rh-green)' : 'var(--rh-t1)', lineHeight: 1 }}>
                      ¥{fmt(r.cost)}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>运行费用/季</div>
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div style={{ fontFamily: 'var(--rh-display)', fontSize: 24, lineHeight: 1, color: r.hero ? '#4ADE80' : 'var(--rh-t2)' }}>
                      {fmt(r.co2)}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>kgCO₂/季</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 节省摘要 */}
            <div style={{
              marginTop: 20, padding: '22px 26px', borderRadius: 'var(--rh-r-lg)',
              background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.20)',
              display: 'flex', gap: 32, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700, marginBottom: 4 }}>vs. 电采暖 每季节省</div>
                <div style={{ fontFamily: 'var(--rh-display)', fontSize: 28, color: '#16A34A', lineHeight: 1 }}>¥{fmt(ehCost - hpCost)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700, marginBottom: 4 }}>vs. 燃气炉 每季节省</div>
                <div style={{ fontFamily: 'var(--rh-display)', fontSize: 28, color: '#16A34A', lineHeight: 1 }}>¥{fmt(Math.max(0, gasCost - hpCost))}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700, marginBottom: 4 }}>vs. 电采暖 碳减排</div>
                <div style={{ fontFamily: 'var(--rh-display)', fontSize: 28, color: '#16A34A', lineHeight: 1 }}>{fmt(ehCO2 - hpCO2)} kg</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
              <a href="/dealers" className="rh-btn rh-btn-brand" style={{ padding: '13px 30px', fontSize: 14 }}>
                预约经销商现场勘测
              </a>
              <a href={LINKS.diagnosis} target="_blank" rel="noreferrer" className="rh-btn rh-btn-outline" style={{ padding: '13px 26px', fontSize: 14 }}>
                在线选型建议
              </a>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
