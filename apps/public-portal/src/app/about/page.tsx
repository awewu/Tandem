import type { Metadata } from 'next';
import { GROUP, CONTACT, LINKS } from '../../lib/brand';
import PageHero from '../../components/PageHero';

export const metadata: Metadata = {
  title: 'About Us | Rhautt Comfort Group',
  description: `${GROUP.nameCn}（${GROUP.nameEn}）— 瑞美集团 Rheem · Ruud · EverHot 中国独家授权运营，总部上海。`,
  alternates: { canonical: '/about' },
};

/* Company Info cards — 对标 A.O. Smith: Our Leadership / History / Values / Foundation */
const COMPANY_INFO = [
  { label: 'Our Leadership',  desc: '集团领导团队与管理架构',       href: '/about/leadership' },
  { label: 'Our History',     desc: `成立于 ${GROUP.foundedYear} 年，专注建筑舒适系统集成`, href: '/about/our-story'  },
  { label: 'Our Values',      desc: '诚信 · 创新 · 客户第一',       href: '/about/our-values' },
  { label: 'Our Foundation',  desc: '社会责任与可持续发展承诺',      href: '/sustainability'   },
];

/* Global Operations 精选节点 */
const GLOBAL_OPS = [
  { region: 'China HQ',     location: '上海市浦东新区',          desc: '集团总部 · 全国工程交付中心' },
  { region: 'North China',  location: '北京运营中心',             desc: '华北区域销售 · 工程技术支持' },
  { region: 'South China',  location: '广州运营中心',             desc: '华南区域销售 · 商用项目交付' },
  { region: 'West China',   location: '成都运营中心',             desc: '西南区域销售 · 系统集成服务' },
];

export default function AboutPage() {
  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        eyebrow="ABOUT US · 关于我们"
        title={<>走近 <span style={{ color: 'var(--rh-green)' }}>{GROUP.nameShort}</span></>}
        lead={<>{GROUP.nameCn}是瑞美集团（Rheem）独家授权，Rheem · Ruud · EverHot 中国独家运营方，总部上海，专注建筑热水、采暖制冷、空气品质、水处理与智控系统的整体集成与工程交付。</>}
      />

      {/* ── Company Info 四格子 — 对标 A.O. Smith About Us grid ── */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ marginBottom: 8 }}>Company Info</p>
          <h2 style={{ fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 40 }}>
            了解{GROUP.nameShort}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
            {COMPANY_INFO.map(item => (
              <a key={item.label} href={item.href} className="rh-card-hover" style={{
                display: 'block', padding: '32px 28px',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                textDecoration: 'none', color: 'var(--rh-t1)', background: '#fff',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t3)', lineHeight: 1.6, marginBottom: 18 }}>{item.desc}</div>
                <span style={{ fontSize: 12, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Learn More →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Global Operations — 对标 A.O. Smith HQ + Global Locations ── */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 64, alignItems: 'start' }}>
            <div>
              <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Global Operations</p>
              <h2 style={{ fontSize: 'clamp(20px,3vw,32px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.25 }}>
                {GROUP.nameShort} Operations<br />世界总部
              </h2>
              <div style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 2.0, marginBottom: 24 }}>
                <strong>{GROUP.nameCn}</strong><br />
                {CONTACT.address}<br />
                热线：{CONTACT.hotline}<br />
                {CONTACT.hours}
              </div>
              <a href="/contact" className="rh-btn rh-btn-brand" style={{ padding: '11px 26px', fontSize: 14 }}>
                Contact Us
              </a>
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--rh-t3)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 20 }}>China Operations</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {GLOBAL_OPS.map(op => (
                  <div key={op.region} style={{
                    padding: '18px 22px', background: '#fff',
                    border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-md)',
                    borderLeft: '4px solid var(--rh-green)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{op.region}</span>
                      <span style={{ fontSize: 12, color: 'var(--rh-t3)' }}>{op.location}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--rh-t3)' }}>{op.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 集团发展历程时间线 ── */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
        <div className="rh-container" style={{ textAlign: 'center' }}>
          <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Our History</p>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Integrity, Innovation and Customer Satisfaction since {GROUP.foundedYear}
          </h2>
          <p style={{ fontSize: 14, color: 'var(--rh-t3)', maxWidth: 520, margin: '0 auto 32px', lineHeight: 1.8 }}>
            集团成立于 {GROUP.foundedYear} 年。完整发展大事记正在整理，将于核实后发布。
          </p>
          <a href="/about/our-story" className="rh-btn rh-btn-outline" style={{ padding: '11px 28px', fontSize: 14 }}>
            View Our History →
          </a>
        </div>
      </section>

      {/* ── Investors + Careers CTA band ── */}
      <section style={{ background: 'var(--rh-s2)', padding: '72px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rh-green)', marginBottom: 16 }}>
            Work With Us
          </p>
          <h2 className="rh-display" style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rh-t1)', marginBottom: 14 }}>
            成为我们的合作伙伴
          </h2>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', maxWidth: 460, margin: '0 auto 36px', lineHeight: 1.8 }}>
            经销商合作、工程项目、品牌咨询或职业发展，欢迎联系。
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/contact" className="rh-btn rh-btn-brand" style={{ padding: '13px 32px', fontSize: 14 }}>Contact Us</a>
            <a href="/careers" className="rh-btn rh-btn-outline" style={{ padding: '13px 28px', fontSize: 14 }}>Careers</a>
            <a href={LINKS.dealer} target="_blank" rel="noreferrer" className="rh-btn rh-btn-outline" style={{ padding: '13px 28px', fontSize: 14 }}>Investors →</a>
          </div>
        </div>
      </section>

    </main>
  );
}
