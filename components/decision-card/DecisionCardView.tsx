'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Clock, FileText, Link2 } from 'lucide-react';
import type { DecisionCard } from '@/lib/types';

const STATE_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  DIVERGE: { label: '审议中', className: 'bg-blue-100 text-blue-700', icon: Clock },
  CONVERGE: { label: '收敛中', className: 'bg-purple-100 text-purple-700', icon: Clock },
  COMMIT: { label: '已生效', className: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  ESCALATED: { label: '已升级', className: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  VETOED: { label: '已否决', className: 'bg-red-100 text-red-700', icon: XCircle },
};

export function DecisionCardView({ card }: { card: DecisionCard }) {
  const state = STATE_META[card.convergenceState] ?? STATE_META.DIVERGE;
  const Icon = state.icon;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-xl">{card.title}</CardTitle>
            <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${state.className}`}>
              <Icon className="h-3 w-3" /> {state.label}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{card.decisionClass}</Badge>
            <span>耗时 {Math.floor(card.elapsedSeconds / 60)}:{String(card.elapsedSeconds % 60).padStart(2, '0')}</span>
            <span>· 创建于 {formatDate(card.createdAt)}</span>
            {card.watermark.isProxy && (
              <Badge variant="secondary" className="ml-auto">
                AI 代行 ({card.watermark.proxyType})
              </Badge>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Selected option */}
      {card.selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">最终方案: 选项 {card.selected}</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const opt = card.options.find((o) => o.id === card.selected);
              if (!opt) return <span className="text-muted-foreground">(选项数据缺失)</span>;
              return (
                <div className="space-y-2">
                  <p className="whitespace-pre-wrap">{opt.description}</p>
                  {opt.reasoning && (
                    <details className="text-sm text-muted-foreground">
                      <summary className="cursor-pointer">推理依据</summary>
                      <p className="mt-1 whitespace-pre-wrap">{opt.reasoning}</p>
                    </details>
                  )}
                  {card.selectedBy && (
                    <p className="text-xs text-muted-foreground">
                      选定人: {card.selectedBy} · 于 {card.selectedAt && formatDate(card.selectedAt)}
                    </p>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Action items */}
      {card.actionItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Action Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {card.actionItems.map((a) => (
                <li key={a.id} className="flex items-start gap-2 rounded border p-2 text-sm">
                  <input type="checkbox" checked={a.status === 'done'} readOnly className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">{a.task}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      负责人: {a.owner} · 截止: {formatDate(a.due)} · 状态: {a.status}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Linked KR / TTI */}
      {(card.relatedKr?.length || card.relatedTti?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" /> 关联 OKR / TTI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {card.relatedKr?.map((kr) => (
              <div key={kr} className="text-muted-foreground">KR: {kr}</div>
            ))}
            {card.relatedTti?.map((tti) => (
              <div key={tti} className="text-muted-foreground">TTI: {tti}</div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Veto window */}
      {card.vetoWindowEnds && card.convergenceState === 'COMMIT' && (
        <Card>
          <CardContent className="py-3 text-sm text-amber-800 bg-amber-50">
            ⚠️ 24h 否决窗口至 {formatDate(card.vetoWindowEnds)} - 员工本人可在此期间撤回决议
          </CardContent>
        </Card>
      )}

      {/* Retrospective */}
      {card.retrospective && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">复盘</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">实际效果: </span>
              <span>{card.retrospective.actualOutcome ?? '(未填写)'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">学到什么: </span>
              <span>{card.retrospective.learning ?? '(未填写)'}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}
