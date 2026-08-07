'use client';

import { useState } from 'react';
import { Zap, FileText, ShieldCheck } from 'lucide-react';
import { PageHeader, useToast } from '@rhautt/ui';
import { agenticGeo } from '../../lib/api';

const ZONE_COLOR: Record<string, string> = { green: 'var(--success, #16A34A)', yellow: 'var(--warning, #F59E0B)', red: 'var(--danger, #DC2626)' };

export default function AgenticGeoPage() {
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState('faq');
  const [plan, setPlan] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function runPlan() {
    setBusy(true);
    try { setPlan(await agenticGeo.plan({ topic, kind, factRefs: [] })); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }
  async function approve(actionId: string) {
    try { const r = await agenticGeo.approve(actionId, { topic }); toast(r.ok ? `动作 ${actionId} 已核准执行` : `仍被拦：${(r.blocked?.reasons || []).join(';')}`, r.ok ? 'success' : 'info'); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <div className="page-container">
      <PageHeader
        title="AgenticGEO · 自主闭环"
        subtitle="选策略→生成草稿→受治理动作提案(green自动/yellow代行需核准/red人工)→lift 验证 · 推理收口 Tandem 治理网关 · 无事实源不出对外内容、无 lift 不宣称有效（基座4）"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="主题（如 燃气热水器 能效）" style={{ width: 220 }} />
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}><option value="faq">FAQ</option><option value="comparison">对比</option><option value="topic">主题页</option></select>
            <button className="btn btn-brand" disabled={busy} onClick={runPlan}><Zap size={15} />{busy ? '生成中…' : '生成计划'}</button>
          </div>
        }
      />

      {!plan ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Zap size={28} style={{ color: 'var(--t-tertiary)' }} />
          <p className="t-sm" style={{ color: 'var(--t-secondary)', marginTop: 12 }}>输入主题并「生成计划」，AgenticGEO 将产出受治理的选策略 / 草稿 / 分区动作提案。</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><ShieldCheck size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>① 选策略（自进化）</span></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(plan.strategies || []).map((s: string) => <span key={s} className="t-xs" style={{ background: 'var(--surface-2)', color: 'var(--brand-700, var(--brand))', borderRadius: 6, padding: '3px 10px' }}>{s}</span>)}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><FileText size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>② 生成草稿 {plan.draft?.factGrounded ? '' : '（⚠️ 无事实源，仅内部草稿）'}</span></div>
            <pre className="t-xs" style={{ color: 'var(--t-secondary)', whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto', margin: 0 }}>{plan.draft?.text || '(空)'}</pre>
            <div className="t-xs" style={{ color: 'var(--t-tertiary)', marginTop: 8 }}>provider: {plan.draft?.provider} · 合规打标: {(plan.draft?.complianceFlags || []).join(', ') || '无'}</div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}><ShieldCheck size={16} /><span className="t-lg" style={{ fontWeight: 600 }}>③ 受治理动作提案（{(plan.proposals || []).length}）</span></div>
            {(plan.proposals || []).length === 0 ? (
              <p className="t-xs" style={{ color: 'var(--t-tertiary)', margin: 0 }}>暂无注册的受治理动作。</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {(plan.proposals || []).map((p: any) => (
                  <div key={p.checkId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                    <span className="t-sm"><span style={{ color: ZONE_COLOR[p.zone] || 'var(--t-tertiary)', fontWeight: 700 }}>[{p.zone}]</span> {p.label} — {p.ok ? '已执行' : (p.blocked?.reasons || []).join(';')}</span>
                    {p.needsApproval && <button className="btn btn-outline btn-sm" onClick={() => approve(p.actionId)}>核准</button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="t-xs" style={{ color: 'var(--t-tertiary)' }}>④ lift 验证：{plan.lift?.note}</div>
        </div>
      )}
    </div>
  );
}
