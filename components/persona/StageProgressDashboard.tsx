'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Egg, Sparkles, Target, AlertTriangle, ArrowRight } from 'lucide-react';
import type { StageProgress } from '@/lib/persona/learning-collector';
import { STAGE_META, TONE_TOKENS, STAGE_LIST } from '@/lib/persona/stage-meta';
import type { PersonaStage } from '@/lib/types/persona';

/** 把 SSOT STAGE_META 折成本组件需要的形状 */
function metaFor(stage: PersonaStage | string) {
  const m = STAGE_META[stage as PersonaStage];
  if (!m) return null;
  const tone = TONE_TOKENS[m.tone];
  return {
    emoji: m.emoji,
    label: `Lv.${m.level} ${m.title}`,
    color: `${tone.bgSoft} ${tone.text}`,
    desc: m.blurb,
  };
}

export function StageProgressDashboard({
  progress,
  bossCaptureScore,
  onConfirmUpgrade,
}: {
  progress: StageProgress;
  bossCaptureScore: number;
  onConfirmUpgrade: () => Promise<void>;
}) {
  const cur = metaFor(progress.currentStage);
  const next = progress.nextStage ? metaFor(progress.nextStage) : null;
  if (!cur) return null;

  return (
    <div className="space-y-4">
      {/* 当前阶段 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            我的分身 · 进化进度
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="text-6xl">{cur.emoji}</div>
            <div className="flex-1">
              <div className={`inline-block rounded px-2 py-0.5 text-sm font-semibold ${cur.color}`}>
                {cur.label} (当前)
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{cur.desc}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                已在此阶段 {progress.daysInStage} 天
              </p>
            </div>
            {next && (
              <>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div>
                  <div className="text-6xl opacity-40">{next.emoji}</div>
                  <p className="mt-1 text-center text-xs text-muted-foreground">{next.label}</p>
                </div>
              </>
            )}
          </div>

          {/* 拿捏度 */}
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium">拿捏度</span>
              <span>{(bossCaptureScore * 100).toFixed(0)} / 100</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-100">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-purple-500"
                data-pct={Math.round(bossCaptureScore * 100)}
                style={{ width: `${Math.round(bossCaptureScore * 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 升级条件 */}
      {next && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              升级到 {next.emoji} {next.label} 的条件
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CriterionRow
              icon={<Target className="h-4 w-4" />}
              label="时长"
              current={progress.daysInStage}
              required={progress.daysRequired}
              unit="天"
            />
            <CriterionRow
              icon={<Egg className="h-4 w-4" />}
              label="决议数"
              current={progress.decisionsMade}
              required={progress.decisionsRequired}
              unit="个"
            />
            <CriterionRow
              icon={<AlertTriangle className="h-4 w-4" />}
              label="否决率上限"
              current={Number((progress.vetoRate * 100).toFixed(1))}
              required={Number((progress.maxVetoRate * 100).toFixed(0))}
              unit="%"
              inverted
            />

            {progress.blockedReasons.length > 0 ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium">距离升级还差:</p>
                <ul className="mt-1 list-inside list-disc">
                  {progress.blockedReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-2 rounded border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm font-medium text-emerald-800">
                  ✨ 全部条件达成! 你可以确认升级到下一阶段.
                </p>
                <p className="text-xs text-emerald-700">
                  Tandem autonomy 守门: 升级必须由员工本人主动确认, AI 不会自动升级.
                </p>
                <Button onClick={onConfirmUpgrade} size="sm">
                  确认升级到 {next.emoji} {next.label}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5 阶段总览 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">5 阶段进化路线</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {STAGE_LIST.map((sm) => {
              const isCurrent = sm.stage === progress.currentStage;
              return (
                <div
                  key={sm.stage}
                  className={`flex items-center gap-3 rounded p-2 ${isCurrent ? 'bg-amber-50' : ''}`}
                >
                  <span className="text-2xl">{sm.emoji}</span>
                  <div className="flex-1">
                    <Badge variant={isCurrent ? 'default' : 'outline'}>
                      Lv.{sm.level} {sm.title}
                    </Badge>
                    <p className="mt-0.5 text-xs text-muted-foreground">{sm.blurb}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CriterionRow({
  icon,
  label,
  current,
  required,
  unit,
  inverted,
}: {
  icon: React.ReactNode;
  label: string;
  current: number;
  required: number;
  unit: string;
  /** true = 越小越好 (如 vetoRate) */
  inverted?: boolean;
}) {
  const met = inverted ? current <= required : current >= required;
  const pct = inverted
    ? Math.max(0, Math.min(100, (1 - current / Math.max(0.01, required)) * 100))
    : Math.min(100, (current / Math.max(1, required)) * 100);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className={met ? 'text-emerald-600' : 'text-muted-foreground'}>
          {current}{unit} / {inverted ? '≤ ' : ''}{required}{unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-slate-100">
        <div
          className={`h-full ${met ? 'bg-emerald-500' : 'bg-amber-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
