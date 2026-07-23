'use client';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 生产环境可在此上报监控（Sentry 等）
    console.error(error);
  }, [error]);

  return (
    <main id="main" style={{ background: 'var(--rh-s2)' }}>
      <section className="rh-section">
        <div className="rh-container" style={{ maxWidth: 640, textAlign: 'center', padding: '80px 32px' }}>
          <div className="rh-display" style={{ fontSize: 'clamp(48px,9vw,88px)', color: 'var(--rh-green)', lineHeight: 1, marginBottom: 16 }}>出错了</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>页面加载遇到问题</h1>
          <p style={{ fontSize: 15, color: 'var(--rh-t2)', lineHeight: 1.8, marginBottom: 32 }}>
            抱歉，页面在加载时发生了错误。您可以重试，或返回首页。
            {error?.digest && (
              <><br /><span style={{ fontSize: 12, color: 'var(--rh-t3)' }}>错误编号：{error.digest}</span></>
            )}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={reset} className="rh-btn rh-btn-brand" style={{ padding: '11px 28px', fontSize: 14, border: 'none', cursor: 'pointer' }}>重试</button>
            <a href="/" className="rh-btn rh-btn-outline" style={{ padding: '11px 26px', fontSize: 14 }}>返回首页</a>
          </div>
        </div>
      </section>
    </main>
  );
}
