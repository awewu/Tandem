import type { Metadata } from 'next';
import { GROUP, VISION, SUSTAINABILITY_GOALS } from '../../lib/brand';
import PageHero from '../../components/PageHero';

export const metadata: Metadata = {
  title: 'ESG Sustainability | Rhautt Comfort Group',
  description: `${GROUP.nameShort}可持续发展承诺 — 以系统集成能力推动建筑能效提升，助力碳中和与低碳运营。`,
  alternates: { canonical: '/sustainability' },
};

/* 对标 A.O. Smith 可持续优先级 */
const PRIORITIES = [
  {
    code: 'E',
    title: 'Environmental',
    subtitle: '环境可持续',
    desc: '以热泵与余热回收技术，将建筑热水、采暖制冷系统的 COP 提升至 4.0 以上，降低化石燃料依赖。',
  },
  {
    code: 'S',
    title: 'Social',
    subtitle: '社区责任',
    desc: '通过绿色建筑改造、低碳住宅示范项目，让节能技术惠及更广泛的社区与建筑用户。',
  },
  {
    code: 'G',
    title: 'Governance',
    subtitle: '合规治理',
    desc: '遵循瑞美集团（Rheem）全球可持续标准，落实数据透明、供应链责任与诚信经营。',
  },
];

export default function SustainabilityPage() {
  return (
    <main id="main">

      {/* ── Hero ── */}
      <PageHero
        eyebrow="SUSTAINABILITY · 可持续发展"
        title={<>ESG <span style={{ color: 'var(--rh-green)' }}>可持续发展</span></>}
        lead={<>{VISION.cn}以高效低碳技术推动脱碳与节能，把握数字化与低碳转型机遇，可持续是我们每天工作的核心。</>}
      />

      {/* ── 2030 可持续目标 · PPT P16–P17 ── */}
      <section className="rh-section" style={{ background: '#fff', borderBottom: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ marginBottom: 40 }}>
            <p className="rh-eyebrow" style={{ color: 'var(--rh-green)', marginBottom: 10 }}>Sustainability Directions · 可持续方向</p>
            <h2 style={{ fontSize: 'clamp(24px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
              可持续发展四大方向
            </h2>
            <p style={{ fontSize: 15, color: 'var(--rh-t2)', maxWidth: 640, lineHeight: 1.85 }}>
              以低碳、智能、新能源与数字化为方向，持续推动更高效、更可持续的产品与服务。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 20 }}>
            {SUSTAINABILITY_GOALS.map((g, i) => (
              <div key={g.title} style={{
                padding: '32px 26px', background: 'var(--rh-s2)',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div style={{ fontFamily: 'var(--rh-mono)', fontSize: 13, fontWeight: 700, color: 'var(--rh-green)', letterSpacing: '0.06em', marginBottom: 14 }}>0{i + 1}</div>
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--rh-t1)', marginBottom: 10 }}>{g.title}</div>
                <div style={{ fontSize: 13.5, color: 'var(--rh-t2)', lineHeight: 1.75 }}>{g.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Philosophy on Sustainability — 对标 A.O. Smith ── */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 64, alignItems: 'center' }}>
            <div>
              <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Our Sustainability Priorities</p>
              <h2 style={{ fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.25 }}>
                Our Sustainability Priorities<br />Align with Our Values
              </h2>
              <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.9 }}>
                Sustainability is ingrained in who we are as an organization and what we do every day.
                We are committed to a culture of innovation while investing in environmentally sustainable
                and efficient technologies to heat and treat water.
              </p>
            </div>
            {/* CEO Quote block */}
            <div style={{
              background: 'var(--rh-s2)', borderRadius: 'var(--rh-r-lg)',
              padding: '36px 32px', borderLeft: '4px solid var(--rh-green)',
            }}>
              <p style={{ fontSize: 15, color: 'var(--rh-t1)', lineHeight: 1.85, fontStyle: 'italic', marginBottom: 20 }}>
                {`"At ${GROUP.nameShort}, sustainability is not just a goal, it's a core part of who we are and what we do every day. As a leader in water technology, we recognize the responsibility we carry to protect our planet while improving lives."`}
              </p>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--rh-t1)' }}>集团管理层</div>
              <div style={{ fontSize: 12, color: 'var(--rh-t3)' }}>{GROUP.nameCn}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ESG 三支柱 ── */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)' }}>
        <div className="rh-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>ESG Framework</p>
            <h2 style={{ fontSize: 'clamp(22px,3vw,34px)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Environmental · Social · Governance
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 24 }}>
            {PRIORITIES.map(p => (
              <div key={p.code} style={{
                padding: '40px 32px',
                border: '1px solid var(--rh-border)',
                borderRadius: 'var(--rh-r-lg)',
                background: '#fff',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div style={{ fontFamily: 'var(--rh-display)', fontSize: 30, color: 'var(--rh-green)', lineHeight: 1, marginBottom: 18 }}>
                  {p.code}
                </div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>{p.subtitle}</div>
                <div style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.8 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Sustainability Reports ── */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>

            <div style={{ padding: '36px 32px', border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
              <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Sustainability Reports</p>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2024 Sustainability Report</h3>
              <p style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.8, marginBottom: 24 }}>
                Our Sustainability Reports demonstrate our commitment to being a good corporate citizen
                and a water technology leader spearheading environmental stewardship efforts.
              </p>
              <a href="/about#annual-report" className="rh-btn rh-btn-brand" style={{ padding: '11px 24px', fontSize: 13 }}>
                View Sustainability Reports →
              </a>
            </div>

            <div style={{ padding: '36px 32px', border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green-dk)' }} />
              <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Progress Report</p>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>2025 Sustainability Progress Report & Scorecard</h3>
              <p style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.8, marginBottom: 24 }}>
                This report highlights our dedication, commitment and purposeful action toward
                meeting and exceeding the goals we&#39;ve set as a company.
              </p>
              <a href="/sustainability#scorecard" className="rh-btn rh-btn-outline" style={{ padding: '11px 24px', fontSize: 13 }}>
                View Progress Report →
              </a>
            </div>

            <div style={{ padding: '36px 32px', border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green-dk)' }} />
              <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Policies & Resources</p>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Corporate Governance Policies</h3>
              <p style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.8, marginBottom: 24 }}>
                Anti-Bribery Policy, Conflicts of Interest, Insider Trading, Financial Code of Ethics,
                Whistleblower Procedure, Human Rights Statement and more.
              </p>
              <a href="/about/governance" className="rh-btn rh-btn-outline" style={{ padding: '11px 24px', fontSize: 13 }}>
                View Policies →
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── Embracing Environmental Transparency CTA ── */}
      <section style={{ background: 'var(--rh-s2)', padding: '80px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rh-green)', marginBottom: 16 }}>
            Embracing Environmental Transparency
          </p>
          <h2 className="rh-display" style={{ fontSize: 'clamp(24px,4vw,44px)', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rh-t1)', marginBottom: 14 }}>
            共建低碳建筑未来
          </h2>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', maxWidth: 480, margin: '0 auto 36px', lineHeight: 1.8 }}>
            与我们一同以工程精度践行可持续发展，推动建筑能效提升与碳中和目标。
          </p>
          <a href="/contact" className="rh-btn rh-btn-brand" style={{ padding: '14px 36px', fontSize: 14, letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 700 }}>
            Contact Our Team
          </a>
        </div>
      </section>

    </main>
  );
}
