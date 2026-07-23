'use client';
import { useState } from 'react';

const BIM_STATUS: Record<string, { label: string; color: string }> = {
  inherited:     { label: '已承接',    color: '#6366f1' },
  drawing:       { label: '出图设计中', color: '#f59e0b' },
  bom_confirmed: { label: '备料中',    color: '#3b82f6' },
  construction:  { label: '施工安装中', color: '#f97316' },
  acceptance:    { label: '验收中',    color: '#8b5cf6' },
  iot_delivered: { label: '已完成交付', color: '#10b981' },
  // 兼容旧字段
  pending_contract: { label: '待签约',  color: '#9ca3af' },
  construction_old: { label: '施工中',  color: '#f97316' },
  completed:        { label: '已完工',  color: '#10b981' },
  iot_handed:       { label: 'IoT已交接', color: '#10b981' },
};

const STATUS_LABEL = Object.fromEntries(Object.entries(BIM_STATUS).map(([k, v]) => [k, v.label]));

const css = `
:root {
  --cp-brand: #E4002B;
  --cp-brand-light: #fff0f2;
  --cp-text: #1a1a2e;
  --cp-text-muted: #697386;
  --cp-text-body: #444;
  --cp-bg: #f7f5f2;
  --cp-card-bg: #fff;
  --cp-border: #e3e8ee;
  --cp-shadow: 0 2px 12px rgba(0,0,0,0.07);
  --cp-radius: 12px;
  --cp-radius-sm: 8px;
  --cp-badge-success-bg: #e6f4ea; --cp-badge-success-fg: #2e7d32;
  --cp-badge-warn-bg: #fff3e0;    --cp-badge-warn-fg: #e65100;
  --cp-badge-default-bg: #f0f4ff; --cp-badge-default-fg: #3949ab;
}
.cp-page { max-width:480px; margin:0 auto; padding:40px 16px; background:var(--cp-bg); min-height:100vh; }
.cp-header { text-align:center; margin-bottom:32px; }
.cp-logo { font-size:22px; font-weight:800; color:var(--cp-brand); }
.cp-sub { font-size:13px; color:var(--cp-text-muted); margin-top:6px; }
.cp-card { background:var(--cp-card-bg); border-radius:var(--cp-radius); padding:22px; margin-bottom:16px; box-shadow:var(--cp-shadow); }
.cp-label { display:block; font-size:14px; font-weight:600; color:var(--cp-text); margin-bottom:10px; }
.cp-input { width:100%; border:1.5px solid var(--cp-border); border-radius:var(--cp-radius-sm); padding:11px 13px; font-size:14px; outline:none; margin-bottom:12px; background:#fafafa; color:var(--cp-text); box-sizing:border-box; transition:border-color .2s; }
.cp-input:focus { border-color:var(--cp-brand); }
.cp-btn-primary { width:100%; background:var(--cp-brand); color:#fff; border:none; border-radius:var(--cp-radius-sm); padding:13px; font-size:15px; font-weight:700; cursor:pointer; transition:opacity .2s; }
.cp-btn-primary:disabled { opacity:.55; cursor:not-allowed; }
.cp-btn-outline { background:var(--cp-card-bg); color:var(--cp-brand); border:2px solid var(--cp-brand); border-radius:var(--cp-radius-sm); padding:10px 20px; font-size:14px; font-weight:600; cursor:pointer; margin-top:12px; }
.cp-error { color:var(--cp-brand); font-size:13px; margin-top:10px; text-align:center; }
.cp-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; }
.cp-badge--success { background:var(--cp-badge-success-bg); color:var(--cp-badge-success-fg); }
.cp-badge--warn    { background:var(--cp-badge-warn-bg);    color:var(--cp-badge-warn-fg); }
.cp-badge--default { background:var(--cp-badge-default-bg); color:var(--cp-badge-default-fg); }
`;

function badgeClass(s: string) {
  if (s === 'completed' || s === 'iot_handed' || s === 'iot_delivered') return 'cp-badge cp-badge--success';
  if (s === 'construction' || s === 'construction_old') return 'cp-badge cp-badge--warn';
  return 'cp-badge cp-badge--default';
}

type Project = { id: string; name: string; status: string; summary: string; salesContact?: string };

export default function CustomerPortalPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState('');

  async function handleQuery() {
    if (!code.trim()) return;
    setLoading(true); setError(''); setProject(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${API}/api/v2/bim/public/${encodeURIComponent(code.trim())}`);
      if (!res.ok) throw new Error('未找到相关项目');
      const data = await res.json();
      const p = data.data ?? data;
      if (!p || !p.status) throw new Error('未找到相关项目，请确认报价单号');
      setProject({
        id: code,
        name: `${p.city || ''}舒适家方案`,
        status: p.status,
        summary: [
          p.systemFamilies?.join('、'),
          p.project?.area && `${p.project.area}㎡`,
          p.progress !== undefined && `验收进度 ${p.progress}%`,
        ].filter(Boolean).join(' · '),
        salesContact: undefined,
      });
    } catch (e: any) { setError(e.message || '查询失败，请稍后重试'); }
    setLoading(false);
  }

  return (
    <>
      <style>{css}</style>
      <div className="cp-page">
        <div className="cp-header">
          <div className="cp-logo">瑞诺瓦舒适家</div>
          <div className="cp-sub">客户服务门户 · 查看您的专属方案</div>
        </div>

        <div className="cp-card">
          <span className="cp-label">输入分享码或手机号</span>
          <input
            className="cp-input"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="分享码 / 手机号"
            onKeyDown={e => e.key === 'Enter' && handleQuery()}
          />
          <button className="cp-btn-primary" onClick={handleQuery} disabled={loading || !code.trim()}>
            {loading ? '查询中...' : '查看我的方案'}
          </button>
          {error && <div className="cp-error">{error}</div>}
        </div>

        {project && (
          <div className="cp-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--cp-text)' }}>{project.name || '我的方案'}</div>
              <span className={badgeClass(project.status)}>
                {STATUS_LABEL[project.status] || project.status}
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--cp-text-body)', lineHeight: 1.7, marginBottom: 4 }}>
              {project.summary || '方案详情请联系您的专属顾问。'}
            </div>
            {project.salesContact && (
              <div style={{ fontSize: 13, color: 'var(--cp-text-muted)', marginTop: 8 }}>专属顾问：{project.salesContact}</div>
            )}
            <button className="cp-btn-outline" onClick={() => alert('您的顾问将尽快与您联系')}>
              联系销售顾问
            </button>
          </div>
        )}
      </div>
    </>
  );
}
