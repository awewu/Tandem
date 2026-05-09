'use client';

import { useOKRStore } from '@/lib/store';
import { checkCycleHealth, sortIssues, type HealthIssue } from '@/lib/okr/health';
import { AlertTriangle, AlertCircle, Info, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON: Record<HealthIssue['severity'], any> = {
  error: AlertCircle, warning: AlertTriangle, info: Info,
};
const CLS: Record<HealthIssue['severity'], string> = {
  error: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30',
  warning: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30',
  info: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/30',
};

interface Props {
  cycleId: string;
  onJump?: (kind: 'objective' | 'kr', id: string) => void;
  /** 紧凑徽标模式 */
  compact?: boolean;
}

export function OKRHealthPanel({ cycleId, onJump, compact }: Props) {
  const cycle = useOKRStore((s) => s.cycles.find((c) => c.id === cycleId));
  const cycleObjectives = useOKRStore((s) => s.objectives.filter((o) => o.cycleId === cycleId));
  const allKRs = useOKRStore((s) => s.keyResults);
  const checkIns = useOKRStore((s) => s.checkIns);

  if (!cycle) return null;
  const issues = sortIssues(checkCycleHealth(cycle, cycleObjectives, allKRs, checkIns));
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;

  if (compact) {
    if (issues.length === 0) {
      return (
        <span className="text-xs text-green-700 flex items-center gap-1" title="OKR 健康度良好">
          <Stethoscope size={12} /> 健康
        </span>
      );
    }
    return (
      <span
        className={cn('text-xs flex items-center gap-1', errorCount > 0 ? 'text-red-700' : 'text-amber-700')}
        title={`${errorCount} 个错误 · ${warningCount} 个警告`}
      >
        <Stethoscope size={12} />
        {errorCount > 0 && <span>{errorCount} 错误</span>}
        {warningCount > 0 && <span>{warningCount} 警告</span>}
      </span>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="border border-dashed border-green-300 rounded p-3 text-sm text-green-700 bg-green-50/50 dark:bg-green-950/20">
        ✅ 本周期 OKR 健康度良好，无可疑问题
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium flex items-center gap-1.5">
        <Stethoscope size={14} /> 健康度检查
        <span className="text-xs text-muted-foreground font-normal">
          {errorCount > 0 && <>· {errorCount} 错误</>}
          {warningCount > 0 && <> · {warningCount} 警告</>}
        </span>
      </div>
      <div className="space-y-1.5">
        {issues.map((i, idx) => {
          const Icon = ICON[i.severity];
          const Tag = i.jumpTo && onJump ? 'button' : 'div';
          return (
            <Tag
              key={idx}
              {...(i.jumpTo && onJump ? { onClick: () => onJump(i.jumpTo!.kind, i.jumpTo!.id) } : {})}
              className={cn(
                'border rounded p-2 text-xs flex items-start gap-2 w-full text-left',
                CLS[i.severity],
                i.jumpTo && onJump && 'hover:opacity-90 cursor-pointer',
              )}
            >
              <Icon size={14} className="shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{i.title}</div>
                {i.detail && <div className="opacity-75 mt-0.5">{i.detail}</div>}
              </div>
              <code className="text-[10px] opacity-60 shrink-0">{i.code}</code>
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
