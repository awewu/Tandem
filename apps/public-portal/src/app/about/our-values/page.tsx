import type { Metadata } from 'next';
import { GROUP, MISSION, VISION, VALUES, PRINCIPLES, AWARDS } from '../../../lib/brand';
import PageHero from '../../../components/PageHero';

export const metadata: Metadata = {
  title: 'Mission, Vision & Values | Rhautt Comfort Group',
  description: `${GROUP.nameCn}使命 · 愿景 · 核心价值观「四个满意」· 六项基本原则 — 成为受人尊重的水和空气产品及解决方案可持续发展的引领者。`,
  alternates: { canonical: '/about/our-values' },
};

export default function OurValuesPage() {
  return (
    <main id="main">

      {/* Hero — 愿景置顶（对标 A.O. Smith：Vision 一句话打头） */}
      <PageHero
        eyebrow="MISSION · VISION · VALUES"
        title={<>成为可持续发展的<span style={{ color: 'var(--rh-green)' }}>引领者</span></>}
        lead={<>{VISION.cn}</>}
      >
        <p style={{ fontSize: 13, color: 'var(--rh-t3)', letterSpacing: '0.02em' }}>{VISION.en}</p>
      </PageHero>

      {/* Mission 使命 */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,240px) 1fr', gap: 'clamp(24px,5vw,72px)', alignItems: 'start' }}>
          <div>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Our Mission</p>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>公司使命</h2>
          </div>
          <div>
            <p style={{ fontSize: 'clamp(18px,2.2vw,26px)', color: 'var(--rh-t1)', lineHeight: 1.7, fontWeight: 500 }}>
              {MISSION.cn}
            </p>
            <p style={{ fontSize: 13.5, color: 'var(--rh-t3)', marginTop: 18, lineHeight: 1.8 }}>{MISSION.en}</p>
          </div>
        </div>
      </section>

      {/* 四个满意 Four Satisfaction — 等权价值观卡（对标 A.O. Smith 五价值观卡） */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Core Values · Four Satisfaction</p>
            <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 10 }}>
              核心价值观 · 四个满意
            </h2>
            <p style={{ fontSize: 13, color: 'var(--rh-t3)' }}>* 四个满意为并列关系，不分先后</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 }}>
            {VALUES.map((v, i) => (
              <div key={v.key} style={{
                padding: '34px 28px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--rh-green)', letterSpacing: '0.10em', marginBottom: 16 }}>0{i + 1}</div>
                <div className="rh-display" style={{ fontSize: 24, letterSpacing: '0.01em', color: 'var(--rh-t1)', marginBottom: 4 }}>{v.cn}</div>
                <div style={{ fontSize: 11, color: 'var(--rh-t3)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>{v.en}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.8 }}>{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 六项基本原则 Guiding Principles */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <div style={{ marginBottom: 36 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Guiding Principles</p>
            <h2 style={{ fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, letterSpacing: '-0.02em' }}>六项基本原则</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 0, border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', overflow: 'hidden' }}>
            {PRINCIPLES.map((p, i) => (
              <div key={p.en} style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '22px 26px',
                borderRight: '1px solid var(--rh-border)', borderBottom: '1px solid var(--rh-border)',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--rh-green)', flexShrink: 0 }}>{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rh-t1)' }}>{p.cn}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--rh-t3)', marginTop: 2 }}>{p.en}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 七大价值观奖 Seven Value Awards — 价值观落地机制 */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ marginBottom: 30 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Values in Action · Seven Awards</p>
            <h2 style={{ fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>七大价值观奖</h2>
            <p style={{ fontSize: 14, color: 'var(--rh-t2)', maxWidth: 640, lineHeight: 1.8 }}>
              我们以七大价值观奖将文化落到日常——让每一次担当、创新与坚持都被看见、被尊重。
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {AWARDS.map(a => (
              <div key={a.en} style={{
                display: 'inline-flex', flexDirection: 'column', gap: 2,
                padding: '14px 20px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-md)',
                borderLeft: '3px solid var(--rh-green)',
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--rh-t1)' }}>{a.cn}</span>
                <span style={{ fontSize: 11, color: 'var(--rh-t3)' }}>{a.en}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — 廉正热线 + 加入我们（对标 A.O. Smith：Integrity Helpline） */}
      <section className="rh-section" style={{ background: '#fff', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ maxWidth: 760, textAlign: 'center' }}>
          <p className="rh-eyebrow" style={{ color: 'var(--rh-green)', marginBottom: 16 }}>LIVE OUR VALUES</p>
          <h2 style={{ fontSize: 'clamp(22px,3vw,32px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 18 }}>
            以价值观驱动每一天
          </h2>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.9, marginBottom: 34 }}>
            从产品研发到交付验收、从客户咨询到售后支持，{GROUP.nameCn}以四个满意与六项基本原则作为一切决策的准绳。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/careers" className="rh-btn rh-btn-brand" style={{ padding: '12px 28px', fontSize: 14 }}>加入我们 Careers</a>
            <a href="/about/governance" className="rh-btn rh-btn-outline" style={{ padding: '12px 24px', fontSize: 14 }}>治理与廉正 Governance</a>
          </div>
        </div>
      </section>

    </main>
  );
}
