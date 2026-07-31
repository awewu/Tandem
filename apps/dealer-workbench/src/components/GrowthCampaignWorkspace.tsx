'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, CheckCircle2, Loader2, Plus, RefreshCw } from 'lucide-react';
import { growthCampaigns } from '../lib/api';

type Campaign = {
  id: string;
  name: string;
  channel: string;
  budget: string | number;
  status: string;
  utm?: Record<string, unknown>;
  createdAt: string;
};

type BoardRow = {
  campaignId: string;
  name: string;
  channel: string;
  status: string;
  metricCount: number;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  signed: number;
  ctr: number;
  leadRate: number;
  signedRate: number;
  cpl: number;
  cac: number;
  roi?: number;
  alerts?: Array<{ level: 'warn' | 'crit'; kind: string; message: string }>;
};

function fmtMoney(value?: number | string) {
  const n = Number(value || 0);
  return `¥${n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}

function pct(value?: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function fmtDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function GrowthCampaignWorkspace() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [portfolio, setPortfolio] = useState<{ spend?: number; leads?: number; signed?: number; blendedCac?: number }>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [campaignForm, setCampaignForm] = useState({
    name: '夏季热泵推广',
    channel: '官网 / 信息流',
    budget: 30000,
    utmCampaign: 'summer-heatpump',
  });
  const [metricForm, setMetricForm] = useState({
    campaignId: '',
    impressions: 10000,
    clicks: 420,
    leads: 18,
    signed: 2,
    period: 'week',
  });

  const totals = useMemo(() => {
    const impressions = board.reduce((sum, item) => sum + Number(item.impressions || 0), 0);
    const clicks = board.reduce((sum, item) => sum + Number(item.clicks || 0), 0);
    const alerts = board.reduce((sum, item) => sum + (item.alerts?.length || 0), 0);
    return { impressions, clicks, alerts };
  }, [board]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [campaignData, roiData] = await Promise.all([
        growthCampaigns.list(),
        growthCampaigns.roiBoard(),
      ]);
      const nextCampaigns = campaignData?.items || [];
      setCampaigns(nextCampaigns);
      setBoard(roiData?.board || []);
      setPortfolio(roiData?.portfolio || {});
      setMetricForm((current) => ({
        ...current,
        campaignId: current.campaignId || nextCampaigns[0]?.id || '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '营销自动化数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCampaign() {
    if (!campaignForm.name.trim() || !campaignForm.channel.trim()) {
      setError('请填写战役名称和渠道');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await growthCampaigns.create({
        name: campaignForm.name.trim(),
        channel: campaignForm.channel.trim(),
        budget: Number(campaignForm.budget || 0),
        utm: { campaign: campaignForm.utmCampaign.trim() || campaignForm.name.trim() },
      });
      setMetricForm((current) => ({ ...current, campaignId: result?.campaign?.id || current.campaignId }));
      setMessage('战役已创建，可开始录入指标或等待 lead.captured 自动归因');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建战役失败');
    } finally {
      setBusy(false);
    }
  }

  async function recordMetric() {
    if (!metricForm.campaignId) {
      setError('请先选择战役');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await growthCampaigns.recordMetric({
        campaignId: metricForm.campaignId,
        impressions: Number(metricForm.impressions || 0),
        clicks: Number(metricForm.clicks || 0),
        leads: Number(metricForm.leads || 0),
        signed: Number(metricForm.signed || 0),
        period: metricForm.period.trim() || undefined,
      });
      setMessage('指标已入账，ROI 看板已更新');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '记录指标失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <p className="t-label">E4 营销自动化</p>
          <h2 className="t-headline" style={{ marginTop: 4 }}>战役归因与 ROI 看板</h2>
          <p style={{ color: 'var(--t-secondary)', fontSize: 13, marginTop: 4 }}>先把 UTM 战役、手工指标和 lead.captured 自动归因接起来，形成可复盘的 CAC/CPL。</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading || busy}>
          {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          刷新
        </button>
      </div>

      {(error || message) && (
        <div className={error ? 'alert alert-danger' : 'alert alert-success'}>
          {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          {error || message}
        </div>
      )}

      <div className="g4" style={{ gap: 12 }}>
        <Metric label="总预算" value={fmtMoney(portfolio.spend)} />
        <Metric label="线索数" value={String(portfolio.leads || 0)} />
        <Metric label="成交数" value={String(portfolio.signed || 0)} />
        <Metric label="组合 CAC" value={fmtMoney(portfolio.blendedCac)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div className="inset" style={{ display: 'grid', gap: 10 }}>
          <span className="t-label">新建战役</span>
          <input className="input" value={campaignForm.name} onChange={(event) => setCampaignForm({ ...campaignForm, name: event.target.value })} placeholder="战役名称" />
          <input className="input" value={campaignForm.channel} onChange={(event) => setCampaignForm({ ...campaignForm, channel: event.target.value })} placeholder="渠道" />
          <input className="input" type="number" min={0} value={campaignForm.budget} onChange={(event) => setCampaignForm({ ...campaignForm, budget: Number(event.target.value) || 0 })} placeholder="预算" />
          <input className="input" value={campaignForm.utmCampaign} onChange={(event) => setCampaignForm({ ...campaignForm, utmCampaign: event.target.value })} placeholder="utm_campaign" />
          <button className="btn btn-brand" onClick={() => void createCampaign()} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            创建战役
          </button>
        </div>

        <div className="inset" style={{ display: 'grid', gap: 10 }}>
          <span className="t-label">录入指标</span>
          <select className="input" value={metricForm.campaignId} onChange={(event) => setMetricForm({ ...metricForm, campaignId: event.target.value })}>
            <option value="">选择战役</option>
            {campaigns.map((item) => (
              <option key={item.id} value={item.id}>{item.name} · {item.channel}</option>
            ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            <input className="input" type="number" min={0} value={metricForm.impressions} onChange={(event) => setMetricForm({ ...metricForm, impressions: Number(event.target.value) || 0 })} placeholder="曝光" />
            <input className="input" type="number" min={0} value={metricForm.clicks} onChange={(event) => setMetricForm({ ...metricForm, clicks: Number(event.target.value) || 0 })} placeholder="点击" />
            <input className="input" type="number" min={0} value={metricForm.leads} onChange={(event) => setMetricForm({ ...metricForm, leads: Number(event.target.value) || 0 })} placeholder="线索" />
            <input className="input" type="number" min={0} value={metricForm.signed} onChange={(event) => setMetricForm({ ...metricForm, signed: Number(event.target.value) || 0 })} placeholder="成交" />
          </div>
          <input className="input" value={metricForm.period} onChange={(event) => setMetricForm({ ...metricForm, period: event.target.value })} placeholder="周期，如 week / 2026-W31" />
          <button className="btn btn-outline" onClick={() => void recordMetric()} disabled={busy || !campaigns.length}>
            {busy ? <Loader2 size={15} className="spin" /> : <BarChart3 size={15} />}
            记录指标
          </button>
        </div>
      </div>

      <div className="table-shell">
        <table className="table">
          <thead>
            <tr><th>战役</th><th>渠道</th><th>预算</th><th>曝光/点击</th><th>线索/成交</th><th>CPL</th><th>CAC</th><th>预警</th></tr>
          </thead>
          <tbody>
            {board.map((item) => (
              <tr key={item.campaignId}>
                <td style={{ fontWeight: 700 }}>{item.name}</td>
                <td>{item.channel}</td>
                <td>{fmtMoney(item.spend)}</td>
                <td>{item.impressions} / {item.clicks}<br /><span style={{ color: 'var(--t-tertiary)' }}>CTR {pct(item.ctr)}</span></td>
                <td>{item.leads} / {item.signed}<br /><span style={{ color: 'var(--t-tertiary)' }}>留资 {pct(item.leadRate)}</span></td>
                <td>{fmtMoney(item.cpl)}</td>
                <td>{fmtMoney(item.cac)}</td>
                <td>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {(item.alerts || []).map((alert) => (
                      <span key={`${item.campaignId}-${alert.kind}`} className={alert.level === 'crit' ? 'badge badge-danger' : 'badge badge-warning'}>{alert.message}</span>
                    ))}
                    {!(item.alerts || []).length && <span className="badge badge-success">正常</span>}
                  </div>
                </td>
              </tr>
            ))}
            {!board.length && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--t-tertiary)' }}>暂无战役，先创建一个 UTM 战役。</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="inset" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Metric label="累计曝光" value={String(totals.impressions)} />
        <Metric label="累计点击" value={String(totals.clicks)} />
        <Metric label="看板预警" value={String(totals.alerts)} />
        <Metric label="战役数量" value={String(campaigns.length)} />
      </div>

      <div className="table-shell">
        <table className="table">
          <thead>
            <tr><th>战役</th><th>渠道</th><th>状态</th><th>预算</th><th>UTM</th><th>创建时间</th></tr>
          </thead>
          <tbody>
            {campaigns.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 700 }}>{item.name}</td>
                <td>{item.channel}</td>
                <td><span className="badge badge-info">{item.status}</span></td>
                <td>{fmtMoney(item.budget)}</td>
                <td>{String(item.utm?.campaign || '-')}</td>
                <td>{fmtDate(item.createdAt)}</td>
              </tr>
            ))}
            {!campaigns.length && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--t-tertiary)' }}>暂无战役。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="inset" style={{ padding: 14 }}>
      <p className="t-label">{label}</p>
      <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: 'var(--brand)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </article>
  );
}
