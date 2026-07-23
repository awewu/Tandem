'use client';
import { use, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { bim } from '../../../lib/api';
import { PageHeader } from '@rhautt/ui';

// IFC 查看器：统一到共享包 @rhautt/bim-viewer（客户端专用，禁用 SSR）。
// wasmPath 指向 /bim-wasm/（web-ifc 0.0.68，与共享包匹配），避开 dealer copy-wasm 的 /wasm/(0.0.77)。
const BimIfcViewer = dynamic(() => import('@rhautt/bim-viewer'), {
  ssr: false,
  loading: () => <div style={{ padding: 32, textAlign: 'center', color: 'var(--t-secondary)', fontSize: 13 }}>加载 BIM 查看器…</div>,
});

const STAGES = [
  { key: 'inherited',     label: '已承接' },
  { key: 'drawing',       label: '出图中' },
  { key: 'bom_confirmed', label: 'BOM确认' },
  { key: 'construction',  label: '施工中' },
  { key: 'acceptance',    label: '验收' },
  { key: 'iot_delivered', label: 'IoT交付' },
];
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

const S = {
  page:  { padding: 28, maxWidth: 960 } as const,
  back:  { fontSize: 13, color: 'var(--t-secondary)', marginBottom: 16, display: 'inline-block' } as const,
  head:  { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12, marginBottom: 24 } as const,
  row:   { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const } as const,
  input: { border: '1px solid var(--border-2)', borderRadius: 6, padding: '7px 11px', fontSize: 14, outline: 'none', flex: 1, minWidth: 200 } as const,
  btn:   (c = 'var(--brand)', sm = false) => ({ background: c, color: '#fff', border: 'none', borderRadius: 6, padding: sm ? '5px 12px' : '8px 18px', fontSize: sm ? 12 : 13, cursor: 'pointer', whiteSpace: 'nowrap' as const }),
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as const,
  th:    { textAlign: 'left' as const, padding: '8px 10px', borderBottom: '2px solid var(--border-2)', color: 'var(--t-secondary)', fontSize: 12 } as const,
  td:    { padding: '8px 10px', borderBottom: '1px solid #f0f0f0' } as const,
  num:   { textAlign: 'right' as const, padding: '8px 10px', borderBottom: '1px solid #f0f0f0' } as const,
  tag:   (c: string) => ({ background: c + '18', color: c, borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600 }),
};

type CheckItem = { system: string; item: string; done: boolean };
type BomRow    = { name?: string; systemFamily?: string; category?: string; model?: string; brand?: string; unit?: string; quantity?: number; unitPrice?: number; total?: number };
type Project   = {
  id: string; quotationNo?: string; status: string; drawingUrl?: string; customerName?: string;
  assignedTo?: string; city?: string; systemFamilies?: string[];
  bom?: BomRow[]; acceptanceChecklist?: CheckItem[];
  project?: { area?: number; floors?: number; city?: string };
};

export default function BimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [p, setP]             = useState<Project | null>(null);
  const [drawing, setDrawing] = useState('');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving]   = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [err, setErr]         = useState('');

  const load = () =>
    bim.get(id).then((d: Project) => { setP(d); setDrawing(d.drawingUrl || ''); setAssignee(d.assignedTo || ''); }).catch(() => setErr('加载失败'));

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  async function advance() {
    setAdvancing(true);
    try { await bim.advance(id); await load(); } catch (e: unknown) { setErr((e as Error).message); }
    setAdvancing(false);
  }
  async function saveDrawing() {
    setSaving(true);
    try { await bim.updateDrawing(id, drawing); await load(); } catch {}
    setSaving(false);
  }
  async function saveAssign() {
    try { await bim.assign(id, assignee); await load(); } catch (e: unknown) { setErr((e as Error).message); }
  }
  async function toggleCheck(index: number, done: boolean) {
    try { await bim.checkItem(id, index, !done); await load(); } catch (e: unknown) { setErr((e as Error).message); }
  }
  async function exportBom() {
    try { await bim.exportBom(id, `BOM_${p?.quotationNo || id.slice(0,8)}.xlsx`); } catch (e: unknown) { setErr((e as Error).message); }
  }
  async function downloadIotPackage() {
    try {
      const pkg = await bim.iotPackage(id);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `IoT_${p?.quotationNo || id.slice(0,8)}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) { setErr((e as Error).message); }
  }

  if (!p) return <div style={{ padding: 40, color: 'var(--t-secondary)' }}>{err || '加载中…'}</div>;

  const stageIdx = STAGE_IDX[p.status] ?? 0;
  const isDone   = p.status === 'iot_delivered';
  const bom      = p.bom || [];
  const checklist = p.acceptanceChecklist || [];
  const bomTotal  = bom.reduce((s, r) => s + (r.total ?? (r.unitPrice ?? 0) * (r.quantity ?? 1)), 0);
  const grouped   = checklist.reduce<Record<string, (CheckItem & { idx: number })[]>>((acc, c, i) => {
    (acc[c.system] ||= []).push({ ...c, idx: i }); return acc;
  }, {});

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <div style={{ maxWidth: 960 }}>
          <PageHeader
            title={`瑞诺瓦 BIM · ${p.quotationNo || id.slice(0, 8)}`}
            subtitle={[p.customerName, p.city || p.project?.city,
              p.project?.area && `${p.project.area}㎡`,
              p.systemFamilies?.join('、')].filter(Boolean).join('  ·  ') || undefined}
            actions={
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <a href="/bim" style={{ fontSize: 13, color: 'var(--t-secondary)', fontWeight: 500 }}>← 返回列表</a>
                {!isDone && (
                  <button style={S.btn()} onClick={advance} disabled={advancing}>
                    {advancing ? '推进中…' : `推进 → ${STAGES[stageIdx + 1]?.label ?? ''}`}
                  </button>
                )}
                {isDone && (
                  <button style={S.btn('var(--success)')} onClick={downloadIotPackage}>↓ IoT交付包</button>
                )}
              </div>
            }
          />

          {err && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{err}</div>}

          {/* 阶段进度 */}
          <div className="card-elevated" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {STAGES.map((s, i) => {
                const done = i < stageIdx, cur = i === stageIdx;
                const c = done ? 'var(--success)' : cur ? 'var(--brand)' : 'var(--border-2)';
                return (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: (done||cur) ? '#fff' : 'var(--t-tertiary)', fontWeight: 700 }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4, color: cur ? 'var(--brand)' : done ? 'var(--success)' : 'var(--t-tertiary)', fontWeight: cur ? 700 : 400 }}>{s.label}</div>
                    </div>
                    {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: done ? 'var(--success)' : 'var(--border-2)', marginBottom: 18 }} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 指派 + 出图 (两列) */}
          <div className="g2" style={{ gap: 16, marginBottom: 16 }}>
            <div className="card-elevated" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>👤 负责人</div>
              <div style={S.row}>
                <input style={S.input} value={assignee} onChange={e => setAssignee(e.target.value)} placeholder="用户ID / 姓名" />
                <button style={S.btn('#2d3561')} onClick={saveAssign}>指派</button>
              </div>
            </div>
            <div className="card-elevated" style={{ padding: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13 }}>📐 施工图纸</div>
              {p.drawingUrl && <a href={p.drawingUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--info)', fontSize: 12, display: 'block', marginBottom: 8, wordBreak: 'break-all' }}>{p.drawingUrl}</a>}
              <div style={S.row}>
                <input style={S.input} value={drawing} onChange={e => setDrawing(e.target.value)} placeholder="粘贴出图链接" />
                <button style={S.btn('#2d3561')} onClick={saveDrawing} disabled={saving}>{saving ? '…' : '保存'}</button>
              </div>
            </div>
          </div>

          {/* BIM 模型查看器 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ height: 520 }}><BimIfcViewer wasmPath="/bim-wasm/" /></div>
          </div>

          {/* BOM */}
          <div className="card-elevated" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontWeight: 600 }}>📦 BOM（{bom.length} 项）</span>
              <button style={S.btn('#2d3561', true)} onClick={exportBom}>导出 Excel</button>
            </div>
            {bom.length === 0 ? <div style={{ color: 'var(--t-tertiary)', fontSize: 13 }}>暂无BOM</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead><tr>
                    {['系统','名称','型号','品牌','单位','数量','单价','小计'].map(h => (
                      <th key={h} style={['数量','单价','小计'].includes(h) ? { ...S.th, textAlign: 'right' } : S.th}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {bom.map((r, i) => {
                      const sub = r.total ?? (r.unitPrice ?? 0) * (r.quantity ?? 1);
                      return (
                        <tr key={i}>
                          <td style={S.td}><span style={S.tag('var(--purple)')}>{r.systemFamily || r.category || '—'}</span></td>
                          <td style={S.td}>{r.name || '—'}</td>
                          <td style={{ ...S.td, color: 'var(--t-secondary)' }}>{r.model || '—'}</td>
                          <td style={S.td}>{r.brand || '—'}</td>
                          <td style={S.td}>{r.unit || '项'}</td>
                          <td style={S.num}>{r.quantity ?? 1}</td>
                          <td style={S.num}>¥{(r.unitPrice ?? 0).toLocaleString()}</td>
                          <td style={{ ...S.num, fontWeight: 600 }}>¥{sub.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <td colSpan={7} style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>合计</td>
                      <td style={{ ...S.num, fontWeight: 700, color: 'var(--brand)' }}>¥{bomTotal.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 验收清单 */}
          {checklist.length > 0 && (
            <div className="card-elevated" style={{ padding: 20, marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>
                ✅ 验收清单
                <span style={{ fontSize: 12, color: 'var(--t-secondary)', fontWeight: 400, marginLeft: 8 }}>
                  {checklist.filter(c => c.done).length}/{checklist.length} 已完成
                </span>
              </div>
              {Object.entries(grouped).map(([sys, items]) => (
                <div key={sys} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: 'var(--t-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{sys}</div>
                  {items.map(c => (
                    <div key={c.idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--surface-2)', opacity: c.done ? 0.55 : 1 }}>
                      <button onClick={() => toggleCheck(c.idx, c.done)}
                        style={{ width: 20, height: 20, borderRadius: 4, border: '2px solid ' + (c.done ? 'var(--success)' : 'var(--border-2)'), background: c.done ? 'var(--success)' : '#fff', color: '#fff', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
                        {c.done ? '✓' : ''}
                      </button>
                      <span style={{ fontSize: 13, textDecoration: c.done ? 'line-through' : 'none' }}>{c.item}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* IoT 交付包（已交付时显示） */}
          {isDone && (
            <div className="card-elevated" style={{ padding: 20, borderLeft: '3px solid var(--success)', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--success)' }}>🎉 项目已交付</div>
              <div style={{ fontSize: 13, color: 'var(--t-secondary)', marginBottom: 12 }}>
                验收时间：{p.project && '—'} · 下载IoT交付包将生成设备清单、网关配置和验收记录
              </div>
              <button style={S.btn('var(--success)')} onClick={downloadIotPackage}>↓ 下载 IoT 交付包 (.json)</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
