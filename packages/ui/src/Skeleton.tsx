import { CSSProperties } from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: CSSProperties;
}

/**
 * 骨架屏基元（DESIGN.md §9/§16）。异步区 loading 态用它，禁白屏/无限 spinner。
 * 多块组合：<SkeletonText lines={3} /> 或直接堆叠多个 <Skeleton />。
 */
export default function Skeleton({ width = '100%', height = 16, radius = 6, style }: SkeletonProps) {
  return (
    <>
      <style>{'@keyframes nx-skeleton-pulse{0%,100%{opacity:1}50%{opacity:.45}}'}</style>
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width,
          height,
          borderRadius: radius,
          background: 'var(--surface-hover, #F3F4F6)',
          animation: 'nx-skeleton-pulse 1.5s ease-in-out infinite',
          ...style,
        }}
      />
    </>
  );
}

/** 多行文本骨架。 */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}
