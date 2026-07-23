'use client';

import { getToken, clearToken } from '@rhautt/shared-auth';

const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL || 'http://localhost:5000';

const TOOLS = [
  { label: '首页', href: '/' },
  { label: '精算', href: '/calc' },
  { label: 'M12同步', href: '/sync' },
  { label: '平面设计', href: '/floor-plan' },
  { label: '布局·CFD', href: '/layout-cfd' },
  { label: 'BIM查看', href: '/viewer' },
  { label: 'AI方案', href: '/ai-design' },
  { label: 'BOM', href: '/bom' },
  { label: '系统模型', href: '/system-model' },
];

export default function NavBar() {
  const token = typeof window !== 'undefined' ? (getToken() || localStorage.getItem('token')) : null;

  function handleLogout() {
    clearToken();
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    window.location.href = LOGIN_URL;
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: '#fff', borderBottom: '1px solid #e5e7eb',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', height: 54, width: '100%', maxWidth: '100vw', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, overflowX: 'auto' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginRight: 16 }}>
          瑞诺瓦 · 设计师工作台
        </span>
        {TOOLS.map(t => (
          <a
            key={t.href}
            href={t.href}
            style={{
              padding: '0 12px', fontSize: 13, color: 'var(--color-text)', textDecoration: 'none',
              borderRadius: 6, lineHeight: '28px', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {t.label}
          </a>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {token ? (
          <button
            onClick={handleLogout}
            style={{
              fontSize: 12, color: 'var(--color-subtle)', background: 'transparent', border: '1px solid #e5e7eb',
              borderRadius: 6, padding: '4px 12px', cursor: 'pointer',
            }}
          >
            退出
          </button>
        ) : (
          <a href={LOGIN_URL} style={{ fontSize: 12, color: 'var(--color-accent)', textDecoration: 'none' }}>
            登录
          </a>
        )}
      </div>
    </nav>
  );
}
