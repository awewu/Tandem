import { GROUP, CONTACT, LEGAL, LINKS, currentYear } from '../lib/brand';

/* ── A.O. Smith Footer 三列结构复刻 ──
   Brand / About / Resources / Contact
   ── */

const FOOTER_ABOUT = [
  ['About Us',            '/about'],
  ['Our Leadership',      '/about/leadership'],
  ['Our History',         '/about/our-story'],
  ['Our Values',          '/about/our-values'],
  ['Corporate Governance','/about/governance'],
  ['Sustainability',      '/sustainability'],
  ['Careers',             '/careers'],
] as const;

const FOOTER_RESOURCES = [
  ['Our Brands',          '/brands'],
  ['Products',            LINKS.rheem],
  ['Professional Portal', '/professional'],
  ['News',                '/news'],
  ['Investors',           '/contact'],
] as const;

const FOOTER_CONTACT = [
  ['Contact Us',          '/contact'],
  ['Find a Dealer',       '/contact#dealer'],
  ['Privacy Policy',      '/privacy'],
  ['Terms of Use',        '/terms'],
  ['Recall Information',  '/recall'],
  ['Integrity Hotline',   '/about#integrity'],
] as const;

function FooterCol({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--rh-t2)',
        letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16,
        paddingBottom: 10, borderBottom: '1px solid var(--rh-border)',
      }}>{title}</div>
      {links.map(([label, href]) => {
        const ext = href.startsWith('http');
        return (
          <a key={label} href={href}
            target={ext ? '_blank' : undefined} rel={ext ? 'noreferrer' : undefined}
            className="rh-footer-link" style={{
              display: 'block', fontSize: 13, color: 'var(--rh-t2)',
              textDecoration: 'none', marginBottom: 9, lineHeight: 1.4,
              transition: 'color 150ms',
            }}>{label}</a>
        );
      })}
    </div>
  );
}

export default function SiteFooter() {
  return (
    <footer style={{ background: 'var(--rh-s2)', borderTop: '3px solid var(--rh-green)' }}>

      {/* ── 主页脚 ── */}
      <div className="rh-container" style={{ padding: '64px 32px 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 1fr 1fr', gap: 48, marginBottom: 52 }}>

          {/* Brand block */}
          <div>
            <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center' }}>
              <span style={{
                fontFamily: 'var(--rh-display)', fontSize: 22,
                fontWeight: 700, letterSpacing: '-0.01em',
                color: 'var(--rh-t1)', lineHeight: 1,
              }}>Rhaut</span>
              <span style={{
                fontFamily: 'var(--rh-display)', fontSize: 22,
                fontWeight: 700, letterSpacing: '-0.01em',
                color: 'var(--rh-green)', lineHeight: 1,
              }}>t.</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--rh-t2)', lineHeight: 1.8, maxWidth: 210, marginBottom: 12 }}>
              {GROUP.nameCn}<br />
              Rheem · Ruud · EverHot<br />
              中国独家授权运营
            </p>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--rh-green)', marginBottom: 16,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span aria-hidden style={{ width: 8, height: 8, background: 'var(--rh-green)', borderRadius: 2, display: 'inline-block' }} />
              Earth Day, Every Day.
            </div>
            <div style={{ fontSize: 12, color: 'var(--rh-t3)', lineHeight: 2.0 }}>
              <div>{CONTACT.address}</div>
              <div>
                <a href={`tel:${CONTACT.hotlineTel}`} style={{ color: 'var(--rh-t2)', textDecoration: 'none' }}>
                  {CONTACT.hotline}
                </a>
              </div>
              <div>
                <a href={`mailto:${CONTACT.emails.service}`} style={{ color: 'var(--rh-t2)', textDecoration: 'none' }}>
                  {CONTACT.emails.service}
                </a>
              </div>
            </div>
          </div>

          <FooterCol title="About" links={FOOTER_ABOUT} />
          <FooterCol title="Resources" links={FOOTER_RESOURCES} />
          <FooterCol title="Contact" links={FOOTER_CONTACT} />

        </div>

        {/* ── Legal bar ── */}
        <div style={{
          borderTop: '1px solid var(--rh-border)', paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
        }}>
          <div style={{ fontSize: 11, color: 'var(--rh-t3)', lineHeight: 1.6 }}>
            © {currentYear()} {LEGAL.copyrightHolder}. All rights reserved.
            {LEGAL.icp && <span style={{ marginLeft: 16 }}>{LEGAL.icp}</span>}
            {!LEGAL.icp && <span style={{ marginLeft: 16, opacity: 0.6 }}>ICP 备案号申请中</span>}
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--rh-t3)' }}>
              Rheem · Ruud · EverHot 为各自所有人注册商标
            </span>
            <a href="/privacy" style={{ fontSize: 11, color: 'var(--rh-t2)', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms"   style={{ fontSize: 11, color: 'var(--rh-t2)', textDecoration: 'none' }}>Terms of Use</a>
          </div>
        </div>
      </div>

    </footer>
  );
}
