'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NineBoxCell } from '@/lib/types/okr-tti';
import { classifyNineBox } from '@/lib/types/okr-tti';

export interface PersonInBox {
  userId: string;
  name: string;
  kpiScore: number;       // 0-1
  ttiScore: number;       // 0-1
  avatarUrl?: string;
}

const CELL_META: Record<NineBoxCell, { title: string; sub: string; bg: string; textColor: string }> = {
  star: {
    title: '⭐ 明星',
    sub: '高 KPI · 高 TTI',
    bg: 'bg-emerald-100',
    textColor: 'text-emerald-900',
  },
  high_performer: {
    title: '🚀 高产',
    sub: '高 KPI · 中 TTI',
    bg: 'bg-emerald-50',
    textColor: 'text-emerald-800',
  },
  risk_burnout: {
    title: '⚠️ 枯萎风险',
    sub: '高 KPI · 低 TTI',
    bg: 'bg-amber-50',
    textColor: 'text-amber-800',
  },
  rising_talent: {
    title: '🌱 升星人才',
    sub: '中 KPI · 高 TTI',
    bg: 'bg-emerald-50',
    textColor: 'text-emerald-800',
  },
  core: {
    title: '🧱 核心力量',
    sub: '中 KPI · 中 TTI',
    bg: 'bg-slate-50',
    textColor: 'text-slate-800',
  },
  plateau: {
    title: '➖ 平台期',
    sub: '中 KPI · 低 TTI',
    bg: 'bg-slate-100',
    textColor: 'text-slate-700',
  },
  mismatch: {
    title: '🔄 人岗不匹配',
    sub: '低 KPI · 高 TTI',
    bg: 'bg-blue-50',
    textColor: 'text-blue-800',
  },
  low_engagement: {
    title: '😴 投入不足',
    sub: '低 KPI · 中 TTI',
    bg: 'bg-amber-50',
    textColor: 'text-amber-800',
  },
  must_intervene: {
    title: '🚨 必须干预',
    sub: '低 KPI · 低 TTI',
    bg: 'bg-red-50',
    textColor: 'text-red-800',
  },
};

// 9 宫格布局 (从左上 → 右下)
//   高 TTI |  star          rising_talent   mismatch
//   中 TTI |  high_performer core            low_engagement
//   低 TTI |  risk_burnout   plateau         must_intervene
//          |  低 KPI         中 KPI          高 KPI ← (注: 视觉上 KPI 高在右)
const GRID_LAYOUT: NineBoxCell[][] = [
  ['mismatch', 'rising_talent', 'star'],
  ['low_engagement', 'core', 'high_performer'],
  ['must_intervene', 'plateau', 'risk_burnout'],
];

export function NineBoxMatrix({ people }: { people: PersonInBox[] }) {
  // 分组
  const grouped: Record<NineBoxCell, PersonInBox[]> = {
    star: [],
    high_performer: [],
    risk_burnout: [],
    rising_talent: [],
    core: [],
    plateau: [],
    mismatch: [],
    low_engagement: [],
    must_intervene: [],
  };
  for (const p of people) {
    const cell = classifyNineBox(p.kpiScore, p.ttiScore);
    grouped[cell].push(p);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>9 宫格人才矩阵</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          KPI (横轴) × TTI (纵轴) · 共 {people.length} 人
        </p>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Y axis label */}
          <div className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-muted-foreground whitespace-nowrap">
            ← TTI 提升度 →
          </div>

          {/* 3x3 Grid */}
          <div className="grid grid-cols-3 gap-3 ml-4">
            {GRID_LAYOUT.flat().map((cell, idx) => {
              const meta = CELL_META[cell];
              const occupants = grouped[cell];
              return (
                <div
                  key={idx}
                  className={`rounded-lg border p-3 min-h-[140px] ${meta.bg} ${meta.textColor}`}
                >
                  <div className="font-semibold text-sm">{meta.title}</div>
                  <div className="text-xs mt-0.5 opacity-75">{meta.sub}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {occupants.length === 0 && (
                      <span className="text-xs opacity-50">—</span>
                    )}
                    {occupants.slice(0, 8).map((p) => (
                      <PersonChip key={p.userId} person={p} />
                    ))}
                    {occupants.length > 8 && (
                      <span className="text-xs opacity-75">+{occupants.length - 8}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* X axis label */}
          <div className="mt-2 text-center text-xs text-muted-foreground">
            ← KPI 完成度 →
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonChip({ person }: { person: PersonInBox }) {
  const initial = person.name.slice(0, 1);
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs"
      title={`${person.name} (KPI ${Math.round(person.kpiScore * 100)}% / TTI ${Math.round(
        person.ttiScore * 100
      )}%)`}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[10px] font-semibold text-white">
        {initial}
      </span>
      <span>{person.name}</span>
    </div>
  );
}
