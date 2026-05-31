'use client';

/**
 * EVO-2 · OKR 智能纠偏面板
 *
 * 嵌入 /okr 已有 healthDrawer，紧贴 OKRHealthPanel 之下。
 * 不替代 health 面板，而是给每条问题配一个「单击可达」的行动入口。
 *
 * 守则:
 *   - 仅显示，不自动改写任何 OKR（合 MANIFESTO §15）
 *   - 每次「采纳」由调用方落审计（onApply 回调内做 addActivity）
 *   - 默认 3 条上限（强约束 3+1）
 */

import { useMemo } from 'react';
import { useOKRStore } from '@/lib/store';
import { checkCycleHealth, sortIssues } from '@/lib/okr/health';
import { deriveSuggestions, type OKRSuggestion } from '@/lib/okr/diagnosis';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  cycleId: string;
  onApply?: (suggestion: OKRSuggestion) => void;
  /** 主动询问候选 (可选)，由父组件根据上下文传入 */
  proactivePrompt?: {
    objectiveId: string;
    objectiveTitle: string;
    onAccept: () => void;
  } | null;
}

const SEVERITY_TINT: Record<OKRSuggestion['severity'], string> = {
  error: 'border-danger/30 bg-danger/5/70 dark:bg-danger/20',
  warning: 'border-warning/30 bg-warning/5/70 dark:bg-warning/20',
  info: 'border-blue-300 bg-blue-50/70 dark:bg-blue-950/20',
};

export function OKRDiagnosisPanel({ cycleId, onApply, proactivePrompt }: Props) {
  const cycle = useOKRStore((s) => s.cycles.find((c) => c.id === cycleId));
  const cycleObjectives = useOKRStore((s) =>
    s.objectives.filter((o) => o.cycleId === cycleId),
  );
  const allKRs = useOKRStore((s) => s.keyResults);
  const checkIns = useOKRStore((s) => s.checkIns);

  const suggestions = useMemo(() => {
    if (!cycle) return [];
    const issues = sortIssues(
      checkCycleHealth(cycle, cycleObjectives, allKRs, checkIns),
    );
    return deriveSuggestions(issues, { maxCount: 3 });
  }, [cycle, cycleObjectives, allKRs, checkIns]);

  if (!cycle) return null;

  if (suggestions.length === 0 && !proactivePrompt) {
    return (
      <div className="border border-dashed border-emerald-300 rounded-lg p-3 text-footnote text-emerald-700 dark:text-emerald-300 flex items-center gap-2 bg-emerald-50/40 dark:bg-emerald-950/20">
        <ShieldCheck size={14} />
        <span>无紧急纠偏建议。继续保持当前节奏。</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-caption font-medium flex items-center gap-1.5">
        <Sparkles size={14} className="text-purple-600" />
        AI 纠偏建议
        <span className="text-[10px] text-muted-foreground font-normal">
          · 至多 3 条 · 全部由你点击决定是否执行
        </span>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className={cn(
              'border rounded-lg p-2.5 flex items-start gap-3',
              SEVERITY_TINT[s.severity],
            )}
          >
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="text-footnote font-medium">{s.title}</div>
              <div className="text-[11px] text-muted-foreground line-clamp-2">
                依据: {s.rationale}
              </div>
            </div>
            {onApply && (
              <button
                onClick={() => onApply(s)}
                className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-md border bg-white/80 dark:bg-surface-3/70 hover:bg-white dark:hover:bg-surface-3 flex items-center gap-1 transition-colors"
              >
                {s.action.label}
                <ArrowRight size={11} />
              </button>
            )}
          </div>
        ))}
        {proactivePrompt && (
          <div className="border border-purple-200 rounded-lg p-2.5 flex items-start gap-3 bg-purple-50/60 dark:bg-purple-950/20">
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="text-footnote font-medium">
                顺便一问 · 「{proactivePrompt.objectiveTitle}」最近怎么样？
              </div>
              <div className="text-[11px] text-muted-foreground">
                没有告警，仅温和提醒；不想看可随时关闭健康面板。
              </div>
            </div>
            <button
              onClick={proactivePrompt.onAccept}
              className="shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-md border bg-white/80 dark:bg-surface-3/70 hover:bg-white flex items-center gap-1"
            >
              去 Check-in
              <ArrowRight size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
