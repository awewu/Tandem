'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { isCapacitor } from '@/lib/capacitor/client';

const PREVIEW_CLASSES = [
  'is-mobile-preview',
  'is-capacitor',
  'capacitor-overlay-statusbar',
  'keyboard-open',
  'im-chat-open',
] as const;

const CSS_VARIABLES = [
  '--capacitor-status-bar-height',
  '--capacitor-effective-top-inset',
  '--capacitor-safe-area-bottom',
  '--visual-keyboard-inset',
  '--visual-viewport-height',
] as const;

type PreviewClass = (typeof PREVIEW_CLASSES)[number];
type CssVariable = (typeof CSS_VARIABLES)[number];

type ViewportSnapshot = {
  innerWidth: number;
  innerHeight: number;
  visualHeight: number | null;
  visualOffsetTop: number | null;
  className: string;
  variables: Record<CssVariable, string>;
};

const EMPTY_SNAPSHOT: ViewportSnapshot = {
  innerWidth: 0,
  innerHeight: 0,
  visualHeight: null,
  visualOffsetTop: null,
  className: '',
  variables: {
    '--capacitor-status-bar-height': '',
    '--capacitor-effective-top-inset': '',
    '--capacitor-safe-area-bottom': '',
    '--visual-keyboard-inset': '',
    '--visual-viewport-height': '',
  },
};

function currentRouteOwnsImClass() {
  const url = new URL(window.location.href);
  return url.pathname === '/im' && Boolean(url.searchParams.get('ch'));
}

function currentRuntimeOwnsKeyboardClass() {
  const active = document.activeElement as HTMLElement | null;
  const editable = Boolean(
    active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable),
  );
  const viewportReduced = Boolean(
    window.visualViewport && window.visualViewport.height < window.innerHeight - 120,
  );
  return editable && viewportReduced;
}

function PresetControl({
  label,
  values,
  value,
  onChange,
}: {
  label: string;
  values: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium text-ink-secondary">{label}</div>
      <div className="flex gap-1" role="group" aria-label={label}>
        {values.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`h-7 min-w-0 flex-1 rounded border px-1 text-[10px] tabular-nums transition ${
              value === preset
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-ink-secondary hover:bg-muted'
            }`}
          >
            {preset}px
          </button>
        ))}
      </div>
    </div>
  );
}

