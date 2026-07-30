/**
 * PMS · 公海池
 * 展示已释放到公海的商机, 支持认领 (claim)。内部可查看已认领历史。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Waves, MapPin, Hand, RefreshCw } from 'lucide-react';

interface PoolEntry {
  id: string;
  opportunityId: string;
  releasedReason: string;
  releasedAt: string;
  claimed: boolean;
  claimedBy?: string;
  protectionExpiresAt?: string;
  opportunity?: {
    customerName: string;
    projectName: string;
    region?: string;
    productLine?: string;
    estimatedAmount?: number;
  };
}

interface ScanResult {
  scanned: number;
  yellow: number;
  red: number;
  released: number;
}

const REASON_LABELS: Record<string, string> = {
  ninety_day_timeout: '90天超时',
  manual_release: '主动释放',
  dealer_inactive: '经销商不活跃',
};

export default function PmsPublicPoolPage() {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pms/public-pool', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error((await res.json()).error || '加载失败');
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function claim(poolEntryId: string) {
    try {
      setClaiming(poolEntryId);
      setError(null);
      const res = await fetch('/api/pms/public-pool', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim', poolEntryId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '认领失败');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaiming(null);
    }
  }

  async function runScan() {
    try {
      setScanning(true);
      setError(null);
      setScanResult(null);
      const res = await fetch('/api/pms/public-pool', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan',
          autoRelease: true,
          protectionDays: 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '扫描失败');
      setScanResult(data.result);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  function protectionActive(entry: PoolEntry): boolean {
    return !!entry.protectionExpiresAt && new Date(entry.protectionExpiresAt).getTime() > Date.now();
  }

  return (
    <div className="container mx-auto md:max-w-4xl p-6 max-w-4xl">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <Waves className="w-6 h-6 text-brand-500" />
            公海池
          </h1>
          <p className="text-body text-ink-secondary mt-1">90天未跟进自动释放 · 先到先得</p>
        </div>
        <Button
          variant="outline"
          className="rounded-2xl"
          disabled={scanning || loading}
          onClick={runScan}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? '扫描中...' : '执行90天扫描'}
        </Button>
      </div>

      {scanResult && (
        <Card className="mb-4 border-success/30 bg-success/5">
          <CardContent className="p-4 text-caption text-success">
            本次扫描 {scanResult.scanned} 条预警商机，90天超时 {scanResult.red} 条，已释放 {scanResult.released} 条。
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="mb-4 border-danger/30">
          <CardContent className="p-4 text-danger">{error}</CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-ink-secondary">公海暂无可认领商机</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {entries.map((e) => {
            const inProtection = protectionActive(e);
            return (
              <Card key={e.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-headline font-semibold text-ink-primary">
                      {e.opportunity?.customerName || e.opportunityId}
                    </h3>
                    <p className="text-body text-ink-secondary mt-1">{e.opportunity?.projectName || '—'}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-caption bg-surface-2 text-ink-secondary">
                        {REASON_LABELS[e.releasedReason] || e.releasedReason}
                      </span>
                      {e.opportunity?.region && (
                        <span className="inline-flex items-center gap-1 text-caption text-ink-tertiary">
                          <MapPin className="w-3 h-3" />
                          {e.opportunity.region}
                        </span>
                      )}
                      <span className="text-caption text-ink-tertiary">
                        释放于 {new Date(e.releasedAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {e.opportunity?.estimatedAmount != null && (
                      <p className="text-headline font-bold text-brand-500 mb-2">
                        ¥{e.opportunity.estimatedAmount.toLocaleString('zh-CN')}
                      </p>
                    )}
                    {e.claimed ? (
                      <span className="text-caption text-success">已认领</span>
                    ) : inProtection ? (
                      <span className="text-caption text-warning">保护期中</span>
                    ) : (
                      <Button
                        size="sm"
                        className="rounded-2xl bg-brand-500 hover:bg-brand-600"
                        disabled={claiming === e.id}
                        onClick={() => claim(e.id)}
                      >
                        <Hand className="w-4 h-4 mr-1" />
                        {claiming === e.id ? '认领中...' : '认领'}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
