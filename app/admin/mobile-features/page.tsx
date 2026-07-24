'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BotMessageSquare,
  CalendarDays,
  CheckCircle2,
  Home,
  Loader2,
  Mail,
  NotebookPen,
  Save,
  Smartphone,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type {
  MobileFeatureConfig,
  MobileFeatureKey,
  MobileFeatureMeta,
} from '@/lib/types/mobile-features';

const MAX_BOTTOM_NAV = 5;

const FEATURE_ICON: Record<MobileFeatureKey, React.ComponentType<{ className?: string }>> = {
  home_dashboard: Home,
  central_ai: BotMessageSquare,
  shouchao: NotebookPen,
  mail: Mail,
  calendar: CalendarDays,
  daily_report: Sparkles,
  naba: UserRound,
};

interface Payload {
  config: MobileFeatureConfig;
  features: MobileFeatureMeta[];
}

function toggleKey(list: MobileFeatureKey[], key: MobileFeatureKey): MobileFeatureKey[] {
  return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
}

export default function AdminMobileFeaturesPage() {
  const [features, setFeatures] = useState<MobileFeatureMeta[]>([]);
  const [config, setConfig] = useState<MobileFeatureConfig | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'saved' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/mobile-features', { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const data = (await res.json()) as Partial<Payload> & { error?: string };
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        return data as Payload;
      })
      .then((data) => {
        if (cancelled) return;
        setFeatures(data.features);
        setConfig(data.config);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enabledSet = useMemo(() => new Set(config?.enabledFeatures ?? []), [config?.enabledFeatures]);
  const bottomSet = useMemo(() => new Set(config?.bottomNav ?? []), [config?.bottomNav]);
  const cardSet = useMemo(() => new Set(config?.dashboardCards ?? []), [config?.dashboardCards]);

  function updateEnabled(key: MobileFeatureKey) {
    setConfig((prev) => {
      if (!prev) return prev;
      const enabledFeatures = toggleKey(prev.enabledFeatures, key);
      const nextEnabled = new Set(enabledFeatures);
      return {
        ...prev,
        enabledFeatures,
        bottomNav: prev.bottomNav.filter((item) => nextEnabled.has(item)),
        dashboardCards: prev.dashboardCards.filter((item) => nextEnabled.has(item)),
      };
    });
  }

  function updateBottomNav(key: MobileFeatureKey) {
    setConfig((prev) => {
      if (!prev || !prev.enabledFeatures.includes(key)) return prev;
      if (!prev.bottomNav.includes(key) && prev.bottomNav.length >= MAX_BOTTOM_NAV) return prev;
      return { ...prev, bottomNav: toggleKey(prev.bottomNav, key) };
    });
  }

  function updateDashboardCard(key: MobileFeatureKey) {
    setConfig((prev) => {
      if (!prev || !prev.enabledFeatures.includes(key)) return prev;
      return { ...prev, dashboardCards: toggleKey(prev.dashboardCards, key) };
    });
  }

  async function save() {
    if (!config) return;
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/admin/mobile-features', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabledFeatures: config.enabledFeatures,
          bottomNav: config.bottomNav,
          dashboardCards: config.dashboardCards,
        }),
      });
      const data = (await res.json()) as Partial<Payload> & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setConfig(data.config ?? config);
      setStatus('saved');
      window.setTimeout(() => setStatus('ready'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center text-caption text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载移动端功能配置…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6 md:px-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-footnote font-medium text-brand-600">
            <Smartphone className="h-4 w-4" />
            管理后台 / 移动端功能
          </div>
          <h1 className="text-title-3 font-bold text-ink-primary">移动端功能</h1>
          <p className="mt-1 max-w-2xl text-caption text-muted-foreground">
            控制 Android / iOS App 预留哪些入口。PC 端仍保持完整功能，移动端按这里的勾选展示首页看板、底部导航和全局中央 AI。
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!config || status === 'saving'}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-caption font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {status === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === 'saved' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {status === 'saving' ? '保存中…' : status === 'saved' ? '已保存' : '保存配置'}
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-caption text-danger">
          {error}
        </div>
      )}

      {config && (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <SummaryTile label="已启用功能" value={`${config.enabledFeatures.length}/${features.length}`} />
            <SummaryTile label="底部导航" value={`${config.bottomNav.length}/${MAX_BOTTOM_NAV}`} />
            <SummaryTile label="首页卡片" value={String(config.dashboardCards.length)} />
            <SummaryTile label="最近更新" value={formatDate(config.updatedAt)} compact />
          </section>

          <section className="rounded-lg border border-hairline bg-surface-1">
            <div className="grid grid-cols-[minmax(220px,1fr)_92px_108px_108px] gap-0 border-b border-hairline px-4 py-3 text-footnote font-medium text-muted-foreground">
              <span>功能</span>
              <span className="text-center">启用</span>
              <span className="text-center">底部导航</span>
              <span className="text-center">首页卡片</span>
            </div>
            <div className="divide-y divide-hairline">
              {features.map((feature) => {
                const Icon = FEATURE_ICON[feature.key];
                const enabled = enabledSet.has(feature.key);
                const bottom = bottomSet.has(feature.key);
                const card = cardSet.has(feature.key);
                const bottomDisabled =
                  !enabled ||
                  feature.key === 'central_ai' ||
                  (!bottom && config.bottomNav.length >= MAX_BOTTOM_NAV);
                const cardDisabled = !enabled || feature.key === 'home_dashboard';
                return (
                  <div
                    key={feature.key}
                    className="grid grid-cols-[minmax(220px,1fr)_92px_108px_108px] items-center gap-0 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-secondary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-ink-primary">{feature.label}</span>
                          {feature.route && (
                            <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                              {feature.route}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-footnote text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                    <SwitchCell
                      checked={enabled}
                      label={`启用 ${feature.label}`}
                      onChange={() => updateEnabled(feature.key)}
                    />
                    <SwitchCell
                      checked={bottom}
                      label={`${feature.label} 放入底部导航`}
                      disabled={bottomDisabled}
                      hint={feature.key === 'central_ai' ? '中央 AI 使用悬浮入口' : undefined}
                      onChange={() => updateBottomNav(feature.key)}
                    />
                    <SwitchCell
                      checked={card}
                      label={`${feature.label} 显示首页卡片`}
                      disabled={cardDisabled}
                      hint={feature.key === 'home_dashboard' ? '首页本身不作为卡片' : undefined}
                      onChange={() => updateDashboardCard(feature.key)}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <PreviewPanel
              title="App 底部导航"
              note="中央 AI 不占用 tab；底部最多 5 个入口。"
              items={config.bottomNav}
              features={features}
            />
            <PreviewPanel
              title="首页看板卡片"
              note="首页只显示已启用且被勾选的功能卡片。"
              items={config.dashboardCards}
              features={features}
            />
          </section>
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 px-4 py-3">
      <div className="text-footnote text-muted-foreground">{label}</div>
      <div className={compact ? 'mt-1 text-caption font-semibold text-ink-primary' : 'mt-1 text-title-3 font-bold text-ink-primary'}>
        {value}
      </div>
    </div>
  );
}

function SwitchCell({
  checked,
  label,
  disabled,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  hint?: string;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onChange}
        className={[
          'relative h-6 w-10 rounded-full transition-colors',
          checked ? 'bg-brand-600' : 'bg-surface-3',
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:ring-2 hover:ring-brand-500/20',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
      {hint && <span className="max-w-[88px] text-center text-[10px] leading-tight text-muted-foreground">{hint}</span>}
    </div>
  );
}

function PreviewPanel({
  title,
  note,
  items,
  features,
}: {
  title: string;
  note: string;
  items: MobileFeatureKey[];
  features: MobileFeatureMeta[];
}) {
  const byKey = new Map(features.map((feature) => [feature.key, feature]));
  return (
    <div className="rounded-lg border border-hairline bg-surface-1 p-4">
      <h2 className="text-caption font-semibold text-ink-primary">{title}</h2>
      <p className="mt-1 text-footnote text-muted-foreground">{note}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length === 0 ? (
          <span className="text-footnote text-muted-foreground">暂未选择</span>
        ) : (
          items.map((key) => {
            const feature = byKey.get(key);
            const Icon = FEATURE_ICON[key];
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-2 px-2.5 py-1.5 text-footnote font-medium text-ink-primary"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                {feature?.label ?? key}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

