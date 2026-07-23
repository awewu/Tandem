'use client';
import { useEffect, useState } from 'react';
import { bim } from '../../lib/api';
import { PageHeader } from '@rhautt/ui';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  inherited:     { label: '已承接',    color: 'var(--purple)' },
  drawing:       { label: '出图中',    color: 'var(--warning)' },
  bom_confirmed: { label: 'BOM确认',   color: 'var(--info)' },
  construction:  { label: '施工中',    color: '#f97316' },
  acceptance:    { label: '验收中',    color: 'var(--purple)' },
  iot_delivered: { label: 'IoT已交付', color: 'var(--success)' },
};
const FILTERS = [['', '全部'], ...Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])];

const S = {
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 } as const,
  row:   { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const },
  input: { border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 14, outline: 'none', width: 240 } as const,
  btn:   (c = 'var(--brand)', sm = false) => ({ background: c, color: '#fff', border: 'none', borderRadius: 6, padding: sm ? '5px 12px' : '8px 16px', fontSize: sm ? 12 : 13, cursor: 'pointer', whiteSpace: 'nowrap' as const }),
  filt:  (active: boolean) => ({ background: active ? 'var(--t-strong)' : 'var(--surface-2)', color: active ? '#fff' : 'var(--t-secondary)', border: '1px solid ' + (active ? 'var(--t-strong)' : 'var(--border)'), borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }),
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 } as const,
  th:    { textAlign: 'left' as const, padding: '9px 12px', borderBottom: '2px solid var(--border)', color: 'var(--t-secondary)', fontSize: 11, whiteSpace: 'nowrap' as const },
  td:    { padding: '9px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' as const },
  badge: (c: string) => ({ background: c + '18', color: c, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }),
  empty: { textAlign: 'center' as const, color: 'var(--t-tertiary)', padding: 32, fontSize: 14 },
};

type Project = { id: string; quotationNo?: string; status: string; customerName?: string; city?: string; systemFamilies?: string[]; bom?: unknown[]; assignedTo?: string };
type Stats   = { total: number; inProgress: number; delivered: number; byStatus: Record<string, number> };

export default function BimPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [statsData, setStatsData] = useState<Stats | null>(null);
  const [filter, setFilter]    = useState('');
  const [loading, setLoading]  = useState(true);
  const [quoteId, setQuoteId]  = useState('');
  const [inheriting, setInheriting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = (status = filter) => {
    setLoading(true);
    Promise.all([
      bim.list(status ? { status } : {}),
      bim.stats(),
    ]).then(([list, s]) => {
      setProjects(Array.isArray(list) ? list : list.items ?? []);
      setStatsData(s);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function switchFilter(s: string) { setFilter(s); load(s); }

  async function inherit() {
    if (!quoteId.trim()) return;
    setInheriting(true); setMsg(null);
    try {
      await bim.inherit(quoteId.trim());
      setMsg({ ok: true, text: `报价 ${quoteId} 已承接为 BIM 项目` });
      setQuoteId(''); load(filter);
    } catch (e: unknown) { setMsg({ ok: false, text: (e as Error).message }); }
    finally { setInheriting(false); }
  }

  async function advance(id: string) {
    try { await bim.advance(id); load(filter); }
    catch (e: unknown) { alert((e as Error).message); }
  }

  async function exportBom(p: Project) {
    try { await bim.exportBom(p.id, `BOM_${p.quotationNo || p.id.slice(0,8)}.xlsx`); }
    catch (e: unknown) { alert((e as Error).message); }
  }

  const statCards = [
    { label: '全部项目', value: statsData?.total ?? '—' },
    { label: '进行中',   value: statsData?.inProgress ?? '—' },
    { label: '已交付',   value: statsData?.delivered ?? '—' },
    { label: '本月承接', value: statsData?.byStatus?.inherited ?? '—' },
  ];

  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container">
        <PageHeader title="瑞诺瓦 BIM 工作台" subtitle="签单 → 承接 → 出图 → BOM → 施工 → 验收 → IoT交付" />

      {/* 统计卡 */}
      <div style={S.stats}>
        {statCards.map(s => (
          <div key={s.label} className="card-elevated" style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--t-strong)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 深化入口 */}
      <div className="card-elevated" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>深化交付</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href="/bim/deepen-queue" style={{ ...S.btn(), textDecoration: 'none', display: 'inline-block' }}>待深化队列</a>
          <a href="/bim/artifacts" style={{ ...S.btn('var(--t-strong)'), textDecoration: 'none', display: 'inline-block' }}>产物库</a>
        </div>
      </div>

      {/* 承接入口 */}
      <div className="card-elevated" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>从报价单承接项目</div>
        <div style={S.row}>
          <input style={S.input} value={quoteId} placeholder="输入报价单 ID 或报价编号"
            onChange={e => setQuoteId(e.target.value)} onKeyDown={e => e.key === 'Enter' && inherit()} />
          <button style={S.btn()} onClick={inherit} disabled={inheriting || !quoteId.trim()}>
            {inheriting ? '承接中…' : '+ 承接报价'}
          </button>
        </div>
        {msg && <div style={{ fontSize: 12, color: msg.ok ? 'var(--success)' : 'var(--danger)', marginTop: 6 }}>{msg.text}</div>}
      </div>

      {/* 状态筛选 + 列表 */}
      <div className="card-elevated" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(([k, l]) => (
              <button key={k} style={S.filt(filter === k)} onClick={() => switchFilter(k)}>{l}</button>
            ))}
          </div>
          <button style={S.btn('var(--t-strong)', true)} onClick={() => load(filter)}>刷新</button>
        </div>

        {loading ? <div style={S.empty}>加载中…</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={S.table}>
              <thead><tr>
                {['报价编号','客户','城市','系统','BOM','状态','操作'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr><td colSpan={7} style={S.empty}>暂无项目</td></tr>
                ) : projects.map(p => {
                  const st = STATUS_MAP[p.status] ?? { label: p.status, color: 'var(--t-secondary)' };
                  return (
                    <tr key={p.id}>
                      <td style={S.td}>{p.quotationNo || p.id.slice(0,8)}</td>
                      <td style={S.td}>{p.customerName || '—'}</td>
                      <td style={S.td}>{p.city || '—'}</td>
                      <td style={{ ...S.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(p.systemFamilies || []).join(' · ') || '—'}
                      </td>
                      <td style={S.td}>{p.bom?.length ?? 0}</td>
                      <td style={S.td}><span style={S.badge(st.color)}>{st.label}</span></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <a href={`/bim/${p.id}`} style={S.btn('var(--t-strong)', true)}>打开</a>
                          <button style={S.btn('#2d3561', true)} onClick={() => exportBom(p)}>导出</button>
                          {p.status !== 'iot_delivered' && (
                            <button style={S.btn('var(--success)', true)} onClick={() => advance(p.id)}>推进→</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
