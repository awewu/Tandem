'use client';

/**
 * PMS · 信息管理岗工作台 — exception-driven, 一屏清零
 * 待仲裁申诉 / 未解决查重 / 生命周期预警 / 数据质量体检 / 合同积压
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, GitCompareArrows, Clock, DatabaseZap, FileWarning, RefreshCw, Check, X, ShieldCheck } from 'lucide-react';

interface Appeal { id: string; duplicateCheckId: string; appealerId: string; reason: string; status: string; createdAt: string }
interface Dup { id: string; status: string; similarityScore: number; dimensions: string[]; duplicateOpportunityId?: string; createdAt: string }
interface Life { id: string; customerName: string; projectName: string; stage: string; days: number; level: 'blue' | 'yellow' | 'red' }
interface Dq { id: string; customerName: string; projectName: string; issues: string[] }
interface Review { id: string; customerName: string; projectName: string; dealerOrgId: string; dealerOrgName?: string; estimatedAmount: number; createdAt: string }
interface PageMeta { page: number; pageSize: number; total: number; hasMore: boolean }
interface DealDesk {
  generatedAt: string;
  appeals: { total: number; page: PageMeta; items: Appeal[] };
  duplicates: { total: number; page: PageMeta; items: Dup[] };
  lifecycle: { blue: number; yellow: number; red: number; total: number; page: PageMeta; items: Life[] };
  dataQuality: { missingContact: number; orphan: number; total: number; page: PageMeta; items: Dq[] };
  contracts: { pending: number; amount: number };
  pendingReviews: { total: number; page: PageMeta; items: Review[] };
}

type DealDeskListKey = 'pendingReviews' | 'appeals' | 'duplicates' | 'lifecycle' | 'dataQuality';

const DEAL_DESK_PAGE_SIZE = 10;

const money = (n: number) => '¥' + (n ?? 0).toLocaleString('zh-CN');

function reviewDealerLabel(review: Review): string | null {
  const name = (review.dealerOrgName || review.dealerOrgId || '').trim();
  if (!name) return null;
  const customerName = review.customerName.trim();
  if (name === customerName || customerName.includes(name) || name.includes(customerName)) return null;
  return name;
}

function totalPages(meta: PageMeta): number {
  return Math.max(1, Math.ceil(meta.total / meta.pageSize));
}

interface Regression {
  tracesEvaluated: number;
  overallPassRate: number;
  byGrader: Record<string, { pass: number; total: number; passRate: number; avgScore: number }>;
}

const GRADER_LABELS: Record<string, string> = {
  'pms-structured': '产出结构化',
  'pms-grounded': '数据接地(防臆造)',
  'pms-ai-live': 'AI 增强可用率',
  'answer-quality': '答案质量(LLM自评)',
  'budget-sane': 'Token 预算',
  'guardrail-clean': '无注入/越狱',
};

export default function DealDeskPage() {
  const [data, setData] = useState<DealDesk | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'forbidden'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingList, setLoadingList] = useState<DealDeskListKey | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [regression, setRegression] = useState<Regression | null>(null);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [pages, setPages] = useState<Record<DealDeskListKey, number>>({
    pendingReviews: 1,
    appeals: 1,
    duplicates: 1,
    lifecycle: 1,
    dataQuality: 1,
  });
  const hasLoadedRef = useRef(false);
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    const hasLoaded = hasLoadedRef.current;
    const loadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = loadSeq;
    if (hasLoaded) setRefreshing(true);
    else setStatus('loading');
    try {
      const params = new URLSearchParams({
        pageSize: String(DEAL_DESK_PAGE_SIZE),
        pendingReviewsPage: String(pages.pendingReviews),
        appealsPage: String(pages.appeals),
        duplicatesPage: String(pages.duplicates),
        lifecyclePage: String(pages.lifecycle),
        dataQualityPage: String(pages.dataQuality),
      });
      const res = await fetch(`/api/pms/deal-desk?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (loadSeq !== loadSeqRef.current) return;
      if (res.status === 403) { setStatus('forbidden'); return; }
      if (!res.ok) {
        if (!hasLoaded) setStatus('error');
        else setStatus('ok');
        return;
      }
      const json = await res.json();
      setData(json.dealDesk);
      hasLoadedRef.current = true;
      setStatus('ok');
    } catch (error) {
      if (loadSeq !== loadSeqRef.current) return;
      console.warn('Deal desk load failed:', error);
      if (!hasLoaded) setStatus('error');
      else setStatus('ok');
    } finally {
      if (loadSeq === loadSeqRef.current) {
        setRefreshing(false);
        setLoadingList(null);
      }
    }
  }, [pages]);

  const loadEval = useCallback(async () => {
    try {
      const res = await fetch('/api/pms/eval', { credentials: 'include', cache: 'no-store' });
      if (res.ok) setRegression((await res.json()).regression);
    } catch { /* eval 只读, 失败不影响主流程 */ }
  }, []);

  useEffect(() => { load(); loadEval(); }, [load, loadEval]);

  useEffect(() => {
    if (!loadingList) return;
    const timeoutId = window.setTimeout(() => {
      setRefreshing(false);
      setLoadingList(null);
    }, 16000);
    return () => window.clearTimeout(timeoutId);
  }, [loadingList]);

  useEffect(() => {
    if (!data) return;
    const visibleIds = new Set(data.pendingReviews.items.map((item) => item.id));
    setSelectedReviewIds((ids) => ids.filter((id) => visibleIds.has(id)));
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const metas: Record<DealDeskListKey, PageMeta> = {
      pendingReviews: data.pendingReviews.page,
      appeals: data.appeals.page,
      duplicates: data.duplicates.page,
      lifecycle: data.lifecycle.page,
      dataQuality: data.dataQuality.page,
    };
    setPages((current) => {
      let changed = false;
      const next = { ...current };
      (Object.entries(metas) as Array<[DealDeskListKey, PageMeta]>).forEach(([key, meta]) => {
        const lastPage = totalPages(meta);
        if (next[key] > lastPage) {
          next[key] = lastPage;
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [data]);

  const setListPage = useCallback((key: DealDeskListKey, page: number) => {
    setPages((current) => {
      const nextPage = Math.max(1, page);
      if (current[key] === nextPage) return current;
      setLoadingList(key);
      return { ...current, [key]: nextPage };
    });
  }, []);

  const arbitrate = async (appealId: string, decision: 'approved' | 'rejected') => {
    setBusy(appealId);
    try {
      const res = await fetch('/api/pms/deal-desk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'arbitrate', appealId, decision }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  const review = async (opportunityId: string, decision: 'approved' | 'rejected') => {
    setReviewMessage(null);
    setBusy(opportunityId);
    try {
      const res = await fetch('/api/pms/deal-desk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review', opportunityId, decision }),
      });
      if (res.ok) await load();
    } finally {
      setBusy(null);
    }
  };

  const batchReview = async (decision: 'approved' | 'rejected') => {
    const ids = selectedReviewIds;
    if (ids.length === 0) return;
    setReviewMessage(null);
    setBusy(`batch-${decision}`);
    try {
      const res = await fetch('/api/pms/deal-desk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'review_batch', opportunityIds: ids, decision }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setReviewMessage(`批量${decision === 'approved' ? '通过' : '驳回'}完成：成功 ${json.success ?? 0} 条，失败 ${json.failed ?? 0} 条`);
        setSelectedReviewIds([]);
        await load();
      } else {
        setReviewMessage(json.error || '批量处理失败');
      }
    } finally {
      setBusy(null);
    }
  };

  if (status === 'loading') return <div className="p-6 text-ink-tertiary">加载中…</div>;
  if (status === 'forbidden') return <div className="p-6 text-ink-secondary">信息管理岗工作台仅限内部管理角色访问。</div>;
  if (status === 'error' || !data) return <div className="p-6 text-danger">加载失败，请重试。</div>;

  const pendingReviewIds = data.pendingReviews.items.map((item) => item.id);
  const allPendingReviewsSelected = pendingReviewIds.length > 0 && pendingReviewIds.every((id) => selectedReviewIds.includes(id));
  const reviewBusy = busy !== null;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-lg font-bold text-ink-primary flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-brand-500" /> 信息管理岗工作台
          </h1>
          <p className="text-caption text-ink-tertiary mt-1">统筹报备质量 · 撞单裁决 · 生命周期 · 数据治理 — 逐条清零</p>
        </div>
        <Button variant="outline" size="sm" disabled={refreshing} onClick={load}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />刷新
        </Button>
      </div>

      {/* 概览计数 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat icon={<ShieldCheck className="w-4 h-4" />} label="待审报备" value={data.pendingReviews.total} accent={data.pendingReviews.total > 0 ? 'warning' : undefined} />
        <Stat icon={<ClipboardList className="w-4 h-4" />} label="待仲裁申诉" value={data.appeals.total} accent={data.appeals.total > 0 ? 'warning' : undefined} />
        <Stat icon={<GitCompareArrows className="w-4 h-4" />} label="未解决查重" value={data.duplicates.total} accent={data.duplicates.total > 0 ? 'warning' : undefined} />
        <Stat icon={<Clock className="w-4 h-4" />} label="回顾进度(30/60/90)" value={data.lifecycle.blue + data.lifecycle.yellow + data.lifecycle.red} accent={data.lifecycle.red > 0 ? 'danger' : data.lifecycle.yellow > 0 ? 'warning' : undefined} />
        <Stat icon={<DatabaseZap className="w-4 h-4" />} label="数据质量问题" value={data.dataQuality.missingContact + data.dataQuality.orphan} accent={(data.dataQuality.missingContact + data.dataQuality.orphan) > 0 ? 'warning' : undefined} />
        <Stat icon={<FileWarning className="w-4 h-4" />} label="合同积压" value={data.contracts.pending} sub={money(data.contracts.amount)} accent={data.contracts.pending > 0 ? 'warning' : undefined} />
      </div>

      {/* 待审报备 — 前置审核关卡 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="text-headline flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-500" /> 待审报备 ({data.pendingReviews.total}) — 通过后方计入漏斗与分析
            </CardTitle>
            {data.pendingReviews.items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={reviewBusy || selectedReviewIds.length === 0} onClick={() => void batchReview('approved')}>
                  <Check className="w-4 h-4 mr-1" />批量通过{selectedReviewIds.length > 0 ? ` ${selectedReviewIds.length}` : ''}
                </Button>
                <Button size="sm" variant="outline" disabled={reviewBusy || selectedReviewIds.length === 0} onClick={() => void batchReview('rejected')}>
                  <X className="w-4 h-4 mr-1" />批量驳回{selectedReviewIds.length > 0 ? ` ${selectedReviewIds.length}` : ''}
                </Button>
              </div>
            )}
          </div>
          {reviewMessage && <p className="text-caption text-ink-secondary">{reviewMessage}</p>}
        </CardHeader>
        <CardContent className="space-y-2">
          <ListBox loading={loadingList === 'pendingReviews'}>
            {data.pendingReviews.items.length === 0 ? <Empty text="无待审报备" /> : (
              <>
                <div className="flex items-center gap-3 px-3 pb-1 text-caption text-ink-secondary">
                  <label className="inline-flex h-6 w-4 shrink-0 items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allPendingReviewsSelected}
                      onChange={(event) => setSelectedReviewIds(event.target.checked ? pendingReviewIds : [])}
                      className="h-4 w-4 rounded border-border"
                      disabled={reviewBusy}
                      aria-label="全选本页待审报备"
                    />
                  </label>
                  <span>全选本页{selectedReviewIds.length > 0 ? ` · 已选 ${selectedReviewIds.length} 条` : ''}</span>
                </div>
                {data.pendingReviews.items.map((r) => {
                  const dealerLabel = reviewDealerLabel(r);
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2">
                      <input
                        type="checkbox"
                        checked={selectedReviewIds.includes(r.id)}
                        onChange={(event) => setSelectedReviewIds((ids) => event.target.checked
                          ? Array.from(new Set([...ids, r.id]))
                          : ids.filter((id) => id !== r.id))}
                        className="h-4 w-4 shrink-0 rounded border-border"
                        disabled={reviewBusy}
                        aria-label={`选择 ${r.customerName}`}
                      />
                      <a href={`/pms/opportunities/${r.id}`} className="min-w-0 flex-1 hover:underline">
                        <p className="text-body text-ink-primary truncate">{r.customerName} · {r.projectName}</p>
                        <p className="text-caption text-ink-tertiary">
                          {[dealerLabel && `经销商 ${dealerLabel}`, money(r.estimatedAmount), new Date(r.createdAt).toLocaleDateString('zh-CN')].filter(Boolean).join(' · ')}
                        </p>
                      </a>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" disabled={reviewBusy} onClick={() => review(r.id, 'approved')}><Check className="w-4 h-4 mr-1" />通过</Button>
                        <Button size="sm" variant="outline" disabled={reviewBusy} onClick={() => review(r.id, 'rejected')}><X className="w-4 h-4 mr-1" />驳回</Button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </ListBox>
          <Pager meta={data.pendingReviews.page} disabled={reviewBusy || refreshing} onPageChange={(page) => setListPage('pendingReviews', page)} />
        </CardContent>
      </Card>

      {/* 待仲裁申诉 */}
      <Card>
        <CardHeader><CardTitle className="text-headline">待仲裁撞单申诉 ({data.appeals.total})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <ListBox loading={loadingList === 'appeals'}>
            {data.appeals.items.length === 0 ? <Empty text="无待仲裁申诉" /> : data.appeals.items.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2">
                <div className="min-w-0">
                  <p className="text-body text-ink-primary truncate">{a.reason}</p>
                  <p className="text-caption text-ink-tertiary">申诉人 {a.appealerId} · {a.status} · {new Date(a.createdAt).toLocaleDateString('zh-CN')}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" disabled={busy === a.id} onClick={() => arbitrate(a.id, 'approved')}><Check className="w-4 h-4 mr-1" />成立</Button>
                  <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => arbitrate(a.id, 'rejected')}><X className="w-4 h-4 mr-1" />维持</Button>
                </div>
              </div>
            ))}
          </ListBox>
          <Pager meta={data.appeals.page} disabled={busy !== null || refreshing} onPageChange={(page) => setListPage('appeals', page)} />
        </CardContent>
      </Card>

      {/* 未解决查重 */}
      <Card>
        <CardHeader><CardTitle className="text-headline">未解决查重冲突 ({data.duplicates.total})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <ListBox loading={loadingList === 'duplicates'}>
            {data.duplicates.items.length === 0 ? <Empty text="无未解决查重" /> : data.duplicates.items.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2">
                <div className="min-w-0">
                  <p className="text-body text-ink-primary">相似度 {Math.round(d.similarityScore * 100)}% · <span className={d.status === 'duplicate' ? 'text-danger' : 'text-warning'}>{d.status === 'duplicate' ? '撞单' : '疑似'}</span></p>
                  <p className="text-caption text-ink-tertiary truncate">命中维度: {d.dimensions.join(' / ') || '—'}</p>
                </div>
                <span className="text-caption text-ink-tertiary shrink-0">{new Date(d.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
            ))}
          </ListBox>
          <Pager meta={data.duplicates.page} disabled={refreshing} onPageChange={(page) => setListPage('duplicates', page)} />
        </CardContent>
      </Card>

      {/* 三阶回顾进度 (30/60/90) */}
      <Card>
        <CardHeader><CardTitle className="text-headline">商机回顾进度 · 30/60/90 天 (蓝提醒 {data.lifecycle.blue} · 黄预警 {data.lifecycle.yellow} · 红释放 {data.lifecycle.red})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <ListBox loading={loadingList === 'lifecycle'}>
            {data.lifecycle.items.length === 0 ? <Empty text="无需回顾商机" /> : data.lifecycle.items.map((l) => {
              const meta = l.level === 'red'
                ? { cls: 'text-danger', tag: '≥９０天 · 应释放公海' }
                : l.level === 'yellow'
                  ? { cls: 'text-warning', tag: '≥６０天 · 停滞预警' }
                  : { cls: 'text-brand-500', tag: '≥３０天 · 回顾提醒' };
              return (
                <a key={l.id} href={`/pms/opportunities/${l.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2 hover:bg-surface-3 transition-colors">
                  <div className="min-w-0">
                    <p className="text-body text-ink-primary truncate">{l.customerName} · {l.projectName}</p>
                    <p className="text-caption text-ink-tertiary">{l.stage}</p>
                  </div>
                  <span className={`text-caption shrink-0 text-right ${meta.cls}`}>{l.days} 天无跟进<br /><span className="opacity-80">{meta.tag}</span></span>
                </a>
              );
            })}
          </ListBox>
          <Pager meta={data.lifecycle.page} disabled={refreshing} onPageChange={(page) => setListPage('lifecycle', page)} />
        </CardContent>
      </Card>

      {/* 数据质量体检 */}
      <Card>
        <CardHeader><CardTitle className="text-headline">数据质量体检 (缺联系方式 {data.dataQuality.missingContact} · 孤儿商机 {data.dataQuality.orphan})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <ListBox loading={loadingList === 'dataQuality'}>
            {data.dataQuality.items.length === 0 ? <Empty text="数据质量良好" /> : data.dataQuality.items.map((q) => (
              <a key={q.id} href={`/pms/opportunities/${q.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-surface-2 hover:bg-surface-3 transition-colors">
                <div className="min-w-0">
                  <p className="text-body text-ink-primary truncate">{q.customerName} · {q.projectName}</p>
                </div>
                <span className="text-caption text-warning shrink-0">{q.issues.join(' · ')}</span>
              </a>
            ))}
          </ListBox>
          <Pager meta={data.dataQuality.page} disabled={refreshing} onPageChange={(page) => setListPage('dataQuality', page)} />
        </CardContent>
      </Card>

      {/* AI 分析质量 (评估台读数) */}
      {regression && regression.tracesEvaluated > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-headline">
              AI 分析质量 · 评估台 ({regression.tracesEvaluated} 条 · 总通过率 {Math.round(regression.overallPassRate * 100)}%)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(regression.byGrader).map(([id, g]) => (
              <div key={id}>
                <div className="flex justify-between text-caption text-ink-secondary mb-1">
                  <span>{GRADER_LABELS[id] ?? id}</span>
                  <span className={g.passRate >= 0.8 ? 'text-success' : g.passRate >= 0.5 ? 'text-warning' : 'text-danger'}>
                    {Math.round(g.passRate * 100)}% ({g.pass}/{g.total})
                  </span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${g.passRate * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="text-caption text-ink-tertiary pt-1">
              度量 spec 风险 / 决策链 / 招标解析三类 AI 分析的：产出结构化、数据接地(防臆造)、AI 增强可用率。让预警从「我说准」变「可度量准」。
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub, accent }: { icon: JSX.Element; label: string; value: number; sub?: string; accent?: 'danger' | 'warning' }) {
  const cls = accent === 'danger' ? 'text-danger' : accent === 'warning' ? 'text-warning' : 'text-ink-primary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-ink-tertiary mb-2">{icon}<span className="text-caption">{label}</span></div>
        <p className={`text-title-lg font-bold ${cls}`}>{value}</p>
        {sub && <p className="text-caption text-ink-tertiary mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-caption text-ink-tertiary py-2">{text}</p>;
}

function ListBox({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <div className="relative space-y-2">
      {children}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-surface-1/70 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-1 px-3 py-2 text-caption text-ink-secondary shadow-soft-sm">
            <RefreshCw className="h-4 w-4 animate-spin text-brand-500" />
            <span>加载中…</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Pager({ meta, disabled, onPageChange }: { meta: PageMeta; disabled?: boolean; onPageChange: (page: number) => void }) {
  const pages = totalPages(meta);
  if (meta.total <= meta.pageSize && pages <= 1) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 text-caption text-ink-tertiary sm:flex-row sm:items-center sm:justify-between">
      <span>共 {meta.total} 条 · 第 {meta.page} / {pages} 页 · 每页 {meta.pageSize} 条</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={disabled || meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>上一页</Button>
        <Button size="sm" variant="outline" disabled={disabled || !meta.hasMore} onClick={() => onPageChange(meta.page + 1)}>下一页</Button>
      </div>
    </div>
  );
}
