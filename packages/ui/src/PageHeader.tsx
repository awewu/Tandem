import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** 右侧操作区（按钮/下拉等） */
  actions?: ReactNode;
}

/**
 * 统一页面标题区 — 所有内容页顶部使用。
 * 已包含下方的分隔线；不含 page-container 的 padding（由 PageBody 或外层提供）。
 */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={{
      display: 'flex', alignItems: actions ? 'flex-start' : 'center',
      justifyContent: 'space-between', gap: 16,
      marginBottom: 24,
      paddingBottom: 20,
      borderBottom: '1px solid var(--border)',
    }}>
      <div>
        <h1 style={{
          fontSize: 22, fontWeight: 700, color: 'var(--t-strong)',
          letterSpacing: '-0.005em', lineHeight: 1.25, margin: 0,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ marginTop: 4, fontSize: 13, color: 'var(--t-secondary)', lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
