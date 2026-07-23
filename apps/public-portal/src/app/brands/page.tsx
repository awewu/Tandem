import type { Metadata } from 'next';
import { GROUP, BRAND_MATRIX, LINKS } from '../../lib/brand';
import PageHero from '../../components/PageHero';
import BrandLogo from '../../components/BrandLogo';

export const metadata: Metadata = {
  title: 'Our Brands | Rhautt Comfort Group',
  description: `${GROUP.nameShort}独家运营 Rheem · Ruud · EverHot · Rysnova — 了解每个品牌的定位、授权关系与产品系统。`,
  alternates: { canonical: '/brands' },
};

const WHY = [
  { title: '独家授权', desc: '瑞美集团（Rheem）正式授权，中国区唯一运营主体。', accent: 'var(--rh-green)' },
  { title: '系统集成', desc: '三大品牌横跨热水、采暖制冷、净水，覆盖建筑全系统需求。', accent: 'var(--rh-green)' },
  { title: '工程交付', desc: '全国认证工程师团队，从设计到安装验收一站完成。', accent: 'var(--rh-green)' },
  { title: 'AI 辅助', desc: '自主研发瑞诺瓦 Rysnova 选型与 AI 问诊工具，提升方案精度。', accent: 'var(--rh-green)' },
];

const BRAND_DETAIL = [
  {
    name: 'Rheem',
    tagline: 'Built to a Higher Standard®',
    desc: '瑞美集团旗舰品牌，覆盖燃气、电热、热泵及即热式全系热水器，广泛应用于住宅、酒店与商业楼宇。',
    features: ['燃气热水器', '电热水器', '热泵热水器', '即热式热水机'],
    relation: '中国独家授权运营',
    href: LINKS.rheem,
    accentColor: 'var(--rh-green)',
  },
  {
    name: 'Ruud',
    tagline: 'Rely on Ruud™',
    desc: '面向专业工程市场的 HVAC + 热水系统品牌，以工业级可靠性著称，大量应用于商业、工业与工程项目。',
    features: ['商用热泵系统', '空气源热泵', '屋顶机组', '大容量储热系统'],
    relation: '中国独家授权运营',
    href: LINKS.ruud,
    accentColor: 'var(--rh-green)',
  },
  {
    name: 'EverHot',
    tagline: 'Always Hot, Always Ready',
    desc: '瑞美集团专属品牌，专为高频热水场景设计，适用于宿舍、工厂、浴室中心等大流量应用。',
    features: ['大流量即热', '商用储热罐', '高频热水系统', '宿舍/工厂专用'],
    relation: '中国独家授权运营',
    href: LINKS.everhot,
    accentColor: 'var(--rh-green)',
  },
  {
    name: 'Rysnova',
    tagline: '以 AI 连接每一个舒适家',
    desc: '瑞合瑞德自主品牌，定位中立行业工具，提供 AI 舒适家问诊与建筑系统智能选型服务，连接用户与专业工程师。',
    features: ['AI 症状问诊', '智能选型推荐', '工程师对接', '方案生成报告'],
    relation: '集团自主品牌',
    href: LINKS.diagnosis,
    accentColor: 'var(--rh-green-dk)',
  },
];

export default function BrandsPage() {
  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        eyebrow="OUR BRANDS · 旗下品牌"
        title={<>旗下<span style={{ color: 'var(--rh-green)' }}>品牌</span></>}
        lead={<>{GROUP.nameShort}以 Rheem · Ruud · EverHot 中国独家运营资源，为住宅与商用客户提供热水、采暖制冷与空气品质的创新解决方案。</>}
      />

      {/* ── Featured Brands section header ── */}
      <div style={{ background: '#fff', padding: '48px 32px 0', borderBottom: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ marginBottom: 8 }}>Featured Brands</p>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 0, paddingBottom: 32 }}>全部品牌</h2>
        </div>
      </div>

      {/* 品牌详情 */}
      <section className="rh-section" style={{ background: 'var(--rh-s1)' }}>
        <div className="rh-container" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
          {BRAND_DETAIL.map((b, i) => (
            <div key={b.name} className="rh-card-hover" style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
              gap: 36, alignItems: 'start',
              background: i % 2 === 0 ? '#fff' : '#F5F0EB',
              borderRadius: 'var(--rh-r-lg)', padding: '40px 36px',
              border: '1px solid var(--rh-border)', position: 'relative', overflow: 'hidden',
            }}>
              {/* 顶线 accent */}
              <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: b.accentColor }} />

              <div>
                <div style={{ height: 52, display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                  <BrandLogo name={b.name} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--rh-t3)', fontStyle: 'italic', marginBottom: 18 }}>{b.tagline}</div>
                <p style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.85, marginBottom: 20 }}>{b.desc}</p>
                <span className="rh-badge rh-badge-auth" style={{ marginBottom: 24, display: 'inline-block' }}>{b.relation}</span>
                <br />
                <a href={b.href} target="_blank" rel="noreferrer" className="rh-btn rh-btn-brand" style={{ padding: '10px 24px', fontSize: 13, display: 'inline-flex' }}>
                  访问品牌官网 →
                </a>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rh-t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
                  产品覆盖
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {b.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="rh-bolt" style={{ flexShrink: 0, background: b.accentColor }} />
                      <span style={{ fontSize: 14, color: 'var(--rh-t1)', fontWeight: 500 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Rhautt — 对标 A.O. Smith "Why A.O. Smith?" 四栏 */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', color: 'var(--rh-t1)' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p className="rh-eyebrow" style={{ color: 'var(--rh-green)', marginBottom: 10 }}>WHY {GROUP.nameShort.toUpperCase()}?</p>
            <h2 className="rh-display" style={{ fontSize: 'clamp(22px,3vw,40px)', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rh-t1)' }}>
              Why <span style={{ color: 'var(--rh-green)' }}>{GROUP.nameShort}</span>?
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
            {WHY.map(w => (
              <div key={w.title} style={{
                padding: '32px 24px',
                border: '1px solid var(--rh-border)',
                borderRadius: 'var(--rh-r-lg)',
                background: '#fff',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 10, color: 'var(--rh-t1)' }}>{w.title}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.7 }}>{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--rh-s2)', padding: '64px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <h2 style={{ fontFamily: 'var(--rh-display)', fontSize: 'clamp(22px,3vw,38px)', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rh-t1)', marginBottom: 16 }}>
            了解适合您项目的品牌方案
          </h2>
          <a href="/contact" className="rh-btn rh-btn-brand" style={{ padding: '14px 36px', fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            联系我们
          </a>
        </div>
      </section>

    </main>
  );
}
