import { BRAND, CONTACT, LEGAL, LINKS, currentYear } from '../lib/brand';

/* ── 复刻 public-portal SiteFooter 结构 + Rhautt VI/SI ── */

const FOOTER_SOLUTIONS = [
  ['系统方案',   '/solutions'],
  ['产品系列',   '/products'],
  ['AI 问诊',    '/#diagnosis'],
] as const;

const FOOTER_ABOUT = [
  ['关于我们',   '/about'],
  ['联系我们',   '/contact'],
  ['隐私政策',   '/privacy.html'],
] as const;

function FooterCol({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
        letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16,
        paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>{title}</div>
      {links.map(([label, href]) => (
        <a key={label} href={href} className="rh-footer-link" style={{
          display: 'block', fontSize: 13, color: 'rgba(255,255,255,0.42)',
          textDecoration: 'none', marginBottom: 9, lineHeight: 1.4,
          transition: 'color 150ms',
        }}>{label}</a>
      ))}
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer style={{ background: 'var(--rh-dark)', borderTop: '4px solid var(--rh-red)' }}>

      {/* ── 主页脚 ── */}
      <div className="rh-container" style={{ padding: '64px 32px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 1fr', gap: 48, marginBottom: 52 }}>

          {/* Brand block */}
          <div>
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--rh-display)', fontSize: 22,
                fontWeight: 700, letterSpacing: '-0.01em',
                color: 'var(--rh-red)', lineHeight: 1,
              }}>瑞诺瓦</span>
              <span style={{
                fontFamily: 'var(--rh-display)', fontSize: 14,
                fontWeight: 400, letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.5)', lineHeight: 1, marginLeft: 8,
                textTransform: 'uppercase',
              }}>Rysnova</span>
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.8, maxWidth: 210, marginBottom: 20 }}>
              {BRAND.taglineCn}<br />
              AI 舒适家问诊 · 中立选型工具
            </p>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 2.0 }}>
              <div>{CONTACT.address}</div>
              <div>
                <a href={`tel:${CONTACT.hotlineTel}`} style={{ color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
                  {CONTACT.hotline}
                </a>
              </div>
              <div>
                <a href={`mailto:${CONTACT.emails.service}`} style={{ color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}>
                  {CONTACT.emails.service}
                </a>
              </div>
            </div>
          </div>

          <FooterCol title="Solutions" links={FOOTER_SOLUTIONS} />
          <FooterCol title="About" links={FOOTER_ABOUT} />

        </div>

        {/* ── Legal bar ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.26)', lineHeight: 1.6 }}>
            © {currentYear()} {LEGAL.copyrightHolder}. All rights reserved.
            {LEGAL.icp && <span style={{ marginLeft: 16 }}>{LEGAL.icp}</span>}
            {!LEGAL.icp && <span style={{ marginLeft: 16, opacity: 0.6 }}>ICP 备案号申请中</span>}
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* P2-3 · §0.1：技术来源署名（赋能线认可署名，指向真实技术子公司，兼实力佐证） */}
            <span
              title="瑞诺瓦 · 瑞合瑞德集团技术子公司 · verified 精算引擎驱动"
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)', letterSpacing: '0.04em' }}
            >
              {LEGAL.poweredBy}
            </span>
            <a href="/privacy.html" style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', textDecoration: 'none' }}>Privacy Policy</a>
          </div>
        </div>
      </div>

    </footer>
  );
}
