'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { deepening } from '../../../../lib/api';
import BimIfcViewer from '../../../../components/BimIfcViewer';

type Pkg = Record<string, any>;

const TYPE_LABEL: Record<string, string> = {
  'principle-diagram': '原理图',
  'construction-drawing': '施工图',
  'bim-model': 'BIM 3D 模型',
  'floor-plan': '二维平面图',
  'bom': '物料清单 BOM',
  'quantity-takeoff': '工程量清单',
  'standards-check': '规范校验',
  'customer-report': '客户报告',
  'render': '效果图',
};

export default function DeepenPage() {
  const params = useParams();
  const projectId = String(params.projectId || '');
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [project, setProject] = useState<Pkg | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    setLoading(true); setErr('');
    return Promise.all([
      deepening.deepeningPackage(projectId).catch((e) => { throw e; }),
      deepening.project(projectId).catch(() => null),
    ])
      .then(([p, pr]) => { setPkg(p); setProject(pr); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { if (projectId) load(); }, [projectId, load]);

  async function run(label: string, fn: () => Promise<any>) {
    setBusy(label); setMsg(''); setErr('');
    try { await fn(); setMsg(`${label} 完成`); await load(); }
    catch (e) { setErr(`${label} 失败：${(e as Error).message}`); }
    finally { setBusy(''); }
  }

  const required: Record<string, any> = pkg?.requiredArtifacts || {};
  const bimArtifactId = required['bim-model']?.artifactId || required['bim-model']?.id
    || (pkg?.artifacts || []).find((a: any) => a.type === 'bim-model')?.artifactId;
  const missing: string[] = pkg?.missingTypes || [];
  const nextActions: any[] = pkg?.nextActions || [];
  const handoffReady = pkg?.handoffReady === true;

  return (
    <main style={{ padding: 20, maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <a href="/bim/deepen-queue" style={{ fontSize: 13, color: 'var(--brand)', textDecoration: 'none' }}>← 队列</a>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>深化台 · {project?.name || `项目 ${projectId.slice(0, 8)}`}</h1>
        {handoffReady
          ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: 'rgba(21,128,61,0.12)', color: '#15803d', fontWeight: 600 }}>可交付</span>
          : <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999, background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>深化中</span>}
      </div>
      <p style={{ fontSize: 13, color: 'var(--t-secondary)', marginBottom: 16 }}>
        基于签约资料（二维图 / 原理图 / 报价）深化 BIM 3D、施工图、效果图，补齐后提升为 verified 并回挂合同。
      </p>

      {loading && <div style={{ color: 'var(--t-tertiary)', padding: 20 }}>加载中…</div>}
      {err && <div style={{ color: 'var(--danger)', padding: 12, background: '#fdecea', borderRadius: 6, marginBottom: 12 }}>{err}</div>}
      {msg && <div style={{ color: '#15803d', padding: 12, background: '#dcfce7', borderRadius: 6, marginBottom: 12 }}>{msg}</div>}

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
          {/* 左：签约资料就绪度 + 动作 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <section style={card}>
              <h2 style={h2}>签约资料就绪度</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['floor-plan', 'principle-diagram', 'bom', 'construction-drawing', 'bim-model', 'render'].map((t) => {
                  const has = required[t] || (pkg?.artifacts || []).some((a: any) => a.type === t);
                  return (
                    <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px dashed var(--border)' }}>
                      <span>{TYPE_LABEL[t] || t}</span>
                      <span style={{ color: has ? '#15803d' : '#b45309', fontWeight: 600 }}>{has ? '✓ 已具备' : '待生成'}</span>
                    </div>
                  );
                })}
              </div>
              {missing.length > 0 && <div style={{ marginTop: 10, fontSize: 12, color: '#b45309' }}>缺失：{missing.map((m) => TYPE_LABEL[m] || m).join('、')}</div>}
            </section>

            <section style={card}>
              <h2 style={h2}>深化动作</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button style={actBtn} disabled={!!busy} onClick={() => run('生成效果图', () => deepening.generateVisual(projectId))}>{busy === '生成效果图' ? '生成中…' : '① 生成效果图 (visual)'}</button>
                <button style={actBtn} disabled={!!busy} onClick={() => run('生成施工图/交付物', () => deepening.generateDeliverable(projectId))}>{busy === '生成施工图/交付物' ? '生成中…' : '② 生成施工图 / BOM (deliverable)'}</button>
                <button style={{ ...actBtn, background: '#0f766e', color: '#fff', borderColor: '#0f766e' }} disabled={!!busy} onClick={() => run('提升 verified', () => deepening.advance(projectId))}>{busy === '提升 verified' ? '提升中…' : '③ 阶段推进 / 提升 verified'}</button>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--t-tertiary)' }}>engineer 角色可将 estimate 深化确认为 verified。</div>
            </section>

            {nextActions.length > 0 && (
              <section style={card}>
                <h2 style={h2}>建议下一步</h2>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--t-secondary)', lineHeight: 1.7 }}>
                  {nextActions.slice(0, 6).map((a, i) => <li key={i}>{typeof a === 'string' ? a : (a.label || a.action || JSON.stringify(a))}</li>)}
                </ul>
              </section>
            )}
          </div>

          {/* 右：BIM 3D 查看器 */}
          <section style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>
              BIM 3D 深化 {bimArtifactId ? `· 已挂载模型 ${String(bimArtifactId).slice(0, 8)}` : '· 无 BIM 模型产物，可加载本地 IFC'}
            </div>
            <div style={{ height: 620 }}>
              <BimIfcViewer key={bimArtifactId || 'file'} artifactId={bimArtifactId} height={620} status={bimArtifactId ? '正在加载签约 BIM 产物…' : '请加载本地 IFC 或先生成 BIM 模型'} />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

const card: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 };
const h2: React.CSSProperties = { fontSize: 14, fontWeight: 700, margin: '0 0 10px' };
const actBtn: React.CSSProperties = { padding: '9px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', cursor: 'pointer', textAlign: 'left' };
