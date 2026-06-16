'use client';

/**
 * AiPreferenceCard · 个人 AI 偏好设置
 *
 * 让员工在分身页直接选自己想用的 LLM provider，
 * 调用 PUT /api/settings/llm-preference scope='user'.
 */

import { useEffect, useState } from 'react';
import { Sparkles, ChevronDown, CheckCircle2, Loader2, Info } from 'lucide-react';

interface Preference {
  defaultProvider?: string;
  byScenario?: Record<string, string>;
}

export function AiPreferenceCard() {
  const [available, setAvailable] = useState<string[]>([]);
  const [pref, setPref] = useState<Preference>({});
  const [tenantDefault, setTenantDefault] = useState<Preference | null>(null);
  const [selected, setSelected] = useState('');
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'saved' | 'error'>('loading');

  useEffect(() => {
    fetch('/api/settings/llm-preference?scope=user', { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setAvailable(d.availableProviders ?? []);
        setPref(d.preference ?? {});
        setTenantDefault(d.tenantDefault ?? null);
        setSelected(d.preference?.defaultProvider ?? '');
        setStatus('idle');
      })
      .catch(() => setStatus('error'));
  }, []);

  async function save() {
    setStatus('saving');
    try {
      const res = await fetch('/api/settings/llm-preference', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'user', defaultProvider: selected || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const d = await res.json();
      setPref(d.preference ?? {});
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }

  const effective = selected || tenantDefault?.defaultProvider || '（路由器自动选择）';
  const changed = selected !== (pref.defaultProvider ?? '');

  if (status === 'loading') return null;

  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand-500" />
        <h3 className="text-caption font-semibold text-ink-primary">我的 AI 偏好</h3>
        <span className="ml-auto text-footnote text-ink-tertiary">个人AI 模型</span>
      </div>

      {available.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-footnote text-ink-secondary">
          <Info className="h-3.5 w-3.5 shrink-0" />
          暂无可用 Provider，请管理员在 AI 配置页配置至少一个 API Key。
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={status === 'saving'}
                className="w-full appearance-none rounded-lg border border-hairline bg-surface-1 px-3 py-2 pr-8 text-caption text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
              >
                <option value="">跟随企业默认</option>
                {available.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-tertiary" />
            </div>
            <button
              onClick={save}
              disabled={!changed || status === 'saving'}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-caption font-medium text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              {status === 'saving' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : status === 'saved' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : null}
              {status === 'saved' ? '已保存' : '保存'}
            </button>
          </div>
          <p className="text-footnote text-ink-tertiary">
            当前生效：<span className="font-medium text-ink-secondary">{effective}</span>
          </p>
        </>
      )}
    </div>
  );
}
