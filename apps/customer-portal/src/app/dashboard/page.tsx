'use client';
import { useState, useEffect } from 'react';
import { getToken } from '@rhautt/shared-auth';

type Project = { id: string; name: string; status: string; summary?: string; updatedAt?: string };

const STATUS_LABEL: Record<string, string> = {
  pending_contract: '待签约',
  construction: '施工中',
  completed: '已完工',
  iot_handed: 'IoT 已交接',
};

const S = {
  page: { maxWidth: 720, margin: '0 auto', padding: '24px 16px' } as const,
  header: { fontWeight: 700, fontSize: 20, marginBottom: 24, color: 'var(--cp-color-heading)' },
  card: { background: 'var(--cp-color-card-bg)', borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as const,
  badge: (s: string) => ({
    display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
    background: s === 'completed' || s === 'iot_handed' ? 'var(--cp-badge-green-bg)' : s === 'construction' ? 'var(--cp-badge-orange-bg)' : 'var(--cp-badge-blue-bg)',
    color: s === 'completed' || s === 'iot_handed' ? 'var(--cp-badge-green-fg)' : s === 'construction' ? 'var(--cp-badge-orange-fg)' : 'var(--cp-badge-blue-fg)',
  }) as const,
  empty: { textAlign: 'center' as const, color: 'var(--cp-color-muted)', padding: '48px 0', fontSize: 15 },
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = getToken() || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
    if (!token) {
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `/login?returnUrl=${returnUrl}`;
      return;
    }
    fetch('/api/v2/lifecycle/customer-projects', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => {
        if (r.status === 401) {
          window.location.href = `/login?returnUrl=${encodeURIComponent(window.location.href)}`;
          throw new Error('登录已过期');
        }
        if (!r.ok) throw new Error('获取失败');
        return r.json();
      })
      .then(d => setProjects(Array.isArray(d.data) ? d.data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={S.page}>
      <div style={S.header}>我的项目</div>
      {loading && <div style={S.empty}>加载中...</div>}
      {error && <div style={{ ...S.empty, color: 'var(--cp-color-error)' }}>{error}</div>}
      {!loading && !error && projects.length === 0 && <div style={S.empty}>暂无项目</div>}
      {projects.map(p => (
        <div key={p.id} className="cp-card" style={S.card}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{p.name}</div>
            {p.summary && <div style={{ fontSize: 13, color: 'var(--cp-color-muted)' }}>{p.summary}</div>}
            {p.updatedAt && <div style={{ fontSize: 12, color: 'var(--cp-color-subtle)', marginTop: 4 }}>更新：{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</div>}
          </div>
          <span className="cp-badge" style={S.badge(p.status)}>{STATUS_LABEL[p.status] || p.status}</span>
        </div>
      ))}
    </div>
  );
}
