'use client';

/**
 * PMS · 经销商报价编辑页
 *
 * 三层: 方案 → 系统[] → 明细[]。草稿可编辑; 已签发只读 + 显示验真码/出新版。
 * 分项 BOQ 实时汇总 (复用纯计算 quote-calc)。签发生成验真码 → 客户扫码验真。
 */

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { recomputeQuote } from '@/lib/pms/quote-calc';
import type { Quote, QuoteSystem, QuoteItem, QuoteCostType } from '@/lib/types/pms';

const COST_TYPE_LABEL: Record<QuoteCostType, string> = {
  equipment: '设备',
  material: '辅材',
  installation: '安装',
  freight: '运输',
  tax: '税费',
  service: '服务',
  other: '其他',
};
const COST_TYPES = Object.keys(COST_TYPE_LABEL) as QuoteCostType[];

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface ProductRow {
  id: string;
  series?: string;
  model: string;
  category?: string;
  specification?: string;
  unit?: string;
  listPrice?: number;
  attributes?: Record<string, string>;
}

interface SelectorField {
  key: string;
  label: string;
  type: 'number' | 'enum' | 'boolean' | 'text';
  unit?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: string | number | boolean;
  helpText?: string;
}
interface SelectorLite {
  id: string;
  name: string;
  category?: string;
  scenario?: string;
  description?: string;
  inputFields?: SelectorField[];
}
interface SelectorRunResult {
  system: QuoteSystem;
  warnings: string[];
}

