'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Loader2, RefreshCw, TrendingUp, UserRound, Users } from 'lucide-react';
import { dealerCrm } from '../lib/api';

/**
 * 经销商专属工作台（P0 · 补"赋能客户"最大空缺）。
 * 经销商视角（非总部全网）：我的业绩 / 我的线索管道 / 我的客户 / 我的报价历史。
 * 全部连真数据：crm/pipeline · crm/customers · quotation。无数据显示空态。
 */

const STAGES = ['lead', 'contacted', 'proposal', 'negotiation', 'signed', 'lost'] as const;
const STAGE_LABEL: Record<string, string> = {
  lead: '新线索', contacted: '已联系', proposal: '方案中', negotiation: '谈判', signed: '已成交', lost: '流失',
};
const STAGE_TONE: Record<string, string> = {
  lead: 'var(--t-secondary)', contacted: 'var(--brand)', proposal: 'var(--warning)',
  negotiation: 'var(--warning)', signed: 'var(--success)', lost: 'var(--danger)',
};
const yuan = (n: number) => `¥${(Number(n) || 0).toLocaleString('zh-CN')}`;
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) : '—');

interface Opp { id: string; customerId: string; stage: string; estimatedValue: number; probability: number; nextActionAt: string | null; updatedAt: string; customer?: { name?: string; city?: string } }
interface Customer { id: string; name: string; city: string | null; status: string; source: string | null; lastInteractionAt: string | null }
interface Quotation { id: string; quotationNo: string; status: string; customerId: string; createdAt: string; costBreakdown?: any }

