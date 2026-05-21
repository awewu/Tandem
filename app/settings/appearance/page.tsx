'use client';

/**
 * /settings/appearance — 外观与品牌
 *
 * - Logo 上传 / 切换 (variant × theme 矩阵)
 * - 主题: light / dark / system
 * - 预览面板: 实时显示选定 logo 在 charcoal / white 背景的渲染
 *
 * Logo 文件管理: 列出 public/brand/ 下已有的 SVG/PNG, 提供 BrandLogo 预览.
 * 用户上传新 logo 由后端 /api/brand/upload 处理 (此页只读 + 切换);
 * 当前 V1 提示用户手动放文件到 public/brand/ (后续接 MinIO 后改为 web 上传).
 */

import { useEffect, useState } from 'react';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Image as ImageIcon,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { BrandLogo, type LogoVariant, type LogoTheme } from '@/components/brand-logo';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'tandem.theme';

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const effective =
    t === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : t;
  root.classList.toggle('dark', effective === 'dark');
}

interface ProbeResult {
  path: string;
  exists: boolean;
}

const KNOWN_LOGO_PATHS: string[] = [
  '/brand/mark-light.svg',
  '/brand/mark-light.png',
  '/brand/mark-dark.svg',
  '/brand/mark-dark.png',
  '/brand/mark-brand.svg',
  '/brand/mark-brand.png',
  '/brand/wordmark-light.svg',
  '/brand/wordmark-light.png',
  '/brand/wordmark-dark.svg',
  '/brand/wordmark-dark.png',
  '/brand/wordmark-brand.svg',
  '/brand/lockup-light.svg',
  '/brand/lockup-dark.svg',
  '/brand/logo.svg',
  '/brand/logo.png',
];

