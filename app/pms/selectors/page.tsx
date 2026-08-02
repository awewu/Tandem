'use client';

/**
 * PMS · 选型配置器 (P3 · 内部维护)
 *
 * 配置驱动: "研"团队以数据形式维护 inputFields(工况问卷) + rules(选型规则)。
 * 规则本身即数据 → 无需改代码即可上线新选型。此页提供:
 *   - 规则集列表 (草稿/已发布)
 *   - 元信息编辑 + inputFields/rules JSON 编辑器 (骨架级, 研填数据)
 *   - 试跑 (填工况 → 引擎产出推荐, 不落库) + 发布 / 软删
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

interface RuleSet {
  id: string;
  name: string;
  category?: string;
  scenario?: string;
  description?: string;
  systemName?: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  inputFields: unknown[];
  rules: unknown[];
  updatedAt: string;
  publishedAt?: string;
}

interface SelectorVersion {
  id: string;
  version: number;
  name: string;
  publishedBy: string;
  publishedAt: string;
  rules: unknown[];
  inputFields: unknown[];
}

const money = (n: number) => '¥' + (n ?? 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });

const STATUS_LABEL: Record<string, string> = { draft: '草稿', published: '已发布', archived: '已归档' };

const SAMPLE_INPUT_FIELDS = JSON.stringify(
  [
    { key: 'demandPoints', label: '用水点数', type: 'number', unit: '点', required: true },
    { key: 'buildingType', label: '建筑类型', type: 'enum', options: [{ value: 'hotel', label: '酒店' }, { value: 'apartment', label: '公寓' }] },
  ],
  null,
  2,
);
const SAMPLE_RULES = JSON.stringify(
  [
    {
      id: 'r1',
      label: '主机 (按点数配)',
      when: [{ field: 'demandPoints', op: 'gte', value: 20 }],
      product: { matchBy: 'model', model: 'RH-60', costType: 'equipment' },
      quantity: { mode: 'perInput', inputField: 'demandPoints', divisor: 20, min: 1 },
    },
    {
      id: 'r2',
      label: '配套水箱',
      when: [],
      product: { matchBy: 'model', model: 'TANK-500', costType: 'equipment' },
      quantity: { mode: 'fixed', value: 1 },
    },
  ],
  null,
  2,
);

export default function SelectorConfiguratorPage() {
  const [list, setList] = useState<RuleSet[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RuleSet | null>(null);
  const [fieldsText, setFieldsText] = useState('');
  const [rulesText, setRulesText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // 版本快照历史
  const [versions, setVersions] = useState<SelectorVersion[]>([]);

  // 试跑
  const [runInputs, setRunInputs] = useState('{\n  "demandPoints": 40\n}');
  const [runResult, setRunResult] = useState<{ system: { name: string; items: { model: string; quantity: number; unit?: string; listPrice: number; amount: number }[]; subtotal: number }; warnings: string[] } | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const r = await fetch('/api/pms/selectors?limit=200', { credentials: 'include', cache: 'no-store' });
      if (r.status === 403) return setStatus('forbidden');
      if (!r.ok) {
        setErr((await r.json().catch(() => ({})))?.error || '加载失败');
        return setStatus('error');
      }
      const d = await r.json();
      if (d.canManage === false) return setStatus('forbidden');
      setList(d.rulesets ?? []);
      setStatus('ok');
    } catch (e) {
      setErr((e as Error).message);
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEditor = useCallback((rs: RuleSet | null) => {
    setMsg('');
    setRunResult(null);
    setVersions([]);
    if (!rs) {
      setSelectedId(null);
      setDraft({ id: '', name: '', version: 1, status: 'draft', inputFields: [], rules: [], updatedAt: '' });
      setFieldsText(SAMPLE_INPUT_FIELDS);
      setRulesText(SAMPLE_RULES);
      return;
    }
    setSelectedId(rs.id);
    setDraft(rs);
    setFieldsText(JSON.stringify(rs.inputFields ?? [], null, 2));
    setRulesText(JSON.stringify(rs.rules ?? [], null, 2));
    fetch(`/api/pms/selectors/${rs.id}/versions`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((d) => setVersions(d.versions ?? []))
      .catch(() => setVersions([]));
  }, []);

  function parseJson<T>(text: string, label: string): T {
    try {
      const v = JSON.parse(text);
      if (!Array.isArray(v)) throw new Error(`${label} 必须是数组`);
      return v as T;
    } catch (e) {
      throw new Error(`${label} JSON 解析失败: ${(e as Error).message}`);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setMsg('');
    try {
      const inputFields = parseJson<unknown[]>(fieldsText, '输入字段');
      const rules = parseJson<unknown[]>(rulesText, '规则');
      const payload = {
        name: draft.name,
        category: draft.category,
        scenario: draft.scenario,
        description: draft.description,
        systemName: draft.systemName,
        inputFields,
        rules,
        ...(selectedId ? { expectedUpdatedAt: draft.updatedAt } : {}),
      };
      const url = selectedId ? `/api/pms/selectors/${selectedId}` : '/api/pms/selectors';
      const method = selectedId ? 'PATCH' : 'POST';
      const r = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '保存失败');
      setMsg('已保存');
      await load();
      openEditor(d.ruleset);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!selectedId) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch(`/api/pms/selectors/${selectedId}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedUpdatedAt: draft?.updatedAt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '发布失败');
      setMsg('已发布');
      await load();
      openEditor(d.ruleset);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!selectedId || !confirm('确认归档该规则集?')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/pms/selectors/${selectedId}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error((await r.json()).error || '删除失败');
      setDraft(null);
      setSelectedId(null);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function testRun() {
    if (!selectedId) { setMsg('请先保存规则集再试跑'); return; }
    setBusy(true);
    setMsg('');
    setRunResult(null);
    try {
      const inputs = JSON.parse(runInputs);
      const r = await fetch(`/api/pms/selectors/${selectedId}/run`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inputs }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || '试跑失败');
      setRunResult(d.result);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const patch = (p: Partial<RuleSet>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const editorTitle = useMemo(() => (selectedId ? `编辑: ${draft?.name || ''}` : '新建规则集'), [selectedId, draft]);

  if (status === 'loading') return <div className="p-8 text-ink-tertiary">加载中…</div>;
  if (status === 'forbidden') return <div className="p-8 text-ink-tertiary">选型配置器仅内部角色可维护。</div>;
  if (status === 'error') return <div className="p-8 text-danger">{err || '加载失败'}</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-headline font-semibold text-ink-primary">选型配置器</h1>
          <p className="mt-1 text-caption text-ink-tertiary">
            配置驱动 — 以数据维护工况问卷 + 选型规则, 无需改代码即可上线。业务员在报价编辑器&quot;智能选型&quot;填工况即得推荐。
          </p>
        </div>
        <button onClick={() => openEditor(null)} className="rounded-lg bg-ink-primary px-3 py-2 text-caption font-medium text-white hover:bg-ink-secondary">
          + 新建规则集
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* 列表 */}
        <div className="rounded-2xl border border-border bg-white">
          <div className="border-b border-border px-4 py-3 text-caption font-semibold text-ink-primary">规则集 ({list.length})</div>
          {list.length === 0 ? (
            <div className="px-4 py-8 text-center text-caption text-ink-tertiary">暂无规则集</div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {list.map((rs) => (
                <li
                  key={rs.id}
                  onClick={() => openEditor(rs)}
                  className={`cursor-pointer px-4 py-3 hover:bg-surface-2 ${selectedId === rs.id ? 'bg-surface-2' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-caption font-medium text-ink-primary">{rs.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-footnote ${rs.status === 'published' ? 'bg-success/10 text-success' : 'bg-surface-3 text-ink-tertiary'}`}>
                      {STATUS_LABEL[rs.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-footnote text-ink-tertiary">
                    {[rs.category, rs.scenario].filter(Boolean).join(' · ') || '未分类'} · v{rs.version} · {rs.rules.length} 规则
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 编辑器 */}
        {draft ? (
          <div className="rounded-2xl border border-border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-caption font-semibold text-ink-primary">{editorTitle}</h2>
              {msg && <span className="text-footnote text-ink-tertiary">{msg}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="名称"><input value={draft.name} onChange={(e) => patch({ name: e.target.value })} className="input" /></Field>
              <Field label="产出系统名"><input value={draft.systemName ?? ''} onChange={(e) => patch({ systemName: e.target.value })} className="input" placeholder="如 生活热水系统" /></Field>
              <Field label="品类"><input value={draft.category ?? ''} onChange={(e) => patch({ category: e.target.value })} className="input" /></Field>
              <Field label="场景"><input value={draft.scenario ?? ''} onChange={(e) => patch({ scenario: e.target.value })} className="input" /></Field>
            </div>
            <Field label="说明"><input value={draft.description ?? ''} onChange={(e) => patch({ description: e.target.value })} className="input" /></Field>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-footnote font-medium text-ink-tertiary">输入字段 (inputFields · JSON 数组)</label>
                <textarea value={fieldsText} onChange={(e) => setFieldsText(e.target.value)} rows={12} className="w-full rounded-lg border border-border p-2 font-mono text-footnote" spellCheck={false} />
              </div>
              <div>
                <label className="mb-1 block text-footnote font-medium text-ink-tertiary">选型规则 (rules · JSON 数组)</label>
                <textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} rows={12} className="w-full rounded-lg border border-border p-2 font-mono text-footnote" spellCheck={false} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button onClick={save} disabled={busy} className="rounded-lg bg-ink-primary px-3 py-2 text-caption font-medium text-white hover:bg-ink-secondary disabled:opacity-50">保存</button>
              {selectedId && <button onClick={publish} disabled={busy} className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-caption text-success hover:bg-success/15 disabled:opacity-50">发布</button>}
              {selectedId && <button onClick={remove} disabled={busy} className="rounded-lg border border-danger/40 bg-white px-3 py-2 text-caption text-danger hover:bg-danger/5 disabled:opacity-50">归档</button>}
            </div>

            {/* 试跑 */}
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-2 text-caption font-semibold text-ink-primary">试跑 (工况 → 推荐, 不落库)</h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div>
                  <label className="mb-1 block text-footnote font-medium text-ink-tertiary">工况 inputs (JSON)</label>
                  <textarea value={runInputs} onChange={(e) => setRunInputs(e.target.value)} rows={6} className="w-full rounded-lg border border-border p-2 font-mono text-footnote" spellCheck={false} />
                  <button onClick={testRun} disabled={busy} className="mt-2 rounded-lg border border-border bg-white px-3 py-2 text-caption text-ink-secondary hover:bg-surface-2 disabled:opacity-50">运行选型</button>
                </div>
                <div>
                  {runResult ? (
                    <div className="rounded-lg border border-border p-3">
                      <div className="mb-1 text-caption font-medium text-ink-primary">{runResult.system.name} · 小计 {money(runResult.system.subtotal)}</div>
                      <ul className="mb-2 divide-y divide-slate-50 text-footnote">
                        {runResult.system.items.map((it, i) => (
                          <li key={i} className="flex justify-between py-1">
                            <span className="text-ink-secondary">{it.model} × {it.quantity}{it.unit}</span>
                            <span className="tabular-nums text-ink-tertiary">{money(it.amount)}</span>
                          </li>
                        ))}
                        {runResult.system.items.length === 0 && <li className="py-2 text-ink-tertiary">无推荐行</li>}
                      </ul>
                      {runResult.warnings.length > 0 && (
                        <ul className="space-y-0.5 text-footnote text-warning">
                          {runResult.warnings.map((w, i) => <li key={i}>· {w}</li>)}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center text-footnote text-ink-tertiary">运行后展示推荐结果</div>
                  )}
                </div>
              </div>
            </div>

            {/* 发布版本历史 (溯源) */}
            {selectedId && (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="mb-2 text-caption font-semibold text-ink-primary">发布版本历史 ({versions.length})</h3>
                {versions.length === 0 ? (
                  <div className="text-footnote text-ink-tertiary">尚无已发布版本 — 发布后此处冻结每版规则快照供审计追溯。</div>
                ) : (
                  <ul className="divide-y divide-slate-50 rounded-lg border border-border">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between px-3 py-2 text-footnote">
                        <span className="font-medium text-ink-secondary">v{v.version}</span>
                        <span className="text-ink-tertiary">{v.rules.length} 规则 · {v.inputFields.length} 字段</span>
                        <span className="text-ink-tertiary">{v.publishedBy} · {new Date(v.publishedAt).toLocaleString('zh-CN')}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-border bg-white p-12 text-caption text-ink-tertiary">
            从左侧选择规则集, 或新建。
          </div>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.5rem;
          padding: 0.5rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <label className="mb-1 block text-footnote font-medium text-ink-tertiary">{label}</label>
      {children}
    </div>
  );
}
