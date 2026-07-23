'use client';
import { useState } from 'react';
import { CONTACT } from '../../lib/brand';
import PageHero from '../../components/PageHero';

/* ── 经销商静态数据（示意，待商务部核定后替换）── */
const DEALERS = [
  { city: '上海', name: '瑞合瑞德旗舰体验中心', district: '浦东新区', addr: '浦东新区（详细地址待发布）', tel: '400-886-9119', tags: ['体验中心', '全品类', '工程'] },
  { city: '上海', name: '瑞合舒适家（虹桥店）', district: '闵行区', addr: '闵行区（详细地址待发布）', tel: '400-886-9119', tags: ['零售', '安装'] },
  { city: '北京', name: '瑞合瑞德北方运营中心', district: '朝阳区', addr: '朝阳区（详细地址待发布）', tel: '400-886-9119', tags: ['工程', '全品类'] },
  { city: '杭州', name: '瑞合舒适家（杭州店）', district: '西湖区', addr: '西湖区（详细地址待发布）', tel: '400-886-9119', tags: ['零售', '安装'] },
  { city: '南京', name: '瑞合舒适家（南京店）', district: '建邺区', addr: '建邺区（详细地址待发布）', tel: '400-886-9119', tags: ['零售', '安装'] },
  { city: '苏州', name: '瑞合舒适家（苏州店）', district: '工业园区', addr: '工业园区（详细地址待发布）', tel: '400-886-9119', tags: ['零售', '安装'] },
  { city: '成都', name: '瑞合瑞德西南运营中心', district: '高新区', addr: '高新区（详细地址待发布）', tel: '400-886-9119', tags: ['工程', '全品类'] },
  { city: '深圳', name: '瑞合舒适家（深圳店）', district: '南山区', addr: '南山区（详细地址待发布）', tel: '400-886-9119', tags: ['零售', '安装'] },
];

const CITIES = ['全部', ...Array.from(new Set(DEALERS.map(d => d.city)))];

export default function DealersPage() {
  const [city, setCity] = useState('全部');
  const [q, setQ] = useState('');

  const filtered = DEALERS.filter(d =>
    (city === '全部' || d.city === city) &&
    (q === '' || d.name.includes(q) || d.district.includes(q) || d.city.includes(q))
  );

  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        minHeight={300}
        eyebrow="DEALER LOCATOR · 查找经销商"
        title={<>查找<span style={{ color: 'var(--rh-green)' }}>经销商</span></>}
        lead={<>查找您附近的授权经销商与体验中心，获取产品咨询、安装与售后服务。</>}
      />

      {/* ── 搜索工具条 ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--rh-border)', position: 'sticky', top: 68, zIndex: 40 }}>
        <div className="rh-container" style={{
          display: 'flex', gap: 12, padding: '16px 32px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <input
            type="search"
            placeholder="搜索城市 / 区域 / 门店名"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{
              flex: 1, minWidth: 220, padding: '11px 16px', fontSize: 14,
              border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-md)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CITIES.map(c => (
              <button key={c} onClick={() => setCity(c)} style={{
                padding: '9px 16px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                borderRadius: 'var(--rh-r-md)',
                background: city === c ? 'var(--rh-green)' : 'var(--rh-s2)',
                color: city === c ? '#fff' : 'var(--rh-t2)',
              }}>{c}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 结果列表 ── */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
        <div className="rh-container">
          <p style={{ fontSize: 13, color: 'var(--rh-t3)', marginBottom: 20 }}>
            共 {filtered.length} 家授权网点（网点信息持续更新中）
          </p>
          {filtered.length === 0 ? (
            <div style={{
              padding: '56px 32px', textAlign: 'center', background: '#fff',
              borderRadius: 'var(--rh-r-lg)', border: '1px solid var(--rh-border)',
            }}>
              <p style={{ fontSize: 15, color: 'var(--rh-t2)', marginBottom: 12 }}>该区域暂无授权网点</p>
              <p style={{ fontSize: 13, color: 'var(--rh-t3)' }}>
                请致电全国服务热线 <a href={`tel:${CONTACT.hotlineTel}`} style={{ color: 'var(--rh-green)', fontWeight: 700 }}>{CONTACT.hotline}</a> 获取就近服务
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 16 }}>
              {filtered.map(d => (
                <div key={d.name} className="rh-card-hover" style={{
                  padding: '26px 26px 22px', background: '#fff',
                  border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: 'var(--rh-green-soft)', color: 'var(--rh-green)',
                    }}>{d.city}</span>
                    {d.tags.map(t => (
                      <span key={t} style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4,
                        background: 'var(--rh-s2)', color: 'var(--rh-t3)',
                      }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{d.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--rh-t3)', lineHeight: 1.7, marginBottom: 14 }}>{d.addr}</div>
                  <a href={`tel:${d.tel.replace(/-/g, '')}`} style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--rh-green)', textDecoration: 'none',
                  }}>{d.tel} →</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 成为经销商 CTA ── */}
      <section style={{ background: 'var(--rh-s2)', padding: '64px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <h2 className="rh-display" style={{ fontSize: 'clamp(22px,3.5vw,38px)', color: 'var(--rh-t1)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
          成为授权经销商
        </h2>
        <p style={{ fontSize: 15, color: 'var(--rh-t2)', marginBottom: 28, maxWidth: 460, margin: '0 auto 28px' }}>
          加入 Rhautt 经销网络，获得品牌授权、培训认证与工程支持。
        </p>
        <a href="/professional" className="rh-btn rh-btn-brand" style={{
          padding: '13px 34px', fontSize: 14,
          fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          了解合作政策
        </a>
      </section>

    </main>
  );
}