export default function AppearancePage() {
  const [theme, setTheme] = useState<Theme>('system');
  const [variant, setVariant] = useState<LogoVariant>('mark');
  const [logoTheme, setLogoTheme] = useState<LogoTheme>('auto');
  const [probes, setProbes] = useState<ProbeResult[]>([]);

  useEffect(() => {
    try {
      const v = (window.localStorage.getItem(THEME_KEY) as Theme | null) ?? 'system';
      setTheme(v);
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      KNOWN_LOGO_PATHS.map(async (path) => {
        try {
          const r = await fetch(path, { method: 'HEAD' });
          return { path, exists: r.ok };
        } catch {
          return { path, exists: false };
        }
      }),
    ).then((results) => {
      if (!cancelled) setProbes(results);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function pickTheme(t: Theme) {
    setTheme(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* no-op */
    }
    applyTheme(t);
  }

  const present = probes.filter((p) => p.exists);
  const missing = probes.filter((p) => !p.exists);

  return (
    <div className="h-full overflow-auto">
      <div className="page-container py-10 max-w-4xl space-y-10">
        <header>
          <h1 className="text-title-1 text-ink-primary">外观与品牌</h1>
          <p className="mt-2 text-body text-ink-secondary">
            主题切换 · Logo 资产 · 预览
          </p>
        </header>

        {/* Theme picker */}
        <section className="space-y-4">
          <div>
            <h2 className="text-headline text-ink-primary inline-flex items-center gap-2">
              <Palette className="h-4 w-4" /> 主题
            </h2>
            <p className="mt-1 text-caption text-ink-tertiary">
              选择 light / dark 或跟随系统
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {(
              [
                { id: 'light', label: '亮色', icon: Sun },
                { id: 'system', label: '随系统', icon: Monitor },
                { id: 'dark', label: '暗色', icon: Moon },
              ] as Array<{ id: Theme; label: string; icon: typeof Sun }>
            ).map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => pickTheme(opt.id)}
                  aria-pressed={active ? 'true' : 'false'}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-4 transition-all',
                    active
                      ? 'border-[rgb(var(--brand-500))] bg-[rgb(var(--brand-50))] text-[rgb(var(--brand-700))]'
                      : 'border-border text-ink-secondary hover:bg-surface-2',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-caption font-medium">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Logo variant picker + preview */}
        <section className="space-y-4">
          <div>
            <h2 className="text-headline text-ink-primary inline-flex items-center gap-2">
              <ImageIcon className="h-4 w-4" /> Logo 显示
            </h2>
            <p className="mt-1 text-caption text-ink-tertiary">
              选择不同 variant × theme 组合，下方实时预览
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            <label className="block">
              <span className="text-footnote text-ink-tertiary mb-1.5 block">
                Variant
              </span>
              <select
                value={variant}
                onChange={(e) => setVariant(e.target.value as LogoVariant)}
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-500))]/40"
              >
                <option value="mark">mark (方形 icon)</option>
                <option value="wordmark">wordmark (横向字标)</option>
                <option value="lockup">lockup (图+字)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-footnote text-ink-tertiary mb-1.5 block">
                Theme
              </span>
              <select
                value={logoTheme}
                onChange={(e) => setLogoTheme(e.target.value as LogoTheme)}
                className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-caption focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-500))]/40"
              >
                <option value="auto">auto (跟随主题)</option>
                <option value="light">light</option>
                <option value="dark">dark</option>
                <option value="brand">brand (单红色)</option>
              </select>
            </label>
          </div>

          {/* Preview cards */}
          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="rounded-lg border border-border p-6 bg-white">
              <p className="text-footnote text-slate-500 mb-3">亮底预览</p>
              <div className="flex items-center justify-center min-h-[120px]">
                <BrandLogo variant={variant} theme={logoTheme} size={variant === 'mark' ? 64 : 36} />
              </div>
            </div>
            <div className="rounded-lg border border-border p-6 bg-[rgb(var(--rheem-charcoal))]">
              <p className="text-footnote text-white/60 mb-3">暗底预览 (charcoal)</p>
              <div className="flex items-center justify-center min-h-[120px]">
                <BrandLogo variant={variant} theme={logoTheme} size={variant === 'mark' ? 64 : 36} />
              </div>
            </div>
          </div>
        </section>

        {/* Asset inventory */}
        <section className="space-y-4">
          <div>
            <h2 className="text-headline text-ink-primary">Logo 资产清单</h2>
            <p className="mt-1 text-caption text-ink-tertiary">
              扫描 <code className="font-mono text-[12px] bg-surface-2 px-1 rounded">public/brand/</code> 下已存在的文件
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-1 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              <div>
                <div className="px-4 py-2 border-b border-border bg-surface-2/40">
                  <p className="text-caption font-semibold text-success inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    已就位 ({present.length})
                  </p>
                </div>
                <ul className="p-3 space-y-1 max-h-64 overflow-auto">
                  {present.length === 0 ? (
                    <li className="text-caption text-ink-tertiary px-2 py-1">
                      未检测到任何已知 logo 文件
                    </li>
                  ) : (
                    present.map((p) => (
                      <li
                        key={p.path}
                        className="text-caption font-mono text-ink-primary px-2 py-1 rounded hover:bg-surface-2"
                      >
                        {p.path}
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <div className="px-4 py-2 border-b border-border bg-surface-2/40">
                  <p className="text-caption font-semibold text-ink-tertiary inline-flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    可补充槽位 ({missing.length})
                  </p>
                </div>
                <ul className="p-3 space-y-1 max-h-64 overflow-auto">
                  {missing.map((p) => (
                    <li
                      key={p.path}
                      className="text-caption font-mono text-ink-tertiary px-2 py-1 rounded hover:bg-surface-2"
                    >
                      {p.path}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[rgb(var(--brand-200))] bg-[rgb(var(--brand-50))] p-4">
            <p className="text-caption text-[rgb(var(--brand-800))] font-medium inline-flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" /> 当前部署模式: 手动放置
            </p>
            <p className="mt-2 text-caption text-ink-secondary leading-relaxed">
              把 SVG/PNG 文件按命名约定放入{' '}
              <code className="font-mono text-[12px] bg-white px-1 rounded">
                public/brand/
              </code>{' '}
              即可生效 (无需重启)。命名规则:{' '}
              <code className="font-mono text-[12px] bg-white px-1 rounded">
                {`{variant}-{theme}.{svg,png}`}
              </code>
              ；缺失时按候选链回退到{' '}
              <code className="font-mono text-[12px] bg-white px-1 rounded">
                logo.svg
              </code>{' '}
              再到内置占位块。后续 M3 接入 MinIO 后将提供 web 上传。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
