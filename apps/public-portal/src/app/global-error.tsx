'use client';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f5f5f5' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '96px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: '#4E9A3D', lineHeight: 1, marginBottom: 16 }}>500</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>系统发生错误</h1>
          <p style={{ fontSize: 15, color: '#555', lineHeight: 1.8, marginBottom: 28 }}>
            抱歉，网站遇到了一个严重错误。请稍后重试。
            {error?.digest && <><br /><span style={{ fontSize: 12, color: '#999' }}>错误编号：{error.digest}</span></>}
          </p>
          <button
            onClick={reset}
            style={{ padding: '11px 28px', fontSize: 14, background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
