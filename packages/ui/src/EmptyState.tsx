import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  /** 次级 CTA（DESIGN.md §9：空态给次级按钮，引导下一步） */
  action?: ReactNode;
  icon?: ReactNode;
}

/**
 * 空状态（DESIGN.md §9）。简洁文案 + 可选次级 CTA，禁纯空白。
 */
export default function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '48px 24px', gap: 8,
      }}
    >
      {icon && <div style={{ color: 'var(--ink-4, #9CA3AF)', marginBottom: 4 }}>{icon}</div>}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-strong, #111827)' }}>{title}</div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--t-secondary, #6B7280)', maxWidth: 360, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}
