'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Shield, TrendingUp, AlertCircle } from 'lucide-react';
import type { Persona, PersonaStage } from '@/lib/types/persona';

const STAGE_META: Record<PersonaStage, { emoji: string; label: string; color: string; description: string }> = {
  newborn: {
    emoji: '🥚',
    label: '新生',
    color: 'bg-slate-100 text-slate-700',
    description: '0-2 周, 仅旁听学习, 不发表意见',
  },
  apprentice: {
    emoji: '🐣',
    label: '学徒',
    color: 'bg-blue-100 text-blue-700',
    description: '2 周-2 月, 可代汇报数据 standup',
  },
  assistant: {
    emoji: '🐤',
    label: '助手',
    color: 'bg-amber-100 text-amber-700',
    description: '2-6 月, 可参与绿区会议表态',
  },
  deputy: {
    emoji: '🦅',
    label: '副手',
    color: 'bg-emerald-100 text-emerald-700',
    description: '6 月-1 年, 可承诺 1 工作日内动作',
  },
  partner: {
    emoji: '🐉',
    label: '搭档',
    color: 'bg-purple-100 text-purple-700',
    description: '> 1 年, 跨企业 (除红区)',
  },
};

export function PersonaDashboard({ persona }: { persona: Persona }) {
  const meta = STAGE_META[persona.stage];
  const stages: PersonaStage[] = ['newborn', 'apprentice', 'assistant', 'deputy', 'partner'];
  const stageIdx = stages.indexOf(persona.stage);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            我的拿捏老板分身
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current stage */}
          <div className={`rounded-lg border p-4 ${meta.color}`}>
            <div className="flex items-center gap-3">
              <div className="text-4xl">{meta.emoji}</div>
              <div>
                <div className="text-lg font-semibold">{meta.label}阶段</div>
                <div className="text-sm opacity-75">{meta.description}</div>
              </div>
            </div>
          </div>

          {/* Stage progression */}
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">5 阶段进化</span>
              <span className="font-medium">{stageIdx + 1} / 5</span>
            </div>
            <div className="grid grid-cols-5 gap-1">
              {stages.map((s, i) => (
                <div
                  key={s}
                  className={`rounded p-2 text-center text-xs ${
                    i <= stageIdx ? STAGE_META[s].color : 'bg-slate-50 text-slate-400'
                  }`}
                  title={STAGE_META[s].description}
                >
                  <div>{STAGE_META[s].emoji}</div>
                  <div className="mt-1 font-medium">{STAGE_META[s].label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Boss capture score */}
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">拿捏老板度</span>
              <span className="font-mono font-medium">{persona.bossCaptureScore}/100</span>
            </div>
            <Progress value={persona.bossCaptureScore} />
          </div>

          {/* Decision history */}
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="累计决议"
              value={persona.decisionHistory.totalDecisions}
              icon={TrendingUp}
            />
            <Stat
              label="AI 协助"
              value={persona.decisionHistory.aiAssisted}
              icon={Sparkles}
            />
            <Stat
              label="否决率"
              value={`${(persona.decisionHistory.vetoRate * 100).toFixed(1)}%`}
              icon={Shield}
              alert={persona.decisionHistory.vetoRate > 0.2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data ownership notice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            数据归属说明 (MANIFESTO 第十三条)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground">数据所有权:</span>
            <span>归公司</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground">尊严保障:</span>
            <span>离职后画像匿名化</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground">导出权:</span>
            <span>员工可导出个人 ORIGIN 原始数据</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground">否决权:</span>
            <span>对 AI 提交的任何决议, 24h 内可撤回</span>
          </div>
        </CardContent>
      </Card>

      {/* Growth areas */}
      {persona.growthAreas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">成长方向</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {persona.growthAreas.map((g) => (
                <li
                  key={g.id}
                  className="flex items-start gap-2 rounded border p-2 text-sm"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                  <div>
                    <div className="font-medium">{g.category}</div>
                    <div className="text-muted-foreground">{g.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: string | number;
  icon: typeof Sparkles;
  alert?: boolean;
}) {
  return (
    <div className={`rounded border p-3 ${alert ? 'border-amber-300 bg-amber-50' : ''}`}>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold font-mono">{value}</div>
    </div>
  );
}
