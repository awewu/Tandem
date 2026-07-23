'use client';

import { useEffect, useState } from 'react';
import { bim } from '../../lib/api';

type Project = Record<string, any>;

const STATUS_LABEL: Record<string, string> = {
  inherited: '已承接', design: '深化中', drawing: '出图', bom: '出料',
  review: '待审', verified: '已确认', delivered: '已交付', accepted: '已验收',
};

export default function QueuePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([bim.projects(), bim.stats().catch(() => null)])
      .then(([list, st]) => {
        const items = Array.isArray(list) ? list : (list?.items || list?.projects || []);
        setProjects(items);
        setStats(st);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>待深化队列</h1>
      <p style={{ fontSize: 13, color: '#596067', marginBottom: 16 }}>签单承接的项目在此排队,进入深化台补齐 BIM 3D / 施工图 / 效果图,并提升为 verified。</p>

      {stats && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          {Object.entries(stats).filter(([, v]) => typeof v === 'number').map(([k, v]) => (
            <div key={k} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 16px', minWidth: 96 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0f766e' }}>{String(v)}</div>
              <div style={{ fontSize: 12, color: '#94979C' }}>{k}</div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ color: '#94979C', padding: 20 }}>加载中…</div>}
      {err && <div style={{ color: '#c0392b', padding: 12, background: '#fdecea', borderRadius: 6 }}>加载失败：{err}</div>}

      {!loading && !err && projects.length === 0 && (
        <div style={{ color: '#94979C', padding: 40, textAlign: 'center', background: '#fff', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
          暂无项目。项目在报价签单时由 <code>POST /rysnova-bim/projects</code> 从报价单承接进入队列。
        </div>
      )}

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
        {projects.map((p) => {
          const id = p.id || p.projectId;
          const status = p.status || p.stage || '';
          return (
            <a key={id} href={`/deepen/${id}`} style={{ display: 'block', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, textDecoration: 'none', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{p.name || p.projectName || p.customerName || `项目 ${String(id).slice(0, 8)}`}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: '#e6f4f1', color: '#0f766e', fontWeight: 600 }}>{STATUS_LABEL[status] || status || '—'}</span>
              </div>
              <div style={{ fontSize: 12, color: '#94979C', lineHeight: 1.6 }}>
                {p.city && <span>城市：{p.city} · </span>}
                {(p.area || p.buildingArea) && <span>面积：{p.area || p.buildingArea}㎡ · </span>}
                {p.opportunityId && <span>商机：{String(p.opportunityId).slice(0, 8)}</span>}
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: '#0f766e', fontWeight: 600 }}>进入深化台 →</div>
            </a>
          );
        })}
      </div>
    </main>
  );
}
