import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '页面未找到',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main id="main" style={{ background: 'var(--rh-s2)' }}>
      <section className="rh-section">
        <div className="rh-container" style={{ maxWidth: 640, textAlign: 'center', padding: '80px 32px' }}>
          <div className="rh-display" style={{ fontSize: 'clamp(64px,12vw,120px)', color: 'var(--rh-green)', lineHeight: 1, marginBottom: 12 }}>404</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>页面未找到</h1>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.8, marginBottom: 32 }}>
            抱歉，您访问的页面不存在或已被移动。请返回首页或浏览下方常用入口。
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/" className="rh-btn rh-btn-brand" style={{ padding: '11px 28px', fontSize: 14 }}>返回首页</a>
            <a href="/products" className="rh-btn rh-btn-outline" style={{ padding: '11px 26px', fontSize: 14 }}>产品系列</a>
            <a href="/contact" className="rh-btn rh-btn-outline" style={{ padding: '11px 26px', fontSize: 14 }}>联系我们</a>
          </div>
        </div>
      </section>
    </main>
  );
}
