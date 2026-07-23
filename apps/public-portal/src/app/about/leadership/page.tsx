import type { Metadata } from 'next';
import { GROUP, CONTACT, LEADERS, LEADERS_MORE } from '../../../lib/brand';
import PageHero from '../../../components/PageHero';

export const metadata: Metadata = {
  title: 'Our Leadership | Rhautt Comfort Group',
  description: `${GROUP.nameCn}核心管理团队 — 拥有共同价值观的专业高效团队，深耕暖通与家电行业。`,
  alternates: { canonical: '/about/leadership' },
};

export default function LeadershipPage() {
  return (
    <main id="main">

      {/* Hero */}
      <PageHero
        minHeight={360}
        eyebrow="LEADERSHIP · 核心管理团队"
        title={<>拥有共同价值观的<br /><span style={{ color: 'var(--rh-green)' }}>专业高效团队</span></>}
        lead={<>经验丰富的管理团队与拥有共同价值观的核心员工，是{GROUP.nameShort}未来发展的重要驱动力。</>}
      />

      {/* 核心领导（详细履历） */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Executive Leadership</p>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 40 }}>核心管理层</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 24 }}>
            {LEADERS.map(l => (
              <div key={l.en} style={{
                padding: '36px 32px', background: 'var(--rh-s2)',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--rh-green)' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
                  <div className="rh-display" style={{ fontSize: 28, color: 'var(--rh-t1)' }}>{l.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--rh-t3)', letterSpacing: '0.04em' }}>{l.en}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 18 }}>{l.role}</div>
                <p style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.85, marginBottom: 20 }}>{l.bio}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--rh-border)', paddingTop: 18 }}>
                  {l.creds.map(c => (
                    <li key={c} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: 'var(--rh-t2)', lineHeight: 1.6 }}>
                      <span aria-hidden style={{ color: 'var(--rh-green)', fontWeight: 700, flexShrink: 0 }}>—</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 其他管理成员（占位） */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Management Team</p>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>管理团队</h2>
          <p style={{ fontSize: 13, color: 'var(--rh-t3)', marginBottom: 36, maxWidth: 560 }}>
            以下成员详细介绍正在整理中，将于核实后发布。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16 }}>
            {LEADERS_MORE.map(m => (
              <div key={m.en} style={{
                padding: '24px 22px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: 'var(--rh-s2)', border: '1px solid var(--rh-border)', marginBottom: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 700, color: 'var(--rh-t3)',
                }}>{m.name.charAt(0)}</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--rh-t1)' }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--rh-t3)', marginBottom: 6 }}>{m.en}</div>
                <div style={{ fontSize: 12, color: 'var(--rh-green)', fontWeight: 600 }}>{m.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Board note */}
      <section className="rh-section" style={{ background: '#fff', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container" style={{ maxWidth: 680, textAlign: 'center' }}>
          <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Board of Directors</p>
          <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 14 }}>董事会与治理</h2>
          <p style={{ fontSize: 14, color: 'var(--rh-t3)', lineHeight: 1.8, marginBottom: 28 }}>
            集团以董事会 + 审计/薪酬/提名委员会构建治理层，详见公司治理页。如有治理相关咨询，欢迎通过官方邮件联系。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/about/governance" className="rh-btn rh-btn-brand" style={{ padding: '11px 26px', fontSize: 14 }}>公司治理 →</a>
            <a href={`mailto:${CONTACT.emails.business}`} className="rh-btn rh-btn-outline" style={{ padding: '11px 26px', fontSize: 14 }}>Contact Us</a>
          </div>
        </div>
      </section>

    </main>
  );
}
