import type { Metadata } from 'next';
import { GROUP, CONTACT, GOVERNANCE } from '../../../lib/brand';
import PageHero from '../../../components/PageHero';

export const metadata: Metadata = {
  title: 'Corporate Governance | Rhautt Comfort Group',
  description: `${GROUP.nameCn}公司治理 — 合规政策、董事会架构与诚信经营。`,
  alternates: { canonical: '/about/governance' },
};

const POLICIES = [
  { code: 'AB', title: 'Anti-Bribery Policy',           subtitle: '反贿赂政策',       desc: '集团零容忍任何形式的贿赂与腐败行为，所有员工须遵守国内外反腐法规。' },
  { code: 'CI', title: 'Conflicts of Interest',          subtitle: '利益冲突',         desc: '员工须主动披露可能影响其公正判断的个人关系或财务利益。' },
  { code: 'IT', title: 'Insider Trading Policy',         subtitle: '内幕交易政策',     desc: '禁止利用未公开信息进行任何形式的证券交易或商业决策。' },
  { code: 'FE', title: 'Financial Code of Ethics',       subtitle: '财务诚信准则',     desc: '确保财务信息的准确性与透明度，维护集团与合作伙伴的信任关系。' },
  { code: 'WB', title: 'Whistleblower Procedure',        subtitle: '诚信举报程序',     desc: '提供匿名举报渠道，保护举报人免受任何形式的打击报复。' },
  { code: 'HR', title: 'Human Rights Statement',         subtitle: '人权声明',         desc: '尊重并维护所有员工、供应商及社区成员的基本人权与尊严。' },
];

export default function GovernancePage() {
  return (
    <main id="main">

      {/* Hero */}
      <PageHero
        minHeight={360}
        eyebrow="GOVERNANCE · 内部治理与生态协同"
        title={<>赋能型治理<span style={{ color: 'var(--rh-green)' }}>生态协同</span></>}
        lead={<>{GROUP.nameCn}打造灵活而专业的总部治理平台，通过清晰授权、数字化流程与严格财务风控，为前线业务高速扩张保驾护航，让内外生态高效协作。</>}
      />

      {/* 总部治理平台 + 三层治理（P14）*/}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 'clamp(24px,5vw,64px)', alignItems: 'start' }}>
          <div>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Headquarters Platform</p>
            <h2 style={{ fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 24 }}>总部治理平台</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {GOVERNANCE.platform.map(p => (
                <li key={p} style={{ display: 'flex', gap: 10, fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.6 }}>
                  <span aria-hidden style={{ color: 'var(--rh-green)', fontWeight: 700, flexShrink: 0 }}>▸</span>{p}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Governance Tiers</p>
            <h2 style={{ fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 24 }}>三层治理架构</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {GOVERNANCE.tiers.map((t, i) => (
                <div key={t.tier} style={{
                  padding: '20px 24px', background: 'var(--rh-s2)',
                  border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                  borderLeft: '3px solid var(--rh-green)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rh-green)', letterSpacing: '0.08em', marginBottom: 4 }}>0{i + 1} · {t.tier}</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--rh-t1)', marginBottom: 4 }}>{t.body}</div>
                  <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.6 }}>{t.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 业务生态协同 */}
      <section className="rh-section" style={{ background: 'var(--rh-s2)', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <div style={{ marginBottom: 36 }}>
            <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Ecosystem Collaboration</p>
            <h2 style={{ fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>生态协同 · 长期共赢</h2>
            <p style={{ fontSize: 14, color: 'var(--rh-t2)', maxWidth: 680, lineHeight: 1.8 }}>
              以专业高效的组织与充分的授权，与经销商、安装商及核心客户建立长期稳定的合作关系，协同开拓市场、共创价值。
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
            {[GOVERNANCE.ecosystem.employee, GOVERNANCE.ecosystem.channel].map(e => (
              <div key={e.title} style={{
                padding: '32px 28px', background: '#fff',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--rh-green)' }} />
                <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--rh-t1)', marginBottom: 12 }}>{e.title}</div>
                <p style={{ fontSize: 14, color: 'var(--rh-t2)', lineHeight: 1.85 }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Policies grid */}
      <section className="rh-section" style={{ background: '#fff' }}>
        <div className="rh-container">
          <p className="rh-eyebrow" style={{ marginBottom: 10 }}>Policies & Procedures</p>
          <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 14 }}>
            治理政策与程序
          </h2>
          <p style={{ fontSize: 14, color: 'var(--rh-t3)', maxWidth: 560, marginBottom: 40, lineHeight: 1.8 }}>
            以下政策文件正在整理中，将于法务审核完成后正式发布。如需获取相关文件，请联系集团合规部门。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20 }}>
            {POLICIES.map(p => (
              <div key={p.code} style={{
                padding: '28px 24px',
                border: '1px solid var(--rh-border)', borderRadius: 'var(--rh-r-lg)',
                background: 'var(--rh-s2)', position: 'relative', overflow: 'hidden',
              }}>
                <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--rh-green)' }} />
                <div aria-hidden style={{ width: 28, height: 4, background: 'var(--rh-green)', marginBottom: 16 }} />
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: 'var(--rh-green)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>{p.subtitle}</div>
                <div style={{ fontSize: 13, color: 'var(--rh-t2)', lineHeight: 1.75 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrity Hotline CTA */}
      <section style={{ background: 'var(--rh-s2)', padding: '64px 32px', textAlign: 'center', borderTop: '1px solid var(--rh-border)' }}>
        <div className="rh-container">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--rh-green)', marginBottom: 16 }}>
            Integrity Hotline
          </p>
          <h2 className="rh-display" style={{ fontSize: 'clamp(22px,3vw,38px)', fontWeight: 400, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rh-t1)', marginBottom: 14 }}>
            诚信举报渠道
          </h2>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', maxWidth: 460, margin: '0 auto 32px', lineHeight: 1.8 }}>
            如发现违反集团行为准则的情况，请通过以下渠道匿名举报。集团承诺保护举报人的权益。
          </p>
          <a href={`mailto:${CONTACT.emails.business}`} className="rh-btn rh-btn-brand" style={{ padding: '13px 32px', fontSize: 14, fontWeight: 700 }}>
            Submit a Report
          </a>
        </div>
      </section>

    </main>
  );
}
