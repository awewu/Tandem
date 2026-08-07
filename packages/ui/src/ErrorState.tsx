interface ErrorStateProps {
  message?: string;
  /** 重试回调（DESIGN.md §9：error 必须可重试） */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * 错误状态（DESIGN.md §9）。行内提示 + 重试，禁顶部一句笼统报错、禁白屏。
 */
export default function ErrorState({ message = '加载失败，请重试', onRetry, retryLabel = '重试' }: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '40px 24px', gap: 12,
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--error, #DC2626)', lineHeight: 1.5, maxWidth: 360 }}>{message}</div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 8,
            border: '1px solid var(--ink-5, #D1D5DB)', background: 'var(--surface, #FFFFFF)',
            color: 'var(--t-strong, #111827)', cursor: 'pointer', minHeight: 40,
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
