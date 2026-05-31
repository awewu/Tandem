'use client';

/**
 * BSC 四维配比面板 (B-020)
 *
 * 显示位置: `/admin/kpi/setup` 顶部, 当前周期下方.
 * 数据来源: 本周期 bonus scope KPI (computeBscDistribution onlyBonus=true).
 *
 * 设计宪章 (docs/CHARTER-UI-V1.md + memory#87c1d51d):
 *   - L3 semantic 字体: .text-title-3 / .text-headline / .text-body / .text-caption / .text-footnote
 *   - L3 surface: .surface-card-soft (面板) · rounded-2xl
 *   - L3 shadow: .shadow-soft-sm (不用 Tailwind 默认重阴影)
 *   - 维度颜色: 一律走 BSC_PERSPECTIVE token (lib/design-tokens.ts), 不散落 raw Tailwind
 *   - 文案: .text-primary / .text-secondary / .text-tertiary
 */

import { BSC_PERSPECTIVE, HEALTH, type BscPerspective } from '@/lib/design-tokens';
import { BSC_PERSPECTIVES, type BscBalanceReport } from '@/lib/kpi/bsc-validation';
import { AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface Props {
  report: BscBalanceReport;
  className?: string;
}

const LEVEL_META = {
  healthy: {
    Icon: CheckCircle2,
    label: '配比健康',
    desc: '四维齐全, 财务维度未越界, 符合 BSC 平衡精神',
    tone: HEALTH.green.badge,
    iconTone: HEALTH.green.text,
  },
  warning: {
    Icon: AlertTriangle,
    label: '配比软警告',
    desc: '存在轻度失衡, 不阻断激活, 建议补齐后再锁定',
    tone: HEALTH.amber.badge,
    iconTone: HEALTH.amber.text,
  },
  imbalanced: {
    Icon: AlertOctagon,
    label: '配比严重失衡',
    desc: '违背 BSC 平衡精神, 周期激活需二次确认 + audit 留痕',
    tone: HEALTH.red.badge,
    iconTone: HEALTH.red.text,
  },
} as const;

export function BscDistributionPanel({ report, className }: Props) {
  const { distribution, level, issues } = report;
  const meta = LEVEL_META[level];
  const { Icon } = meta;
  const hasWeights = distribution.totalWeight > 0;

  return (
    <section
      className={`surface-card-soft rounded-2xl shadow-soft-sm p-5 space-y-4 ${className ?? ''}`}
      aria-label="BSC 四维配比"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-title-3 text-primary">BSC 平衡记分卡 · 四维配比</h3>
          <p className="text-caption text-secondary">
            按 bonus scope KPI 权重归一 · Kaplan/Norton 平衡原则 · 仅校验, 不阻断
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption ${meta.tone}`}
          role="status"
        >
          <Icon className={`h-3.5 w-3.5 ${meta.iconTone}`} />
          <span className="font-medium">{meta.label}</span>
        </div>
      </header>

      {/* 四维条形 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {BSC_PERSPECTIVES.map((p) => (
          <PerspectiveBar
            key={p}
            perspective={p}
            share={distribution.byPerspective[p]}
            count={distribution.countByPerspective[p]}
            weight={distribution.weightByPerspective[p]}
            hasWeights={hasWeights}
          />
        ))}
      </div>

      {/* Issues 列表 */}
      {issues.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {issues.map((iss, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 rounded-2xl border px-3 py-2 text-caption ${
                iss.severity === 'severe' ? HEALTH.red.badge : HEALTH.amber.badge
              }`}
            >
              {iss.severity === 'severe' ? (
                <AlertOctagon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              )}
              <span>{iss.message}</span>
            </li>
          ))}
        </ul>
      )}

      {/* 描述底部说明 */}
      <p className="text-footnote text-tertiary">
        {meta.desc}
        {distribution.unclassifiedCount > 0 && (
          <>
            {' · '}
            <span>
              {distribution.unclassifiedCount} 个 KPI 未分类 (权重{' '}
              {distribution.unclassifiedWeight})
            </span>
          </>
        )}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sub: 单维度条
// ---------------------------------------------------------------------------

function PerspectiveBar({
  perspective,
  share,
  count,
  weight,
  hasWeights,
}: {
  perspective: BscPerspective;
  share: number;
  count: number;
  weight: number;
  hasWeights: boolean;
}) {
  const meta = BSC_PERSPECTIVE[perspective];
  const pct = hasWeights ? Math.round(share * 100) : 0;
  const widthStyle = { width: `${Math.max(2, pct)}%` };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span aria-hidden className="text-body leading-none">
            {meta.emoji}
          </span>
          <span className="text-body text-primary font-medium truncate">{meta.label}</span>
          <span className="text-caption text-tertiary tabular-nums">({count})</span>
        </div>
        <span className="text-headline text-primary tabular-nums">
          {hasWeights ? `${pct}%` : '—'}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden surface-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${meta.label} 占比 ${pct}%`}
      >
        <div
          className={`h-full rounded-full transition-all ${meta.bar}`}
          style={widthStyle}
        />
      </div>
      <p className="text-footnote text-tertiary truncate">
        {meta.desc} · 权重 {weight}
      </p>
    </div>
  );
}
