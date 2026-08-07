'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { growthCampaigns } from '../lib/api';

/**
 * 营销自动化 / 战役 ROI（真数据版，替换原硬编码假 AUTOMATIONS "38% 转化"）。
 * 连 /api/v2/growth/campaigns + roi-board。无数据即显示真实空态，不编造转化率。
 */

interface RoiRow { id?: string; name?: string; channel?: string; spend?: number; leads?: number; signed?: number; cac?: number; roi?: number }
interface Portfolio { spend: number; leads: number; signed: number; blendedCac: number }

const fmtNum = (n?: number) => (n === undefined || n === null ? '—' : Number(n).toLocaleString('zh-CN'));

export function CampaignRoiPanel() {
  const [board, setBoard] = useState<RoiRow[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await growthCampaigns.roiBoard();
      const d = r?.data || r;
      setBoard((d?.board || []) as RoiRow[]);
      setPortfolio((d?.portfolio || null) as Portfolio | null);
    } catch (e) { setError(e instanceof Error ? e.message : '加载 ROI 失败'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="card-elevated" style={{ padding: 18, display: 'grid', gap: 16 }}>
      <div className="workbench-section-header">
        <div>
          <p className="workbench-section-header__eyebrow">营销自动化</p>
          <h2 className="workbench-section-header__title">战役 ROI 看板</h2>
          <p className="workbench-section-header__description">线索触达、UTM 归因、CAC 与 ROI。数据来自真实战役指标；无投放数据即显示空态。</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}刷新
        </button>
      </div>

      {error ? <div className="inset" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div> : null}

      <div className="g4" style={{ gap: 12 }}>
        <Stat label="总投放" value={portfolio ? '¥' + fmtNum(portfolio.spend) : '—'} />
        <Stat label="线索数" value={fmtNum(portfolio?.leads)} />
        <Stat label="成交数" value={fmtNum(portfolio?.signed)} />
        <Stat label="综合 CAC" value={portfolio?.blendedCac ? '¥' + fmtNum(portfolio.blendedCac) : '—'} />
      </div>

      <div className="table-shell">
        <table className="table">
          <thead><tr><th>战役</th><th>渠道</th><th>投放</th><th>线索</th><th>成交</th><th>CAC</th><th>ROI</th></tr></thead>
          <tbody>
            {board.map((r, i) => (
              <tr key={r.id || i}>
                <td style={{ fontWeight: 700 }}>{r.name || '-'}</td>
                <td>{r.channel || '-'}</td>
                <td>¥{fmtNum(r.spend)}</td>
                <td>{fmtNum(r.leads)}</td>
                <td>{fmtNum(r.signed)}</td>
                <td>¥{fmtNum(r.cac)}</td>
                <td>{r.roi ?? '—'}</td>
              </tr>
            ))}
            {!board.length ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--t-tertiary)' }}>
                <Zap size={22} style={{ marginBottom: 6 }} /><br />
                {loading ? '加载中…' : '暂无战役数据。创建战役并录入指标后，此处展示真实 CAC/ROI。'}
              </td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="inset" style={{ padding: 14 }}>
      <span className="t-label">{label}</span>
      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: 'var(--t-strong)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </article>
  );
}