export function DealerCockpit() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyOpp, setBusyOpp] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, c, q] = await Promise.all([dealerCrm.pipeline(), dealerCrm.customers(), dealerCrm.quotations()]);
      setOpps(((p?.items || p || []) as Opp[]));
      setCustomers(((c?.items || c || []) as Customer[]));
      setQuotes(((q?.items || q || []) as Quotation[]));
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const total = opps.length;
    const signed = opps.filter((o) => o.stage === 'signed').length;
    const active = opps.filter((o) => !['signed', 'lost'].includes(o.stage)).length;
    const pipeline = opps.filter((o) => !['signed', 'lost'].includes(o.stage)).reduce((s, o) => s + (Number(o.estimatedValue) || 0), 0);
    const closeRate = total ? Math.round((signed / total) * 100) : 0;
    return { total, signed, active, pipeline, closeRate };
  }, [opps]);

  const custName = (id: string) => customers.find((c) => c.id === id)?.name || id.slice(0, 8);

  const changeStage = async (opp: Opp, stage: string) => {
    setBusyOpp(opp.id);
    try { await dealerCrm.updateStage(opp.id, stage); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : '更新阶段失败'); }
    finally { setBusyOpp(null); }
  };

  const [exporting, setExporting] = useState<string | null>(null);
  const exportQuote = async (q: Quotation) => {
    setExporting(q.id);
    try {
      // 用报价真实数据在前端生成 CSV 下载（经销商自己的报价数据，不编造）。
      // 说明：后端 ExportEngine(quotation/export) 暂不可用，故前端直出；引擎修复后可切回服务端富格式。
      const items: any[] = Array.isArray((q as any).items) ? (q as any).items : [];
      const cost: any = (q as any).costBreakdown || {};
      const lines: string[] = [];
      lines.push(`报价单号,${q.quotationNo || q.id}`);
      lines.push(`客户,${custName(q.customerId)}`);
      lines.push(`状态,${q.status}`);
      lines.push(`日期,${fmtDate(q.createdAt)}`);
      lines.push('');
      lines.push('名称,型号,数量,单价');
      for (const it of items) lines.push(`${it.name ?? ''},${it.model ?? it.sku ?? ''},${it.quantity ?? 1},${it.price ?? it.unitPrice ?? ''}`);
      if (cost && (cost.total ?? cost.subtotal)) {
        lines.push('');
        lines.push(`小计,${cost.subtotal ?? ''}`);
        lines.push(`税,${cost.tax ?? ''}`);
        lines.push(`合计,${cost.total ?? ''}`);
      }
      const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `报价单-${q.quotationNo || q.id.slice(0, 8)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : '导出失败'); }
    finally { setExporting(null); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* 我的业绩 */}
      <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
        <div className="workbench-section-header">
          <div>
            <p className="workbench-section-header__eyebrow">经销商工作台 · 我的视角</p>
            <h2 className="workbench-section-header__title">我的业绩</h2>
            <p className="workbench-section-header__description">我的线索、客户与报价（本账号数据，非全网）。数据来自 CRM + 报价，真实无编造。</p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
          </button>
        </div>
        {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}
        <div className="g4" style={{ gap: 12 }}>
          <Stat icon={Users} label="活跃线索" value={String(stats.active)} />
          <Stat icon={TrendingUp} label="在途金额" value={yuan(stats.pipeline)} />
          <Stat icon={UserRound} label="我的客户" value={String(customers.length)} />
          <Stat icon={FileText} label="成交率" value={`${stats.closeRate}%`} tone={stats.closeRate >= 30 ? 'var(--success)' : undefined} />
        </div>
      </section>

      {/* 我的线索管道（可改阶段） */}
      <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 14 }}>
        <div className="workbench-section-header"><div>
          <p className="workbench-section-header__eyebrow">线索管道</p>
          <h2 className="workbench-section-header__title">我的线索（可推进阶段）</h2>
        </div></div>
        <div className="table-shell">
          <table className="table">
            <thead><tr><th>客户</th><th>阶段</th><th>预估额</th><th>赢率</th><th>下次跟进</th><th>推进</th></tr></thead>
            <tbody>
              {opps.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 700 }}>{o.customer?.name || custName(o.customerId)}</td>
                  <td><span className="badge" style={{ color: STAGE_TONE[o.stage], borderColor: STAGE_TONE[o.stage] }}>{STAGE_LABEL[o.stage] || o.stage}</span></td>
                  <td>{yuan(o.estimatedValue)}</td>
                  <td>{o.probability ? `${o.probability}%` : '—'}</td>
                  <td>{fmtDate(o.nextActionAt || undefined)}</td>
                  <td>
                    <select
                      value={o.stage}
                      disabled={busyOpp === o.id}
                      onChange={(e) => changeStage(o, e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--surface-3)', background: 'var(--surface-1)', fontSize: 12 }}
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
              {!opps.length ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--t-tertiary)' }}>{loading ? '加载中…' : '暂无线索。总部转派或官网询盘进来后在此跟进。'}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* 我的客户 + 报价历史 */}
      <div className="g2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div className="workbench-section-header"><div><h2 className="workbench-section-header__title" style={{ fontSize: 16 }}>我的客户</h2></div></div>
          <div className="table-shell">
            <table className="table">
              <thead><tr><th>客户</th><th>城市</th><th>来源</th><th>状态</th></tr></thead>
              <tbody>
                {customers.slice(0, 12).map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td>{c.city || '—'}</td>
                    <td>{c.source || '—'}</td>
                    <td><span className="badge">{c.status}</span></td>
                  </tr>
                ))}
                {!customers.length ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--t-tertiary)' }}>暂无客户</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 12 }}>
          <div className="workbench-section-header"><div><h2 className="workbench-section-header__title" style={{ fontSize: 16 }}>我的报价历史</h2></div></div>
          <div className="table-shell">
            <table className="table">
              <thead><tr><th>报价单号</th><th>客户</th><th>状态</th><th>时间</th><th>导出</th></tr></thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 700 }}>{q.quotationNo || q.id.slice(0, 8)}</td>
                    <td>{custName(q.customerId)}</td>
                    <td><span className="badge">{q.status}</span></td>
                    <td>{fmtDate(q.createdAt)}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => exportQuote(q)} disabled={exporting === q.id}>
                        {exporting === q.id ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}导出
                      </button>
                    </td>
                  </tr>
                ))}
                {!quotes.length ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--t-tertiary)' }}>暂无报价。在售前工作台生成报价后在此归档。</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <article className="inset" style={{ padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="t-label">{label}</span>
        <Icon size={15} style={{ color: tone || 'var(--brand)' }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: tone || 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </article>
  );
}
