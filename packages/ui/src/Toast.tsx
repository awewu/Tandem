'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string; }
interface ToastApi { toast: (message: string, kind?: ToastKind) => void; }

const ToastCtx = createContext<ToastApi | null>(null);

const KIND_COLOR: Record<ToastKind, string> = {
  success: 'var(--success, #16A34A)',
  error: 'var(--error, #DC2626)',
  info: 'var(--info, #2563EB)',
};

/**
 * 反馈 toast（DESIGN.md §10）。在 app 根 layout 包一层 <ToastProvider>，
 * 组件内 const { toast } = useToast(); toast('已保存','success')。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              minWidth: 220, maxWidth: 360, padding: '10px 14px', borderRadius: 8,
              background: 'var(--surface, #FFFFFF)', color: 'var(--t-strong, #111827)',
              border: '1px solid var(--ink-5, #D1D5DB)', borderLeft: `3px solid ${KIND_COLOR[t.kind]}`,
              boxShadow: '0 12px 16px -4px rgba(16,24,40,0.08), 0 4px 6px -2px rgba(16,24,40,0.03)',
              fontSize: 13, lineHeight: 1.5,
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) return { toast: () => { /* no-op outside provider */ } };
  return ctx;
}