function DebugPanelInner() {
  const searchParams = useSearchParams();
  const enabled = searchParams?.get('mobilePreview') === '1';
  const [collapsed, setCollapsed] = useState(false);
  const [simulateCapacitor, setSimulateCapacitor] = useState(false);
  const [simulateKeyboard, setSimulateKeyboard] = useState(false);
  const [simulateImChat, setSimulateImChat] = useState(false);
  const [statusBarHeight, setStatusBarHeight] = useState(0);
  const [safeAreaBottom, setSafeAreaBottom] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(320);
  const [snapshot, setSnapshot] = useState<ViewportSnapshot>(EMPTY_SNAPSHOT);
  const ownedClasses = useRef(new Set<PreviewClass>());
  const originalVariables = useRef(new Map<CssVariable, string>());
  const lastWrittenVariables = useRef(new Map<CssVariable, string>());

  function setOwnedClass(className: PreviewClass, active: boolean) {
    const root = document.documentElement;
    if (active) {
      if (!root.classList.contains(className)) {
        root.classList.add(className);
        ownedClasses.current.add(className);
      }
      return;
    }
    if (ownedClasses.current.delete(className)) root.classList.remove(className);
  }

  function setPreviewVariable(name: CssVariable, value: string) {
    const root = document.documentElement;
    if (!originalVariables.current.has(name)) {
      originalVariables.current.set(name, root.style.getPropertyValue(name));
    }
    root.style.setProperty(name, value);
    lastWrittenVariables.current.set(name, value);
  }

  function restorePreviewVariables() {
    const root = document.documentElement;
    for (const [name, originalValue] of Array.from(originalVariables.current)) {
      if (root.style.getPropertyValue(name).trim() !== lastWrittenVariables.current.get(name)) continue;
      if (originalValue) root.style.setProperty(name, originalValue);
      else root.style.removeProperty(name);
    }
    originalVariables.current.clear();
    lastWrittenVariables.current.clear();
  }

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    const classesOwnedByPreview = ownedClasses.current;
    setOwnedClass('is-mobile-preview', true);
    setSimulateCapacitor(root.classList.contains('is-capacitor'));
    setSimulateKeyboard(root.classList.contains('keyboard-open'));
    setSimulateImChat(root.classList.contains('im-chat-open'));

    return () => {
      const nativeRuntime = isCapacitor();
      for (const className of Array.from(classesOwnedByPreview)) {
        const runtimeOwnsClass =
          ((className === 'is-capacitor' || className === 'capacitor-overlay-statusbar') && nativeRuntime) ||
          (className === 'keyboard-open' && currentRuntimeOwnsKeyboardClass()) ||
          (className === 'im-chat-open' && currentRouteOwnsImClass());
        if (!runtimeOwnsClass) root.classList.remove(className);
      }
      classesOwnedByPreview.clear();
      delete root.dataset.mobilePreviewKeyboard;
      restorePreviewVariables();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setOwnedClass('is-capacitor', simulateCapacitor);
    setOwnedClass('capacitor-overlay-statusbar', simulateCapacitor);
  }, [enabled, simulateCapacitor]);

  useEffect(() => {
    if (!enabled) return;
    setOwnedClass('im-chat-open', simulateImChat);
  }, [enabled, simulateImChat]);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.dataset.mobilePreviewKeyboard = simulateKeyboard ? 'true' : 'false';
    setOwnedClass('keyboard-open', simulateKeyboard);
    const inset = simulateKeyboard ? keyboardHeight : 0;
    setPreviewVariable('--visual-keyboard-inset', `${inset}px`);
    setPreviewVariable(
      '--visual-viewport-height',
      `${Math.max(0, window.innerHeight - inset)}px`,
    );
  }, [enabled, keyboardHeight, simulateKeyboard]);

  useEffect(() => {
    if (!enabled) return;
    setPreviewVariable('--capacitor-status-bar-height', `${statusBarHeight}px`);
  }, [enabled, statusBarHeight]);

  useEffect(() => {
    if (!enabled) return;
    setPreviewVariable('--capacitor-safe-area-bottom', `${safeAreaBottom}px`);
  }, [enabled, safeAreaBottom]);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;

    function refreshSnapshot() {
      const computed = getComputedStyle(root);
      setSnapshot({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        visualHeight: window.visualViewport?.height ?? null,
        visualOffsetTop: window.visualViewport?.offsetTop ?? null,
        className: root.className,
        variables: Object.fromEntries(
          CSS_VARIABLES.map((name) => [name, computed.getPropertyValue(name).trim() || '(unset)']),
        ) as Record<CssVariable, string>,
      });
    }

    const observer = new MutationObserver(refreshSnapshot);
    observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', refreshSnapshot);
    window.visualViewport?.addEventListener('resize', refreshSnapshot);
    window.visualViewport?.addEventListener('scroll', refreshSnapshot);
    refreshSnapshot();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refreshSnapshot);
      window.visualViewport?.removeEventListener('resize', refreshSnapshot);
      window.visualViewport?.removeEventListener('scroll', refreshSnapshot);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside
      data-mobile-preview-debug-panel
      className="fixed bottom-3 right-3 z-[100] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-2xl"
      aria-label="移动端预览调试"
    >
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <Bug className="h-4 w-4 text-primary" />
        <span className="text-footnote font-semibold">移动端预览</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-ink-secondary">DEV</span>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded hover:bg-muted"
          aria-label={collapsed ? '展开调试面板' : '折叠调试面板'}
          title={collapsed ? '展开' : '折叠'}
        >
          {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="max-h-[min(78dvh,680px)] space-y-3 overflow-y-auto p-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-footnote">
              <span>普通移动 H5</span>
              <span className="rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">已启用</span>
            </div>
            <label className="flex items-center justify-between gap-3 text-footnote">
              <span>Capacitor App</span>
              <Switch checked={simulateCapacitor} onCheckedChange={setSimulateCapacitor} />
            </label>
            <label className="flex items-center justify-between gap-3 text-footnote">
              <span>键盘打开</span>
              <Switch checked={simulateKeyboard} onCheckedChange={setSimulateKeyboard} />
            </label>
            <label className="flex items-center justify-between gap-3 text-footnote">
              <span>IM 聊天打开</span>
              <Switch checked={simulateImChat} onCheckedChange={setSimulateImChat} />
            </label>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <PresetControl label="状态栏高度" values={[0, 24, 34]} value={statusBarHeight} onChange={setStatusBarHeight} />
            <PresetControl label="底部安全区" values={[0, 16, 24, 34]} value={safeAreaBottom} onChange={setSafeAreaBottom} />
            <PresetControl label="键盘高度" values={[0, 280, 320, 360]} value={keyboardHeight} onChange={setKeyboardHeight} />
          </div>

          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-border pt-3 font-mono text-[10px] leading-4">
            <dt className="text-ink-tertiary">innerWidth</dt><dd>{snapshot.innerWidth}px</dd>
            <dt className="text-ink-tertiary">innerHeight</dt><dd>{snapshot.innerHeight}px</dd>
            <dt className="text-ink-tertiary">visualViewport.height</dt><dd>{snapshot.visualHeight == null ? 'n/a' : `${Math.round(snapshot.visualHeight)}px`}</dd>
            <dt className="text-ink-tertiary">visualViewport.offsetTop</dt><dd>{snapshot.visualOffsetTop == null ? 'n/a' : `${Math.round(snapshot.visualOffsetTop)}px`}</dd>
          </dl>

          <div className="space-y-1 border-t border-border pt-3 font-mono text-[10px] leading-4">
            {CSS_VARIABLES.map((name) => (
              <div key={name} className="flex min-w-0 justify-between gap-2">
                <span className="truncate text-ink-tertiary">{name}</span>
                <span className="shrink-0">{snapshot.variables[name]}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-3">
            <div className="mb-1 text-[10px] font-medium text-ink-tertiary">documentElement.className</div>
            <code className="block max-h-16 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-[10px] leading-4">
              {snapshot.className || '(empty)'}
            </code>
          </div>
        </div>
      )}
    </aside>
  );
}

export function MobilePreviewDebugPanel() {
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <Suspense fallback={null}>
      <DebugPanelInner />
    </Suspense>
  );
}
