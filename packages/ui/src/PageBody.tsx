import { ReactNode } from 'react';

interface PageBodyProps {
  children: ReactNode;
  /** 覆盖默认最大宽度 1280px */
  maxWidth?: number | string;
}

/**
 * 统一内容区容器 — 替代各页面散写的 page-container / padding 内联 style。
 * 提供标准的 padding + max-width + 水平居中。
 */
export default function PageBody({ children, maxWidth = 1280 }: PageBodyProps) {
  return (
    <div style={{
      padding: 'var(--s8, 28px) var(--s10, 36px)',
      maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
    }}>
      {children}
    </div>
  );
}