function money(n: number): string {
  return `¥${(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
}

export default function QuoteEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id as string;

  const [quote, setQuote] = useState<Quote | null>(null);
  const [systems, setSystems] = useState<QuoteSystem[]>([]);
  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [terms, setTerms] = useState<{ included?: string; excluded?: string; warranty?: string; payment?: string; note?: string }>({});
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [templates, setTemplates] = useState<{ id: string; name: string; category?: string }[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>('');
  // --- 智能选型 (P3) ---
  const [selectors, setSelectors] = useState<SelectorLite[]>([]);
  const [selectorModal, setSelectorModal] = useState<SelectorLite | null>(null);
  const [selectorInputs, setSelectorInputs] = useState<Record<string, string>>({});
  const [selectorResult, setSelectorResult] = useState<SelectorRunResult | null>(null);
  const [selectorBusy, setSelectorBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const r = await fetch(`/api/pms/quotes/${id}`, { credentials: 'include', cache: 'no-store' });
      if (r.status === 404) return setStatus('notfound');
      if (!r.ok) return setStatus('error');
      const { quote: q } = await r.json();
      setQuote(q);
      setSystems(q.systems ?? []);
      setTitle(q.title ?? '');
      setValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : '');
      setTerms(q.terms ?? {});
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch('/api/pms/products?type=products&limit=200', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => setProducts(d.products ?? []))
      .catch(() => setProducts([]));
    loadTemplates();
    fetch('/api/pms/selectors?status=published&limit=100', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { rulesets: [] }))
      .then((d) => setSelectors(d.rulesets ?? []))
      .catch(() => setSelectors([]));
  }, [load]);

  // --- 智能选型: 打开问卷 / 运行 / 回填 ---
  const openSelector = (rs: SelectorLite) => {
    const seed: Record<string, string> = {};
    (rs.inputFields ?? []).forEach((f) => {
      if (f.defaultValue !== undefined && f.defaultValue !== null) seed[f.key] = String(f.defaultValue);
    });
    setSelectorInputs(seed);
    setSelectorResult(null);
    setSelectorModal(rs);
  };

  const runSelector = async () => {
    if (!selectorModal) return;
    setSelectorBusy(true);
    try {
      const inputs: Record<string, string | number> = {};
      (selectorModal.inputFields ?? []).forEach((f) => {
        const raw = selectorInputs[f.key];
        if (raw === undefined || raw === '') return;
        inputs[f.key] = f.type === 'number' ? Number(raw) : raw;
      });
      const r = await fetch(`/api/pms/selectors/${selectorModal.id}/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inputs }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '选型失败');
      setSelectorResult(d.result);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSelectorBusy(false);
    }
  };

  const applySelectorResult = () => {
    if (!selectorResult?.system) return;
    const sys = selectorResult.system;
    const cloned: QuoteSystem = {
      ...sys,
      id: uid('sys'),
      items: (sys.items ?? []).map((it) => ({ ...it, id: uid('it') })),
    };
    setSystems((prev) => [...prev, cloned]);
    setMsg(`已回填选型系统「${cloned.name}」`);
    setSelectorModal(null);
    setSelectorResult(null);
  };

  // 选型弹窗: ESC 关闭 (a11y)
  useEffect(() => {
    if (!selectorModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectorModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectorModal]);

  const loadTemplates = useCallback(async () => {
    try {
      const r = await fetch('/api/pms/quote-templates?limit=200', { credentials: 'include', cache: 'no-store' });
      if (r.ok) setTemplates((await r.json()).templates ?? []);
    } catch { /* 模板加载失败不阻断编辑 */ }
  }, []);

  const editable = quote?.status === 'draft';

  // 实时重算 (纯函数, 与后端一致)
  const computed = useMemo(() => recomputeQuote(systems), [systems]);
  const totals = computed.totals;

  // --- 系统 / 明细 编辑 ---
  const addSystem = () =>
    setSystems((s) => [...s, { id: uid('sys'), name: `系统 ${s.length + 1}`, items: [], subtotal: 0 }]);
  const removeSystem = (sid: string) => setSystems((s) => s.filter((x) => x.id !== sid));
  const patchSystem = (sid: string, patch: Partial<QuoteSystem>) =>
    setSystems((s) => s.map((x) => (x.id === sid ? { ...x, ...patch } : x)));

  const addItem = (sid: string, seed?: Partial<QuoteItem>) =>
    setSystems((s) =>
      s.map((x) =>
        x.id === sid
          ? {
              ...x,
              items: [
                ...x.items,
                {
                  id: uid('it'),
                  costType: seed?.costType ?? 'equipment',
                  model: seed?.model ?? '',
                  specification: seed?.specification,
                  unit: seed?.unit ?? '台',
                  quantity: 1,
                  listPrice: seed?.listPrice ?? 0,
                  discountRate: undefined,
                  unitPrice: seed?.listPrice ?? 0,
                  amount: seed?.listPrice ?? 0,
                  productCatalogId: seed?.productCatalogId,
                  attributesSnapshot: seed?.attributesSnapshot,
                },
              ],
            }
          : x,
      ),
    );
  const removeItem = (sid: string, itid: string) =>
    setSystems((s) => s.map((x) => (x.id === sid ? { ...x, items: x.items.filter((i) => i.id !== itid) } : x)));
  const patchItem = (sid: string, itid: string, patch: Partial<QuoteItem>) =>
    setSystems((s) =>
      s.map((x) =>
        x.id === sid ? { ...x, items: x.items.map((i) => (i.id === itid ? { ...i, ...patch } : i)) } : x,
      ),
    );

  const addProductToSystem = (sid: string, pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    addItem(sid, {
      costType: 'equipment',
      model: p.model,
      specification: p.specification,
      unit: p.unit ?? '台',
      listPrice: p.listPrice ?? 0,
      productCatalogId: p.id,
      attributesSnapshot: p.attributes,
    });
  };

  // --- 模板: 套用 / 存为 ---
  async function applyTemplate(tid: string) {
    if (!tid || !editable) return;
    try {
      const r = await fetch(`/api/pms/quote-templates/${tid}`, { credentials: 'include', cache: 'no-store' });
      if (!r.ok) throw new Error('模板加载失败');
      const { template } = await r.json();
      // 深克隆并重新生成 id, 避免与现有行冲突
      const cloned: QuoteSystem[] = (template.systems ?? []).map((sys: QuoteSystem) => ({
        ...sys,
        id: uid('sys'),
        items: (sys.items ?? []).map((it) => ({ ...it, id: uid('it') })),
      }));
      setSystems((prev) => [...prev, ...cloned]);
      if (template.terms) setTerms((prev) => ({ ...template.terms, ...prev }));
      setMsg(`已套用模板「${template.name}」`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function saveAsTemplate() {
    if (!quote) return;
    const name = prompt('模板名称', title || '未命名方案模板');
    if (!name?.trim()) return;
    setBusy('tpl');
    setMsg('');
    try {
      const r = await fetch('/api/pms/quote-templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId: quote.orgId, name: name.trim(), systems: computed.systems, terms }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '存为模板失败');
      setMsg(`已存为模板「${name.trim()}」`);
      await loadTemplates();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // --- 动作 ---
  async function save() {
    setBusy('save');
    setMsg('');
    try {
      const r = await fetch(`/api/pms/quotes/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, systems: computed.systems, terms, validUntil: validUntil || null }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '保存失败');
      setMsg('已保存');
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function act(path: string, label: string, redirectToNew = false) {
    setBusy(label);
    setMsg('');
    try {
      const r = await fetch(`/api/pms/quotes/${id}/${path}`, { method: 'POST', credentials: 'include' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `${label}失败`);
      if (redirectToNew && d.quote?.id) {
        router.push(`/pms/quotes/${d.quote.id}`);
        return;
      }
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (!confirm('确认作废此报价?')) return;
    setBusy('revoke');
    try {
      const r = await fetch(`/api/pms/quotes/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('作废失败');
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (status === 'loading') return <div className="p-8 text-ink-tertiary">加载中…</div>;
  if (status === 'notfound') return <div className="p-8 text-ink-tertiary">报价不存在或无权限</div>;
  if (status === 'error') return <div className="p-8 text-danger">加载失败</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* 头部 */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editable ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-headline font-semibold"
              placeholder="报价方案标题"
            />
          ) : (
            <h1 className="truncate text-headline font-semibold text-ink-primary">{quote?.title}</h1>
          )}
          <div className="mt-1 text-caption text-ink-tertiary">
            客户 {quote?.customerName} · 版本 v{quote?.version} ·{' '}
            <StatusBadge status={quote?.status ?? ''} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href={`/pms/quotes/${id}/print`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border px-3 py-2 text-caption font-medium text-ink-secondary hover:bg-surface-2"
          >
            打印 / 导出
          </a>
          {editable && (
            <button onClick={save} disabled={!!busy} className="rounded-lg bg-surface-3 px-3 py-2 text-caption font-medium text-ink-secondary hover:bg-surface-3 disabled:opacity-50">
              {busy === 'save' ? '保存中…' : '保存'}
            </button>
          )}
          {editable && (
            <button onClick={() => act('issue', 'issue')} disabled={!!busy} className="rounded-lg bg-info/80 px-3 py-2 text-caption font-medium text-white hover:bg-info/70 disabled:opacity-50">
              {busy === 'issue' ? '签发中…' : '签发报价'}
            </button>
          )}
          {!editable && quote?.status !== 'revoked' && (
            <button onClick={() => act('revise', 'revise', true)} disabled={!!busy} className="rounded-lg bg-info/80 px-3 py-2 text-caption font-medium text-white hover:bg-info/70 disabled:opacity-50">
              改价出新版本
            </button>
          )}
          {quote?.status !== 'revoked' && (
            <button onClick={revoke} disabled={!!busy} className="rounded-lg border border-danger/30 px-3 py-2 text-caption font-medium text-danger hover:bg-danger/5 disabled:opacity-50">
              作废
            </button>
          )}
        </div>
      </div>

      {msg && <div className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-caption text-warning">{msg}</div>}

      {/* 模板工具条 (仅草稿可编辑时) */}
      {editable && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
          <span className="text-footnote font-medium text-ink-tertiary">方案模板</span>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                applyTemplate(e.target.value);
                e.target.value = '';
              }
            }}
            className="rounded-md border border-border px-2 py-1.5 text-footnote text-ink-secondary"
          >
            <option value="">套用模板 (追加系统)…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}{t.category ? ` · ${t.category}` : ''}</option>
            ))}
          </select>
          <button
            onClick={saveAsTemplate}
            disabled={!!busy || computed.systems.length === 0}
            className="rounded-md border border-border bg-white px-2.5 py-1.5 text-footnote text-ink-secondary hover:bg-surface-3 disabled:opacity-50"
          >
            {busy === 'tpl' ? '保存中…' : '存为模板'}
          </button>
          {selectors.length > 0 && (
            <>
              <span className="ml-2 text-footnote font-medium text-ink-tertiary">智能选型</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  const rs = selectors.find((s) => s.id === e.target.value);
                  if (rs) openSelector(rs);
                  e.target.value = '';
                }}
                className="rounded-md border border-border px-2 py-1.5 text-footnote text-ink-secondary"
              >
                <option value="">按工况选型 (追加系统)…</option>
                {selectors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.category ? ` · ${s.category}` : ''}</option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {/* 智能选型问卷弹窗 */}
      {selectorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectorModal(null)}>
          <div role="dialog" aria-modal="true" aria-label="智能选型" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-soft-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-body font-semibold text-ink-primary">{selectorModal.name}</div>
            {selectorModal.description && <p className="mb-3 text-footnote text-ink-tertiary">{selectorModal.description}</p>}
            <div className="space-y-3">
              {(selectorModal.inputFields ?? []).map((f, idx) => (
                <div key={f.key}>
                  <label className="mb-1 block text-footnote font-medium text-ink-secondary">
                    {f.label}{f.required && <span className="text-danger"> *</span>}{f.unit ? ` (${f.unit})` : ''}
                  </label>
                  {f.type === 'enum' && f.options ? (
                    <select
                      autoFocus={idx === 0}
                      value={selectorInputs[f.key] ?? ''}
                      onChange={(e) => setSelectorInputs((s) => ({ ...s, [f.key]: e.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-caption"
                    >
                      <option value="">请选择…</option>
                      {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      autoFocus={idx === 0}
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={selectorInputs[f.key] ?? ''}
                      onChange={(e) => setSelectorInputs((s) => ({ ...s, [f.key]: e.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-caption"
                      placeholder={f.helpText}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button onClick={runSelector} disabled={selectorBusy} className="rounded-lg bg-info/80 px-3 py-2 text-caption font-medium text-white hover:bg-info/70 disabled:opacity-50">
                {selectorBusy ? '选型中…' : '运行选型'}
              </button>
              <button onClick={() => setSelectorModal(null)} className="rounded-lg border border-border px-3 py-2 text-caption text-ink-secondary hover:bg-surface-2">取消</button>
            </div>

            {selectorResult && (
              <div className="mt-4 rounded-lg border border-border p-3">
                <div className="mb-2 text-caption font-medium text-ink-primary">
                  {selectorResult.system.name} · 小计 {money(selectorResult.system.subtotal)}
                </div>
                <ul className="mb-2 divide-y divide-slate-50 text-footnote">
                  {selectorResult.system.items.map((it, i) => (
                    <li key={i} className="flex justify-between py-1">
                      <span className="text-ink-secondary">{it.model} × {it.quantity}{it.unit}</span>
                      <span className="tabular-nums text-ink-tertiary">{money(it.amount)}</span>
                    </li>
                  ))}
                  {selectorResult.system.items.length === 0 && <li className="py-2 text-ink-tertiary">无推荐行</li>}
                </ul>
                {selectorResult.warnings.length > 0 && (
                  <ul className="mb-2 space-y-0.5 text-footnote text-warning">
                    {selectorResult.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                  </ul>
                )}
                <button
                  onClick={applySelectorResult}
                  disabled={selectorResult.system.items.length === 0}
                  className="rounded-lg bg-success/80 px-3 py-2 text-caption font-medium text-white hover:bg-success/70 disabled:opacity-50"
                >
                  回填到报价 (追加系统)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 验真码 (已签发) */}
      {quote?.verifyCode && quote.status === 'issued' && (
        <VerifyShare code={quote.verifyCode} />
      )}

      {/* 系统 + 明细 */}
      <div className="space-y-4">
        {computed.systems.map((sys) => (
          <div key={sys.id} className="rounded-2xl border border-border bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              {editable ? (
                <input
                  value={sys.name}
                  onChange={(e) => patchSystem(sys.id, { name: e.target.value })}
                  className="flex-1 rounded-md border border-border px-2 py-1.5 text-caption font-medium"
                  placeholder="系统名称 (如 生活热水系统)"
                />
              ) : (
                <div className="flex-1 text-caption font-semibold text-ink-primary">{sys.name}</div>
              )}
              {sys.sourceRuleSetName && (
                <span
                  className="rounded bg-info/10 px-1.5 py-0.5 text-footnote text-info"
                  title={`由选型规则集「${sys.sourceRuleSetName}」v${sys.sourceRuleSetVersion} 生成`}
                >
                  选型 {sys.sourceRuleSetName} v{sys.sourceRuleSetVersion}
                </span>
              )}
              <div className="text-caption text-ink-tertiary">小计 {money(sys.subtotal)}</div>
              {editable && (
                <button onClick={() => removeSystem(sys.id)} className="text-footnote text-danger hover:underline">
                  删除系统
                </button>
              )}
            </div>

            {/* 明细表 */}
            <div className="overflow-x-auto">
              <table className="w-full text-caption">
                <thead>
                  <tr className="border-b border-border text-left text-footnote text-ink-tertiary">
                    <th className="py-1.5 pr-2">类型</th>
                    <th className="py-1.5 pr-2">型号/项目</th>
                    <th className="py-1.5 pr-2">规格</th>
                    <th className="py-1.5 pr-2">单位</th>
                    <th className="py-1.5 pr-2 text-right">数量</th>
                    <th className="py-1.5 pr-2 text-right">面价</th>
                    <th className="py-1.5 pr-2 text-right">折扣</th>
                    <th className="py-1.5 pr-2 text-right">折后单价</th>
                    <th className="py-1.5 pr-2 text-right">小计</th>
                    {editable && <th className="py-1.5" />}
                  </tr>
                </thead>
                <tbody>
                  {sys.items.map((it) => (
                    <tr key={it.id} className="border-b border-border">
                      <td className="py-1 pr-2">
                        {editable ? (
                          <select value={it.costType} onChange={(e) => patchItem(sys.id, it.id, { costType: e.target.value as QuoteCostType })} className="rounded border border-border px-1 py-1 text-footnote">
                            {COST_TYPES.map((c) => (
                              <option key={c} value={c}>{COST_TYPE_LABEL[c]}</option>
                            ))}
                          </select>
                        ) : (
                          COST_TYPE_LABEL[it.costType]
                        )}
                      </td>
                      <Cell editable={editable} value={it.model ?? ''} onChange={(v) => patchItem(sys.id, it.id, { model: v })} w="w-40" />
                      <Cell editable={editable} value={it.specification ?? ''} onChange={(v) => patchItem(sys.id, it.id, { specification: v })} w="w-28" />
                      <Cell editable={editable} value={it.unit ?? ''} onChange={(v) => patchItem(sys.id, it.id, { unit: v })} w="w-14" />
                      <NumCell editable={editable} value={it.quantity} onChange={(v) => patchItem(sys.id, it.id, { quantity: v })} />
                      <NumCell editable={editable} value={it.listPrice} onChange={(v) => patchItem(sys.id, it.id, { listPrice: v, unitPrice: NaN as unknown as number })} />
                      <NumCell editable={editable} value={it.discountRate ?? NaN} onChange={(v) => patchItem(sys.id, it.id, { discountRate: Number.isNaN(v) ? undefined : v, unitPrice: NaN as unknown as number })} placeholder="—" step={0.01} />
                      <td className="py-1 pr-2 text-right text-ink-secondary">{money(it.unitPrice)}</td>
                      <td className="py-1 pr-2 text-right font-medium text-ink-primary">{money(it.amount)}</td>
                      {editable && (
                        <td className="py-1 text-right">
                          <button onClick={() => removeItem(sys.id, it.id)} className="text-footnote text-danger hover:text-danger">✕</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {sys.items.length === 0 && (
                    <tr>
                      <td colSpan={editable ? 10 : 9} className="py-3 text-center text-footnote text-ink-tertiary">暂无明细</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {editable && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => addItem(sys.id)} className="rounded-md bg-surface-3 px-2.5 py-1.5 text-footnote text-ink-secondary hover:bg-surface-3">+ 手动加行</button>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addProductToSystem(sys.id, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="rounded-md border border-border px-2 py-1.5 text-footnote text-ink-secondary"
                >
                  <option value="">+ 从产品目录选设备…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.model}{p.specification ? ` · ${p.specification}` : ''}{p.listPrice ? ` · ¥${p.listPrice}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
        {editable && (
          <button onClick={addSystem} className="w-full rounded-2xl border border-dashed border-border py-3 text-caption text-ink-tertiary hover:border-border hover:text-ink-secondary">
            + 添加系统
          </button>
        )}
      </div>

      {/* 分项汇总 */}
      <div className="mt-6 rounded-2xl border border-border bg-white p-4">
        <div className="mb-2 text-caption font-semibold text-ink-primary">分项报价汇总</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-caption sm:grid-cols-3">
          {COST_TYPES.map((c) => (
            <div key={c} className="flex justify-between">
              <span className="text-ink-tertiary">{COST_TYPE_LABEL[c]}</span>
              <span className="tabular-nums text-ink-secondary">{money(totals[c])}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-caption text-ink-tertiary">方案总价</span>
          <span className="text-title-3 font-bold tabular-nums text-info">{money(totals.total)}</span>
        </div>
      </div>

      {/* 商务条款 */}
      <div className="mt-6 rounded-2xl border border-border bg-white p-4">
        <div className="mb-3 text-caption font-semibold text-ink-primary">商务条款</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TermField editable={editable} label="含项" value={terms.included} onChange={(v) => setTerms({ ...terms, included: v })} />
          <TermField editable={editable} label="不含项" value={terms.excluded} onChange={(v) => setTerms({ ...terms, excluded: v })} />
          <TermField editable={editable} label="质保/售后" value={terms.warranty} onChange={(v) => setTerms({ ...terms, warranty: v })} />
          <TermField editable={editable} label="付款方式" value={terms.payment} onChange={(v) => setTerms({ ...terms, payment: v })} />
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-footnote text-ink-tertiary">有效期至</label>
          {editable ? (
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="rounded-md border border-border px-2 py-1.5 text-caption" />
          ) : (
            <div className="text-caption text-ink-secondary">{quote?.validUntil ? quote.validUntil.slice(0, 10) : '—'}</div>
          )}
        </div>
      </div>

      {/* 操作留痕 (创建/签发/改价/作废) */}
      <QuoteAuditTrail quoteId={id} statusKey={quote?.status ?? ''} />
    </div>
  );
}

function QuoteAuditTrail({ quoteId, statusKey }: { quoteId: string; statusKey: string }) {
  const [trail, setTrail] = useState<Array<{ action: string; actorId: string; timestamp: string; metadata?: Record<string, unknown> }>>([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/pms/quotes/${quoteId}/audit`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { trail: [] }))
      .then((d) => { if (alive) setTrail(d.trail ?? []); })
      .catch(() => { /* 留痕加载失败不阻断 */ });
    return () => { alive = false; };
  }, [quoteId, statusKey]);

  if (trail.length === 0) return null;
  const LABEL: Record<string, string> = {
    'pms.quote.created': '创建草稿',
    'pms.quote.issued': '签发 (生成验真码)',
    'pms.quote.revised': '出新版本 (改价)',
    'pms.quote.revoked': '作废',
  };
  return (
    <div className="mt-6 rounded-2xl border border-border bg-white p-4">
      <div className="mb-3 text-caption font-semibold text-ink-primary">操作留痕</div>
      <ol className="space-y-2">
        {trail.map((t, i) => (
          <li key={i} className="flex items-start gap-3 text-caption">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-info/30" />
            <div className="min-w-0">
              <div className="text-ink-primary">{LABEL[t.action] ?? t.action}</div>
              <div className="text-footnote text-ink-tertiary">
                {t.actorId} · {new Date(t.timestamp).toLocaleString('zh-CN')}
                {typeof t.metadata?.totalAmount === 'number' ? ` · ${money(t.metadata.totalAmount as number)}` : ''}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function VerifyShare({ code }: { code: string }) {
  const [qr, setQr] = useState<string>('');
  const [copied, setCopied] = useState<string>('');
  const [url, setUrl] = useState<string>(`/verify/${code}`);

  useEffect(() => {
    const full = typeof window !== 'undefined' ? `${window.location.origin}/verify/${code}` : `/verify/${code}`;
    setUrl(full);
    let alive = true;
    import('qrcode')
      .then((m) => {
        const toDataURL = (m as { toDataURL?: typeof import('qrcode').toDataURL }).toDataURL
          ?? (m as { default: typeof import('qrcode') }).default.toDataURL;
        return toDataURL(full, { width: 176, margin: 1, errorCorrectionLevel: 'M' });
      })
      .then((d) => { if (alive) setQr(d); })
      .catch(() => { /* QR 生成失败不阻断: 仍可复制链接 */ });
    return () => { alive = false; };
  }, [code]);

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* 剪贴板不可用 (非 https / 权限) 时忽略 */ }
  };

  return (
    <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center">
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="验真二维码" className="h-40 w-40 shrink-0 rounded-lg border border-success/30 bg-white p-1" />
      ) : (
        <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-lg border border-dashed border-success/30 bg-white text-footnote text-success">
          生成二维码…
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-caption font-medium text-success">已签发 · 官方验真</div>
        <div className="mt-1 font-mono text-headline font-bold tracking-wider text-success">{code}</div>
        <div className="mt-1 break-all text-footnote text-success">
          客户扫码或访问{' '}
          <a className="underline" href={url} target="_blank" rel="noreferrer">{url}</a>{' '}
          验真 (只显真伪 + 授权经销商, 不露价)。
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => copy(code, 'code')}
            className="rounded-lg border border-success/40 bg-white px-3 py-1.5 text-footnote font-medium text-success hover:bg-success/15"
          >
            {copied === 'code' ? '已复制' : '复制验真码'}
          </button>
          <button
            onClick={() => copy(url, 'url')}
            className="rounded-lg border border-success/40 bg-white px-3 py-1.5 text-footnote font-medium text-success hover:bg-success/15"
          >
            {copied === 'url' ? '已复制' : '复制验真链接'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-surface-3 text-ink-secondary',
    issued: 'bg-success/15 text-success',
    accepted: 'bg-info/15 text-info',
    superseded: 'bg-warning/15 text-warning',
    expired: 'bg-surface-3 text-ink-tertiary',
    revoked: 'bg-danger/10 text-danger',
  };
  const label: Record<string, string> = { draft: '草稿', issued: '已签发', accepted: '已接受', superseded: '已被替代', expired: '已过期', revoked: '已作废' };
  return <span className={'rounded px-1.5 py-0.5 text-footnote ' + (map[status] ?? 'bg-surface-3')}>{label[status] ?? status}</span>;
}

function Cell({ editable, value, onChange, w }: { editable: boolean; value: string; onChange: (v: string) => void; w: string }) {
  if (!editable) return <td className="py-1 pr-2 text-ink-secondary">{value || '—'}</td>;
  return (
    <td className="py-1 pr-2">
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`${w} rounded border border-border px-1.5 py-1 text-footnote`} />
    </td>
  );
}

function NumCell({ editable, value, onChange, placeholder, step }: { editable: boolean; value: number; onChange: (v: number) => void; placeholder?: string; step?: number }) {
  const display = Number.isNaN(value) ? '' : value;
  if (!editable) return <td className="py-1 pr-2 text-right text-ink-secondary">{Number.isNaN(value) ? '—' : value}</td>;
  return (
    <td className="py-1 pr-2 text-right">
      <input
        type="number"
        step={step ?? 1}
        value={display}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className="w-20 rounded border border-border px-1.5 py-1 text-right text-footnote"
      />
    </td>
  );
}

function TermField({ editable, label, value, onChange }: { editable: boolean; label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-footnote text-ink-tertiary">{label}</label>
      {editable ? (
        <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={2} className="w-full rounded-md border border-border px-2 py-1.5 text-caption" />
      ) : (
        <div className="whitespace-pre-wrap text-caption text-ink-secondary">{value || '—'}</div>
      )}
    </div>
  );
}
