'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DecisionCard } from '@/lib/types';
import { useDynamicStyle } from '@/lib/hooks/use-dynamic-style';

/**
 * Decision Card Heat Map · 决议热力图
 *
 * 横轴: 日期 (近 12 周)
 * 纵轴: 不同 Class (simple / complex / strategic)
 * 颜色: 决议数密度
 *
 * 用途: 看清"组织活力" - 哪天决议多 / 哪类决议占比高
 */

const WEEKS = 12;

export interface HeatCell {
  weekIndex: number;       // 0-11 (从最近往回)
  decisionClass: 'simple' | 'complex' | 'strategic';
  count: number;
}

export function HeatMap({ cards }: { cards: DecisionCard[] }) {
  const matrix = buildMatrix(cards);
  const maxCount = matrix.reduce((m, c) => Math.max(m, c.count), 0);

  const classes: ('simple' | 'complex' | 'strategic')[] = ['simple', 'complex', 'strategic'];
  const classLabels: Record<string, string> = {
    simple: '常规',
    complex: '复杂',
    strategic: '战略',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-body">决议热力图 (近 12 周)</CardTitle>
        <p className="mt-1 text-footnote text-muted-foreground">
          颜色越深 = 决议越密集 · 共 {cards.length} 个决议
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-footnote">
            <thead>
              <tr>
                <th className="w-16 text-left font-normal text-muted-foreground"></th>
                {Array.from({ length: WEEKS }).map((_, i) => (
                  <th key={i} className="font-normal text-muted-foreground">
                    -{WEEKS - i - 1}w
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr key={cls}>
                  <td className="text-muted-foreground">{classLabels[cls]}</td>
                  {Array.from({ length: WEEKS }).map((_, i) => {
                    const cell = matrix.find((c) => c.weekIndex === i && c.decisionClass === cls);
                    const count = cell?.count ?? 0;
                    const intensity = maxCount > 0 ? count / maxCount : 0;
                    return (
                      <td key={i} className="p-0.5">
                        <HeatCellDot count={count} intensity={intensity} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-end gap-2 text-footnote text-muted-foreground">
          <span>少</span>
          {[0.1, 0.3, 0.5, 0.7, 1.0].map((i) => (
            <HeatCellDot key={i} count={0} intensity={i} small />
          ))}
          <span>多</span>
        </div>
      </CardContent>
    </Card>
  );
}

function HeatCellDot({ count, intensity, small }: { count: number; intensity: number; small?: boolean }) {
  const opacity = Math.max(0.1, intensity);
  const size = small ? 'w-3 h-3' : 'w-6 h-6';
  const ref = useDynamicStyle<HTMLDivElement>({ opacity: String(opacity) });
  return (
    <div
      ref={ref}
      className={`${size} rounded mx-auto bg-emerald-500`}
      title={`${count} 个决议`}
    />
  );
}

function buildMatrix(cards: DecisionCard[]): HeatCell[] {
  const now = Date.now();
  const matrix: HeatCell[] = [];

  for (let w = 0; w < WEEKS; w++) {
    const start = now - (w + 1) * 7 * 86400_000;
    const end = now - w * 7 * 86400_000;
    for (const cls of ['simple', 'complex', 'strategic'] as const) {
      const count = cards.filter((c) => {
        const t = new Date(c.createdAt).getTime();
        return t >= start && t < end && c.decisionClass === cls;
      }).length;
      matrix.push({ weekIndex: WEEKS - w - 1, decisionClass: cls, count });
    }
  }

  return matrix;
}
