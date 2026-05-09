'use client';

import { useState } from 'react';
import { useOKRStore } from '@/lib/store';
import { calcObjectiveScore, suggestedFinalScore, scoreBand } from '@/lib/okr/scoring';
import { Award, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  objectiveId: string;
}

const BAND_CLS = {
  green: 'text-green-700 bg-green-50 border-green-200 dark:bg-green-950/30',
  yellow: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30',
  red: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30',
};

export function OKRScoring({ objectiveId }: Props) {
  const obj = useOKRStore((s) => s.objectives.find((o) => o.id === objectiveId));
  const krs = useOKRStore((s) => s.keyResults.filter((k) => k.objectiveId === objectiveId));
  const allKRs = useOKRStore((s) => s.keyResults);
  const scoreObjective = useOKRStore((s) => s.scoreObjective);
  const scoreKeyResult = useOKRStore((s) => s.scoreKeyResult);
  const reviewObjective = useOKRStore((s) => s.reviewObjective);
  const [retroDraft, setRetroDraft] = useState(obj?.retrospective || '');

  if (!obj) return null;

  const report = calcObjectiveScore(obj, allKRs);
  const suggested = suggestedFinalScore(obj, allKRs);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <Award size={14} /> 周期评分（Google 0.0 - 1.0 制）
        </div>
        <div className={cn('border rounded p-3 space-y-2', BAND_CLS[report.band])}>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{report.value.toFixed(2)}</span>
            <span className="text-xs">{report.band === 'green' ? '🟢 健康' : report.band === 'yellow' ? '🟡 待改进' : '🔴 未达预期'}</span>
          </div>
          <div className="text-xs">{report.interpretation}</div>
          <div className="text-[11px] opacity-75 leading-relaxed">
            <strong>0.7 是健康分</strong>。OKR 文化鼓励「野心目标」——拿到 0.7 已经说明很努力了。
            如果总能拿满分 1.0，说明目标定低了。
          </div>
        </div>
      </div>

      {/* 自评 / 上级评 / 终评 */}
      <div className="space-y-3">
        <ScoreInput
          label="负责人自评"
          value={obj.selfScore ?? null}
          onChange={(v) => scoreObjective(obj.id, 'self', v)}
        />
        <ScoreInput
          label="上级评分"
          value={obj.managerScore ?? null}
          onChange={(v) => scoreObjective(obj.id, 'manager', v)}
        />
        <ScoreInput
          label="终评（最终）"
          value={obj.score ?? null}
          onChange={(v) => scoreObjective(obj.id, 'final', v)}
          hint={
            <span>
              建议值：<button onClick={() => scoreObjective(obj.id, 'final', suggested)} className="underline hover:text-primary">{suggested.toFixed(2)}</button>
              {' '}（自评×0.4 + 上级×0.6）
            </span>
          }
        />
      </div>

      {/* KR 评分 */}
      {krs.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-2">KR 单项评分</div>
          <div className="space-y-2">
            {krs.map((k) => (
              <div key={k.id} className="border rounded p-2">
                <div className="text-sm mb-1.5">{k.title}</div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground w-12 shrink-0">自评</span>
                  <ScoreSlider value={k.selfScore ?? null} onChange={(v) => scoreKeyResult(k.id, 'self', v)} />
                </div>
                <div className="flex items-center gap-3 text-xs mt-1">
                  <span className="text-muted-foreground w-12 shrink-0">终评</span>
                  <ScoreSlider value={k.finalScore ?? null} onChange={(v) => scoreKeyResult(k.id, 'final', v)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 复盘 */}
      <div>
        <div className="text-sm font-medium mb-2 flex items-center gap-1.5">
          <BookOpen size={14} /> 复盘记录（PDCA / KISS / 4L 任选）
        </div>
        <textarea
          value={retroDraft}
          onChange={(e) => setRetroDraft(e.target.value)}
          placeholder={`PDCA：Plan/Do/Check/Act\nKISS：Keep/Improve/Start/Stop\n4L：Liked/Learned/Lacked/Longed for\n\n例：\n• Liked：Onboarding 改版让 D1 留存提升 8%\n• Learned：用户对推送的容忍度低于预期\n• Lacked：A/B 测试基础设施\n• Longed for：更快的实验迭代周期`}
          rows={8}
          className="w-full text-sm border rounded p-2 bg-background"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            {obj.reviewedAt ? `已于 ${new Date(obj.reviewedAt).toLocaleDateString('zh-CN')} 复盘` : '尚未保存复盘'}
          </span>
          <button
            onClick={() => reviewObjective(obj.id, retroDraft)}
            className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground"
          >
            保存复盘
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreInput({
  label, value, onChange, hint,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {value == null ? <span className="text-muted-foreground">未评</span> : value.toFixed(2)}
          {value != null && (
            <span className={cn('ml-2 text-[10px] px-1.5 py-0.5 rounded', BAND_CLS[scoreBand(value)])}>
              {scoreBand(value) === 'green' ? '🟢' : scoreBand(value) === 'yellow' ? '🟡' : '🔴'}
            </span>
          )}
        </span>
      </div>
      <ScoreSlider value={value} onChange={onChange} />
      {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function ScoreSlider({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value == null ? 0 : Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="flex-1"
        title="评分滑块 0.0-1.0"
      />
      <span className="text-xs w-10 text-right tabular-nums">
        {value == null ? '—' : value.toFixed(2)}
      </span>
    </div>
  );
}
