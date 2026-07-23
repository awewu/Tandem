import React from 'react';

/**
 * 统一内页 Hero —— 与首页同源的高级视觉语言：
 * 暖砂底 + 细点阵网格 + 同心能量环 + 绿色标线 + 展示体大标题。
 * 让所有内页与首页保持一致的高级度。
 */
export default function PageHero({
  eyebrow,
  title,
  lead,
  minHeight = 400,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  minHeight?: number;
  children?: React.ReactNode;
}) {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--rh-s2)', color: 'var(--rh-t1)', minHeight, display: 'flex', alignItems: 'center' }}>
      {/* 细点阵网格（右上淡出）*/}
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(rgba(47,94,36,0.08) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        WebkitMaskImage: 'radial-gradient(circle at 90% 26%, #000 0%, transparent 62%)',
        maskImage: 'radial-gradient(circle at 90% 26%, #000 0%, transparent 62%)',
      }} />
      {/* 同心能量环 */}
      <svg aria-hidden viewBox="0 0 400 400" style={{ position: 'absolute', right: -90, top: -90, width: 380, opacity: 0.55 }}>
        <circle cx="200" cy="200" r="80"  fill="none" stroke="rgba(242,103,41,0.22)" strokeWidth="1" />
        <circle cx="200" cy="200" r="132" fill="none" stroke="rgba(78,154,61,0.14)" strokeWidth="1" />
        <circle cx="200" cy="200" r="184" fill="none" stroke="rgba(78,154,61,0.09)" strokeWidth="1" />
      </svg>

      <div className="rh-container" style={{ position: 'relative', padding: '96px 32px' }}>
        <p className="rh-eyebrow" style={{ color: 'var(--rh-green)', marginBottom: 18 }}>{eyebrow}</p>
        <div aria-hidden style={{ width: 48, height: 4, background: 'linear-gradient(90deg, var(--rh-green), var(--rh-warm))', marginBottom: 24 }} />
        <h1 style={{ fontSize: 'clamp(30px,4.4vw,54px)', fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.18, marginBottom: lead ? 18 : 0 }}>
          {title}
        </h1>
        {lead && <p style={{ fontSize: 16, color: 'var(--rh-t2)', maxWidth: 620, lineHeight: 1.9 }}>{lead}</p>}
        {children && <div style={{ marginTop: 32 }}>{children}</div>}
      </div>
    </section>
  );
}
