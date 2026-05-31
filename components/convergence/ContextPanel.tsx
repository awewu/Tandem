'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Target, TrendingUp } from 'lucide-react';

export interface ContextMaterial {
  id: string;
  title: string;
  type: string;
  similarity?: number;
}

export interface ContextKr {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit?: string;
}

export interface ContextTti {
  id: string;
  title: string;
  completionRate: number;
}

export function ContextPanel({
  materials = [],
  krs = [],
  ttis = [],
}: {
  materials?: ContextMaterial[];
  krs?: ContextKr[];
  ttis?: ContextTti[];
}) {
  const empty = materials.length === 0 && krs.length === 0 && ttis.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-body">议题上下文</CardTitle>
        <p className="mt-1 text-footnote text-muted-foreground">
          AI 已自动检索相关材料 / KR / TTI 作为决策依据
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {empty && (
          <div className="text-caption text-muted-foreground">
            暂无关联上下文. 议题描述越具体, AI 检索到的相关材料越多.
          </div>
        )}

        {materials.length > 0 && (
          <Section icon={FileText} title="相关材料 / SOP / 案例" count={materials.length}>
            {materials.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded border p-2 text-caption">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-footnote">{m.type}</Badge>
                  <span className="truncate">{m.title}</span>
                </div>
                {m.similarity !== undefined && (
                  <span className="ml-2 text-footnote text-muted-foreground">
                    相似度 {Math.round(m.similarity * 100)}%
                  </span>
                )}
              </div>
            ))}
          </Section>
        )}

        {krs.length > 0 && (
          <Section icon={Target} title="关联 OKR" count={krs.length}>
            {krs.map((kr) => {
              const pct = kr.targetValue
                ? Math.min(1, kr.currentValue / kr.targetValue)
                : 0;
              return (
                <div key={kr.id} className="rounded border p-2 text-caption">
                  <div className="font-medium">{kr.title}</div>
                  <div className="mt-1 flex items-center justify-between text-footnote text-muted-foreground">
                    <span>
                      {kr.currentValue}{kr.unit ?? ''} / {kr.targetValue}{kr.unit ?? ''}
                    </span>
                    <span>{Math.round(pct * 100)}%</span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </Section>
        )}

        {ttis.length > 0 && (
          <Section icon={TrendingUp} title="关联 TTI" count={ttis.length}>
            {ttis.map((t) => (
              <div key={t.id} className="rounded border p-2 text-caption">
                <div className="font-medium">{t.title}</div>
                <div className="mt-1 flex items-center justify-between text-footnote text-muted-foreground">
                  <span>完成度</span>
                  <span>{Math.round(t.completionRate * 100)}%</span>
                </div>
              </div>
            ))}
          </Section>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof FileText;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1 text-footnote font-medium text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
        <span className="text-slate-400">({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
