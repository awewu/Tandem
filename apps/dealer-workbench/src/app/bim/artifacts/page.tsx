'use client';

import { useEffect, useState } from 'react';
import { deepening } from '../../../lib/api';

type Artifact = Record<string, any>;

const TYPE_LABEL: Record<string, string> = {
  'principle-diagram': '原理图', 'construction-drawing': '施工图', 'bim-model': 'BIM 3D',
  'floor-plan': '二维平面', 'bom': 'BOM', 'quantity-takeoff': '工程量', 'standards-check': '规范校验',
  'customer-report': '客户报告', 'render': '效果图',
};
const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', generated: '已生成', review: '待审', approved: '已批准', verified: '已确认', published: '已发布',
};

export default function ArtifactsPage() {
  const [items, setItems] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [pid, setPid] = useState('');

  function load(projectId = '') {
    setLoading(true); setErr('');
    deepening.artifacts(projectId ? `?projectId=${encodeURIComponent(projectId)}&limit=100` : '?limit=100')
      .then((r) => setItems(Array.isArray(r) ? r : (r?.items || [])))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>产物库</h1>
      <p style={{ fontSize: 13, color: 'var(--t-secondary)', marginBottom: 16 }}>
        深化产出的效果图 / 施工图 / BIM 模型 / BOM 等产物，均可回挂合同并按信任状态流转。
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="按 projectId 过滤（可留空）" style={{ flex: 1, maxWidth: 420, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }} />
        <button onClick={() => load(pid.trim())} style={{ background: 'var(--brand)', color: '#fff', border: 0, borderRadius: 6, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>筛选</button>
      </div>

      {loading && <div style={{ color: 'var(--t-tertiary)', padding: 20 }}>加载中…</div>}
      {err && <div style={{ color: 'var(--danger)', padding: 12, background: '#fdecea', borderRadius: 6 }}>加载失败：{err}</div>}
      {!loading && !err && items.length === 0 && <div style={{ color: 'var(--t-tertiary)', padding: 40, textAlign: 'center', background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 8 }}>暂无产物。到深化台生成效果图 / 施工图后在此汇总。</div>}

      {items.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface-1)', textAlign: 'left' }}>
              {['类型', '名称', '状态', '版本', 'projectId', '生成时间'].map((h) => <th key={h} style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--t-secondary)' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {items.map((a, i) => (
              <tr key={a.id || a.artifactId || i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}><span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(200,32,44,0.1)', color: 'var(--brand)', fontSize: 12 }}>{TYPE_LABEL[a.type] || a.type || '—'}</span></td>
                <td style={td}>{a.name || a.title || a.originalName || '—'}</td>
                <td style={td}>{STATUS_LABEL[a.status] || a.status || '—'}</td>
                <td style={td}>{a.version || 'v1'}</td>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{String(a.projectId || '').slice(0, 8) || '—'}</td>
                <td style={td}>{a.createdAt ? new Date(a.createdAt).toLocaleString('zh-CN') : (a.generatedAt ? new Date(a.generatedAt).toLocaleString('zh-CN') : '—')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--t-primary)' };
