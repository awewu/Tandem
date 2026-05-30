'use client';

/**
 * RightPane — slide-in details/inspector panel anchored to the right edge.
 *
 * Usage:
 *   1. Wrap the app (already done in app/layout.tsx) with <RightPaneProvider>
 *   2. From any component:
 *      const { open, close } = useRightPane();
 *      open({
 *        title: '决议详情',
 *        subtitle: '议事室 #abc',
 *        content: <DecisionCardDetail id={id} />,
 *      });
 *
 * Visual: 360-380px wide slide-in from right, acrylic surface, ESC to close,
 * backdrop click to close. Mounts <RightPane /> outlet inside the provider.
 *
 * Pairs with AppRail + SubSidebar + PageTabs as the rightmost level of the shell.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDynamicStyle } from '@/lib/hooks/use-dynamic-style';

export interface RightPanePayload {
  title: string;
  subtitle?: string;
  content: React.ReactNode;
  /** Optional footer (action buttons row) */
  footer?: React.ReactNode;
  /** Width override (default 380px) */
  width?: number;
  /** Called after the pane fully closes (cleanup hook) */
  onClose?: () => void;
}

interface RightPaneContextValue {
  payload: RightPanePayload | null;
  open: (p: RightPanePayload) => void;
  close: () => void;
  /** True when content is rendered (during enter/exit transitions) */
  isOpen: boolean;
}

const RightPaneContext = createContext<RightPaneContextValue | null>(null);

export function useRightPane() {
  const ctx = useContext(RightPaneContext);
  if (!ctx) {
    throw new Error('useRightPane must be used inside <RightPaneProvider>');
  }
  return ctx;
}

export function RightPaneProvider({ children }: { children: React.ReactNode }) {
  const [payload, setPayload] = useState<RightPanePayload | null>(null);
  const [visible, setVisible] = useState(false);

  const open = useCallback((p: RightPanePayload) => {
    setPayload(p);
    // Defer to next frame so the entering transition can run.
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    // Match transition duration.
    window.setTimeout(() => {
      setPayload((p) => {
        p?.onClose?.();
        return null;
      });
    }, 220);
  }, []);

  // ESC to close
  useEffect(() => {
    if (!visible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, close]);

  const value = useMemo(
    () => ({ payload, open, close, isOpen: payload != null }),
    [payload, open, close],
  );

  return (
    <RightPaneContext.Provider value={value}>
      {children}
      <RightPaneOutlet payload={payload} visible={visible} onClose={close} />
    </RightPaneContext.Provider>
  );
}

function RightPaneOutlet({
  payload,
  visible,
  onClose,
}: {
  payload: RightPanePayload | null;
  visible: boolean;
  onClose: () => void;
}) {
  const widthValue = `${payload?.width ?? 380}px`;
  const paneRef = useDynamicStyle<HTMLElement>({ width: widthValue });
  if (!payload) return null;

  return (
    <>
      {/* Backdrop (subtle, click-to-close) */}
      <button
        type="button"
        aria-label="关闭面板"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-[rgb(var(--rheem-ink-black)/0.18)] transition-opacity',
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* Pane */}
      <aside
        ref={paneRef}
        role="dialog"
        aria-modal="false"
        aria-label={payload.title}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-screen flex-col border-l border-border bg-[rgb(var(--surface-1))] shadow-soft-lg',
          'transition-transform ease-[cubic-bezier(0.32,0.72,0,1)]',
          visible ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-callout font-semibold text-ink-primary truncate">
              {payload.title}
            </h3>
            {payload.subtitle && (
              <p className="text-footnote text-ink-tertiary truncate">
                {payload.subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="rounded-md p-1 text-ink-secondary hover:bg-surface-3 hover:text-ink-primary surface-interactive"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">{payload.content}</div>

        {/* Footer */}
        {payload.footer && (
          <footer className="border-t border-border bg-[rgb(var(--surface-2))] p-3 shrink-0">
            {payload.footer}
          </footer>
        )}
      </aside>
    </>
  );
}
