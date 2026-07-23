import type { Metadata } from 'next';
import { GROUP, HISTORY, ROADMAP } from '../../../lib/brand';
import PageHero from '../../../components/PageHero';

export const metadata: Metadata = {
  title: 'Our History | Rhautt Comfort Group',
  description: `${GROUP.nameCn}发展历程 — 承袭 Rheem 百年基因，立足中国三十载积淀（1994 至今），从快速扩张到 2030 战略新征程。`,
  alternates: { canonical: '/about/our-story' },
};

export default function OurStoryPage() {
  return (
    <main id="main">

      {/* Hero */}
      <PageHero
        minHeight={380}
        eyebrow="OUR HISTORY · 发展历程"
        title={<>立足三十载积淀<br /><span style={{ color: 'var(--rh-green)' }}>开启行业新征程</span></>}
        lead={<>{GROUP.nameShort} · 承袭 Rheem 百年基因，扎根中国自 1994。</>}
      />

      {/* Heritage 数字 */}
      <section style={{ background: '#fff', borderBottom: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 0, padding: '0' }}>
          {HISTORY.heritage.map((h, i) => (
            <div key={h.label} style={{ padding: '40px 28px', borderRight: i < HISTORY.heritage.length - 1 ? '1px solid var(--rh-border)' : 'none' }}>
              <div className="rh-display" style={{ fontSize: 'clamp(34px,5vw,52px)', color: 'var(--rh-green)', lineHeight: 1, marginBottom: 12 }}>{h.value}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rh-t1)', marginBottom: 4 }}>{h.label}</div>
              <div style={{ fontSize: 12, color: 'var(--rh-t3)' }}>{h.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Narrative 集团简介 */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,240px) 1fr', gap: 'clamp(24px,5vw,72px)', alignItems: 'start' }}>
          <div>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Our Story</p>
            <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>百年基因<br />中国征程</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {HISTORY.narrative.map((p, i) => (
              <p key={i} style={{ fontSize: i === 0 ? 17 : 15, color: i === 0 ? 'var(--rh-t1)' : 'var(--rh-t2)', lineHeight: 1.95, fontWeight: i === 0 ? 500 : 400 }}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap 发展路线图 2019–2030 */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ marginBottom: 44 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Roadmap · 2019 → 2030</p>
            <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em' }}>发展路线图</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
            {ROADMAP.map((r, i) => (
              <div key={r.period} style={{
                padding: '30px 26px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--rh-green)', opacity: 0.35 + i * 0.22 }} />
                <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 13, fontWeight: 700, color: 'var(--rh-green)', letterSpacing: '0.04em', marginBottom: 6 }}>{r.period}</div>
                <div className="rh-display" style={{ fontSize: 22, color: 'var(--rh-t1)', marginBottom: 18 }}>{r.phase}</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {r.items.map(it => (
                    <li key={it} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.6 }}>
                      <span aria-hidden style={{ color: 'var(--rh-green)', flexShrink: 0, fontWeight: 700 }}>·</span>{it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#fff', padding: '56px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 18 }}>了解更多关于{GROUP.nameShort}</h2>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/sustainability" className="rh-btn rh-btn-brand" style={{ padding: '11px 28px', fontSize: 14 }}>2030 可持续目标 →</a>
            <a href="/about/our-values" className="rh-btn rh-btn-outline" style={{ padding: '11px 26px', fontSize: 14 }}>使命 · 愿景 · 价值观 →</a>
          </div>
        </div>
      </section>

    </main>
  );
}
