'use client';

/**
 * /settings/llm
 *
 * 中央AI / 个人AI 模型切换设置页
 *  - 个人AI 标签: 任何登录用户可调
 *  - 中央AI 标签: 仅 admin/owner 可调; 其他用户只读
 *  - 中央AI 治理面板: 个人AI token 开关 / 月度配额 / provider 白名单
 */

import { useEffect, useState, useCallback } from 'react';

type Scope = 'user' | 'tenant';

const SCENARIOS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'reasoning_complex', label: '复杂推理', hint: '议事室 / 3+1 决策' },
  { id: 'tool_use', label: '工具调用', hint: 'Memory RAG / Function Calling' },
  { id: 'high_frequency', label: '高频任务', hint: 'Check-in 草稿 / 通知' },
  { id: 'long_context', label: '长上下文', hint: '复盘 / 历史回溯' },
  { id: 'persona_dialogue', label: 'Persona 对话', hint: 'IM 自动回复 / 沟通起草' },
  { id: 'agentic', label: 'Agent 任务', hint: '多步推理 + 工具' },
];

interface Preference {
  id: string;
  scope: Scope;
  byScenario: Record<string, string>;
  defaultProvider?: string;
  updatedBy: string;
  updatedAt: string;
}

interface TenantPolicy {
  allowPersonalAiTokens: boolean;
  monthlyTokenBudgetPerUser?: number;
  personalAiProviderWhitelist: string[];
  centralAiFlagshipProvider?: string;
}

