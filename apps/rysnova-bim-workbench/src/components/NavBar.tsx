'use client';

import { setToken } from '@rhautt/shared-auth';

const LINKS = [
  { href: '/', label: '深化台' },
  { href: '/queue', label: '待深化队列' },
  { href: '/artifacts', label: '产物库' },
];

export default function NavBar() {
  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      setToken('');
      location.reload();
    }
  }
  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 20px', background: '#0f1420', color: '#fff', borderBottom: '1px solid #1f2a3a' }}>
      <span style={{ fontWeight: 700, fontSize: 15 }}>瑞诺瓦 · 技术支持深化端</span>
      <div style={{ display: 'flex', gap: 16, flex: 1 }}>
        {LINKS.map((l) => (
          <a key={l.href} href={l.href} style={{ color: '#c7d2e0', textDecoration: 'none', fontSize: 14 }}>{l.label}</a>
        ))}
      </div>
      <button onClick={logout} style={{ background: 'transparent', color: '#c7d2e0', border: '1px solid #2a3a4f', borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer' }}>退出</button>
    </nav>
  );
}
