import { GROUP, CONTACT, LINKS } from '../lib/brand';

/* ── A.O. Smith 导航复刻 ──
   顶栏: 热线 | 找经销商 | 专业通道 | Investors
   主导航: Logo | Products | About Us▾ | Our Brands | Sustainability | Investors | Careers | Contact | News
   About Us 下拉: Leadership / History / Our Values / Foundation / Governance
   纯 CSS :hover 展开，SSR 友好
── */

const NAV_ABOUT_DROPDOWN = [
  { cn: '集团概况', en: 'About Us',    href: '/about' },
  { cn: '管理团队', en: 'Leadership',  href: '/about/leadership' },
  { cn: '发展历程', en: 'Our History', href: '/about/our-story' },
  { cn: '核心价值观', en: 'Our Values', href: '/about/our-values' },
  { cn: '公司治理', en: 'Governance',  href: '/about/governance' },
];

const NAV_MAIN = [
  { cn: '旗下品牌',   en: 'Brands',   href: '/brands' },
  { cn: '可持续发展', en: 'ESG',      href: '/sustainability' },
  { cn: '新闻',       en: 'News',     href: '/news' },
  { cn: '招聘',       en: 'Careers',  href: '/careers' },
];

/* 导航项样式：国际大牌式——单语言、单行、克制字重、宽间距 */
const navLinkStyle = {
  padding: '0 19px', textDecoration: 'none', color: 'var(--rh-t1)',
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 14, fontWeight: 500, letterSpacing: '0.01em',
  borderBottom: '2px solid transparent',
} as const;

export default function SiteHeader() {
  return (
    <>
      <a href="#main" className="rh-skip">跳到主内容</a>

      {/* ── 顶部工具条 ── */}
      <div style={{
        background: 'var(--rh-dark)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0',
      }}>
        <div className="rh-container" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 32px', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.04em' }}>
            {GROUP.nameEn} · 瑞美集团（Rheem）中国独家授权运营商
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href={`tel:${CONTACT.hotlineTel}`} style={{
              fontSize: 11, color: 'rgba(255,255,255,0.45)', textDecoration: 'none',
            }}>{CONTACT.hotline}</a>
            <a href="/dealers" style={{
              fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>查找经销商</a>
            <a href={LINKS.dealer} style={{
              fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>经销商工作台</a>
            <a href={LINKS.design} style={{
              fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>设计师工作台</a>
            <a href={LINKS.investor} target="_blank" rel="noreferrer" style={{
              fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>投资者关系</a>
          </div>
        </div>
      </div>

      {/* ── 主导航 (sticky white bar) ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff',
        boxShadow: '0 1px 0 var(--rh-border)',
      }}>
        <div className="rh-container" style={{
          height: 68, display: 'flex', alignItems: 'center',
          padding: '0 32px', gap: 0,
        }}>

          {/* 品牌标识 — Rhautt. 字标 */}
          <a href="/" style={{
            display: 'flex', alignItems: 'center', gap: 0,
            flexShrink: 0, textDecoration: 'none', marginRight: 40,
          }}>
            <span style={{
              fontFamily: 'var(--rh-display)', fontSize: 26,
              fontWeight: 700, letterSpacing: '-0.01em',
              color: 'var(--rh-t1)', lineHeight: 1,
            }}>Rhaut</span>
            <span style={{
              fontFamily: 'var(--rh-display)', fontSize: 26,
              fontWeight: 700, letterSpacing: '-0.01em',
              color: 'var(--rh-green)', lineHeight: 1,
            }}>t.</span>
          </a>

          {/* 主导航 */}
          <nav aria-label="主导航" className="rh-nav-desktop" style={{ display: 'flex', gap: 0, flex: 1, height: '100%', alignItems: 'stretch' }}>

            {/* About Us — 含下拉 */}
            <div className="rh-nav-dropdown" style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
              <a href="/about" className="rh-nav-link" style={navLinkStyle}>
                关于我们 <span style={{ fontSize: 9, opacity: 0.45 }}>▾</span>
              </a>
              <div className="rh-nav-dropdown__panel" style={{
                position: 'absolute', top: '100%', left: 0,
                background: '#fff', minWidth: 210,
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                border: '1px solid var(--rh-border)',
                borderTop: '3px solid var(--rh-green)',
                zIndex: 200,
                display: 'none',
                flexDirection: 'column',
              }}>
                {NAV_ABOUT_DROPDOWN.map(item => (
                  <a key={item.href} href={item.href} style={{
                    display: 'block', padding: '12px 20px',
                    fontSize: 13.5, color: 'var(--rh-t1)', textDecoration: 'none',
                    borderBottom: '1px solid var(--rh-border)',
                    fontWeight: item.href === '/about' ? 700 : 500,
                  }}>{item.cn}</a>
                ))}
              </div>
            </div>

            {NAV_MAIN.map(item => (
              <a key={item.href} href={item.href} className="rh-nav-link" style={navLinkStyle}>{item.cn}</a>
            ))}

          </nav>

          {/* 右侧 CTA */}
          <a href="/contact" className="rh-btn rh-btn-brand rh-hide-mobile" style={{
            padding: '9px 24px', fontSize: 13, flexShrink: 0, letterSpacing: '0.02em',
          }}>
            联系我们
          </a>

          {/* 移动端汉堡菜单（纯 CSS checkbox）*/}
          <input type="checkbox" id="rh-mobile-nav" className="rh-mobile-toggle" aria-hidden />
          <label htmlFor="rh-mobile-nav" className="rh-mobile-menu-btn" aria-label="打开菜单">
            <span /><span /><span />
          </label>
          <nav aria-label="移动端导航" className="rh-mobile-panel">
            <a href="/about">关于我们</a>
            <a href="/brands">旗下品牌</a>
            <a href="/sustainability">可持续发展</a>
            <a href="/news">新闻</a>
            <a href="/careers">招聘</a>
            <a href="/dealers">查找经销商</a>
            <a href="/contact" style={{ color: 'var(--rh-green)', fontWeight: 700 }}>联系我们</a>
          </nav>
        </div>

        {/* 极细品牌轴线（克制，去 Ruud 3px 粗线的杂感）*/}
        <div aria-hidden style={{ height: 2, background: 'linear-gradient(90deg, var(--rh-green) 0%, var(--rh-green) 55%, var(--rh-warm) 100%)', opacity: 0.9 }} />
      </header>
    </>
  );
}