export default function LlmSettingsPage() {
  const [tab, setTab] = useState<Scope>('user');
  const [pref, setPref] = useState<Preference | null>(null);
  const [policy, setPolicy] = useState<TenantPolicy | null>(null);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);
  const [policyErr, setPolicyErr] = useState<string | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [tenantDefault, setTenantDefault] = useState<Preference | null>(null);
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [defaultProvider, setDefaultProvider] = useState('');
  const [byScenario, setByScenario] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [prefRes, policyRes] = await Promise.all([
        fetch(`/api/settings/llm-preference?scope=${tab}`, { credentials: 'include' }),
        fetch('/api/settings/tenant-ai-policy', { credentials: 'include' }),
      ]);
      const j = await prefRes.json();
      if (!j.ok) throw new Error(j.error ?? '加载失败');
      setPref(j.preference);
      setTenantDefault(j.tenantDefault ?? null);
      setAvailable(j.availableProviders ?? []);
      setDefaultProvider(j.preference?.defaultProvider ?? '');
      setByScenario(j.preference?.byScenario ?? {});

      if (policyRes.ok) {
        const pj = await policyRes.json();
        if (pj.ok) setPolicy(pj.policy);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  async function savePolicy(patch: Partial<TenantPolicy>) {
    setSavingPolicy(true);
    setPolicyErr(null);
    setPolicyMsg(null);
    try {
      const r = await fetch('/api/settings/tenant-ai-policy', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? '保存失败');
      setPolicy(j.policy);
      setPolicyMsg('✓ 策略已保存');
      setTimeout(() => setPolicyMsg(null), 3000);
    } catch (e) {
      setPolicyErr((e as Error).message);
    } finally {
      setSavingPolicy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await fetch('/api/settings/llm-preference', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: tab,
          defaultProvider: defaultProvider || undefined,
          byScenario,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error ?? '保存失败');
      setMsg(`✓ 已保存 (${tab === 'tenant' ? '中央AI' : '个人AI'})`);
      setPref(j.preference);
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 md:px-8">
      <header className="mb-6">
        <h1 className="text-title-3 font-bold">大模型设置</h1>
        <p className="mt-1 text-caption text-ink-secondary">
          为不同场景选择不同的大模型。个人AI 覆盖中央AI，中央AI 覆盖系统默认。
        </p>
      </header>

      <nav className="mb-4 flex gap-2 border-b border">
        <button
          onClick={() => setTab('user')}
          className={`px-4 py-2 text-caption transition ${
            tab === 'user'
              ? 'border-b-2 border font-semibold text-ink-primary'
              : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          🧑 个人AI（仅影响你的 Persona）
        </button>
        <button
          onClick={() => setTab('tenant')}
          className={`px-4 py-2 text-caption transition ${
            tab === 'tenant'
              ? 'border-b-2 border font-semibold text-ink-primary'
              : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          🏢 中央AI（全租户默认 · 需管理员）
        </button>
      </nav>

      {loading && <div className="py-8 text-center text-caption text-ink-secondary">加载中…</div>}

      {!loading && (
        <div className="space-y-6">
          <div className="rounded-lg border border bg-white p-4 shadow-soft-sm">
            <h2 className="mb-2 font-semibold">已注册的 Provider</h2>
            <div className="flex flex-wrap gap-2">
              {available.length === 0 ? (
                <span className="text-caption text-rose-600">⚠️ 没有可用的 LLM provider，请先配置 API key</span>
              ) : (
                available.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-footnote font-medium text-emerald-700"
                  >
                    {p}
                  </span>
                ))
              )}
            </div>
          </div>

          {tab === 'user' && tenantDefault && (
            <div className="rounded-lg border border-info/30 bg-info/10 p-4 text-caption">
              <strong>中央AI 默认:</strong>{' '}
              {tenantDefault.defaultProvider ?? '(未设)'}{' '}
              {Object.keys(tenantDefault.byScenario ?? {}).length > 0 && (
                <span className="text-footnote text-ink-secondary">
                  · 已为 {Object.keys(tenantDefault.byScenario).length} 个场景定制
                </span>
              )}
            </div>
          )}

          <div className="rounded-lg border border bg-white p-4 shadow-soft-sm">
            <h2 className="mb-3 font-semibold">默认 Provider（兜底）</h2>
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="w-full rounded-md border border px-3 py-2 text-caption"
            >
              <option value="">（不设，使用路由器内置规则）</option>
              {available.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border bg-white p-4 shadow-soft-sm">
            <h2 className="mb-3 font-semibold">按场景指定（精细控制）</h2>
            <div className="space-y-3">
              {SCENARIOS.map((s) => (
                <div key={s.id} className="grid grid-cols-3 items-center gap-3">
                  <div>
                    <div className="text-caption font-medium">{s.label}</div>
                    <div className="text-footnote text-ink-secondary">{s.hint}</div>
                  </div>
                  <select
                    value={byScenario[s.id] ?? ''}
                    onChange={(e) =>
                      setByScenario((prev) => {
                        const next = { ...prev };
                        if (e.target.value) next[s.id] = e.target.value;
                        else delete next[s.id];
                        return next;
                      })
                    }
                    className="col-span-2 rounded-md border border px-3 py-1.5 text-caption"
                  >
                    <option value="">（继承默认）</option>
                    {available.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-surface-3 px-4 py-2 text-caption font-medium text-white hover:bg-surface-3 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存'}
            </button>
            {msg && <span className="text-caption text-emerald-600">{msg}</span>}
            {err && <span className="text-caption text-rose-600">⚠️ {err}</span>}
          </div>

          {pref && (
            <div className="text-footnote text-ink-tertiary">
              上次更新: {new Date(pref.updatedAt).toLocaleString()} · by {pref.updatedBy}
            </div>
          )}

          {/* ── 中央AI 治理面板 (仅 tenant tab 展示) ── */}
          {tab === 'tenant' && policy && (
            <div className="mt-6 rounded-lg border border-warning/20 bg-warning/5 p-4 shadow-soft-sm space-y-4">
              <h2 className="font-semibold text-warning">🏛️ 企业 AI 治理策略</h2>
              <p className="text-footnote text-warning">控制员工个人AI 是否可以消耗中央AI (公司) 的 token 配额。</p>

              {/* 旗舰模型展示 */}
              <div className="flex items-center gap-3 rounded-md border border-warning/30 bg-white px-4 py-3">
                <span className="text-headline">🏆</span>
                <div>
                  <div className="text-caption font-semibold">中央AI 旗舰模型</div>
                  <div className="text-footnote text-ink-secondary">{policy.centralAiFlagshipProvider ?? '(未配置)'} · 企业关键决策场景专用</div>
                </div>
              </div>

              {/* 个人AI token 开关 */}
              <div className="flex items-center justify-between rounded-md border border bg-white px-4 py-3">
                <div>
                  <div className="text-caption font-medium">允许员工个人AI 使用中央AI token</div>
                  <div className="text-footnote text-ink-secondary">关闭后员工个人AI 只能用自己配置的 API key</div>
                </div>
                <button
                  onClick={() => void savePolicy({ allowPersonalAiTokens: !policy.allowPersonalAiTokens })}
                  disabled={savingPolicy}
                  title={policy.allowPersonalAiTokens ? '点击关闭个人AI token' : '点击开启个人AI token'}
                  aria-label={policy.allowPersonalAiTokens ? '关闭个人AI token 共享' : '开启个人AI token 共享'}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    policy.allowPersonalAiTokens ? 'bg-emerald-500' : 'bg-surface-2'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    policy.allowPersonalAiTokens ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* 月度 token 配额 */}
              {policy.allowPersonalAiTokens && (
                <div className="rounded-md border border bg-white px-4 py-3 space-y-2">
                  <div className="text-caption font-medium">每用户月度 Token 配额</div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      defaultValue={policy.monthlyTokenBudgetPerUser ?? 500000}
                      onBlur={(e) => void savePolicy({ monthlyTokenBudgetPerUser: Number(e.target.value) })}
                      className="w-40 rounded-md border border px-3 py-1.5 text-caption"
                    />
                    <span className="text-footnote text-ink-secondary">tokens / 人 / 月 &nbsp;(0 = 不限额)</span>
                  </div>
                </div>
              )}

              {/* Provider 白名单 */}
              <div className="rounded-md border border bg-white px-4 py-3 space-y-2">
                <div className="text-caption font-medium">个人AI Provider 白名单</div>
                <div className="text-footnote text-ink-secondary">勾选后员工只能选这些 provider；不选 = 不限制</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {available.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-caption cursor-pointer">
                      <input
                        type="checkbox"
                        checked={policy.personalAiProviderWhitelist.includes(p)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...policy.personalAiProviderWhitelist, p]
                            : policy.personalAiProviderWhitelist.filter((x) => x !== p);
                          void savePolicy({ personalAiProviderWhitelist: next });
                        }}
                      />
                      <span className="rounded-full bg-surface-1 px-2 py-0.5 text-footnote">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              {policyMsg && <p className="text-caption text-emerald-600">{policyMsg}</p>}
              {policyErr && <p className="text-caption text-rose-600">⚠️ {policyErr}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
