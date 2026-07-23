import { BRAND, CONTACT } from '../lib/brand';

/* ── 复刻 public-portal SiteHeader 结构 + Rhautt VI/SI ── */

export default function SiteHeader() {
  return (
    <>
      <a href="#main" className="rh-skip">跳到主内容</a>

      {/* ── 顶部工具条 ── */}
      <div style={{
        background: 'var(--rh-dark)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div className="rh-container" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '6px 32px', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.04em' }}>
            {BRAND.nameEn} · {BRAND.taglineCn}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href={`tel:${CONTACT.hotlineTel}`} style={{
              fontSize: 11, color: 'rgba(255,255,255,0.45)', textDecoration: 'none',
            }}>{CONTACT.hotline}</a>
            <a href="/contact" style={{
              fontSize: 11, color: 'rgba(255,255,255,0.55)', textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>联系我们</a>
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

          {/* 品牌标识 */}
          <a href="/" style={{
            display: 'flex', alignItems: 'center', gap: 0,
            flexShrink: 0, textDecoration: 'none', marginRight: 40,
          }}>
            <span style={{
              fontFamily: 'var(--rh-display)', fontSize: 26,
              fontWeight: 700, letterSpacing: '-0.01em',
              color: 'var(--rh-red)', lineHeight: 1,
            }}>瑞诺瓦</span>
            <span style={{
              fontFamily: 'var(--rh-display)', fontSize: 14,
              fontWeight: 400, letterSpacing: '0.06em',
              color: 'var(--rh-t3)', lineHeight: 1, marginLeft: 8,
              textTransform: 'uppercase',
            }}>Rysnova</span>
          </a>

          {/* 主导航 */}
          <nav aria-label="主导航" style={{ display: 'flex', gap: 0, flex: 1, height: '100%', alignItems: 'stretch' }}>
            <a href="/solutions" className="rh-nav-link" style={{
              padding: '0 14px', fontSize: 13, fontWeight: 600,
              color: 'var(--rh-t1)', textDecoration: 'none',
              display: 'flex', alignItems: 'center',
              borderBottom: '3px solid transparent',
            }}>系统方案</a>
            <a href="/products" className="rh-nav-link" style={{
              padding: '0 14px', fontSize: 13, fontWeight: 600,
              color: 'var(--rh-t1)', textDecoration: 'none',
              display: 'flex', alignItems: 'center',
              borderBottom: '3px solid transparent',
            }}>产品系列</a>
            <a href="/about" className="rh-nav-link" style={{
              padding: '0 14px', fontSize: 13, fontWeight: 600,
              color: 'var(--rh-t1)', textDecoration: 'none',
              display: 'flex', alignItems: 'center',
              borderBottom: '3px solid transparent',
            }}>关于我们</a>
            <a href="/contact" className="rh-nav-link" style={{
              padding: '0 14px', fontSize: 13, fontWeight: 600,
              color: 'var(--rh-t1)', textDecoration: 'none',
              display: 'flex', alignItems: 'center',
              borderBottom: '3px solid transparent',
            }}>联系我们</a>
          </nav>

          {/* 右侧 CTA */}
          <a href="/#diagnosis" className="rh-btn rh-btn-brand" style={{
            padding: '9px 22px', fontSize: 13, flexShrink: 0,
            letterSpacing: '0.04em',
          }}>
            免费 AI 问诊
          </a>
        </div>

        {/* Ruud VI 底线红 3px */}
        <div aria-hidden style={{ height: 3, background: 'var(--rh-red)' }} />
      </header>
    </>
  );
}
