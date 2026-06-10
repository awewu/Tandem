'use client';

/**
 * /okr/fpa · FP&A 经营推演 (事半 · 战略执行基座)
 *
 * 职责拆分 (2026-06): FP&A 引擎本质是「事半的大脑」——围绕 OKR/KPI 做经营预测与
 * 偏差分析, 故从 Tandem 的 /governance/three-departments 拆出, 独立成事半下路由,
 * 高亮稳定归「事半」, 不再弹跳到 Tandem。
 *
 *   - 成本中心 BSC : 尚书六部=成本中心单元, 每单元四维 BSC (门下底线 + 尚书体检)
 *   - FP&A 推演    : 抓 OKR (KR.targetKpiId + expectedKpiDelta) → DeliveryBaseline 投影 BSC 末值
 *
 * 纪律: 只读 + 只产预测, 不写任何真值; 校准建议走现有 KpiCausalLink PATCH 人工应用。
 * 议事/执行协同仍在 Tandem · 三省六部。
 */

import { useState } from 'react';
import Link from 'next/link';
import { Building2, Sparkles, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CostCenterBscView, FpaRehearsalView } from '@/components/governance/fpa-views';

type FpaView = 'bsc' | 'fpa';

export default function OkrFpaPage() {
  const [view, setView] = useState<FpaView>('bsc');

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 md:px-6 py-3 border-b">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-title font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-warning" />
              FP&amp;A 经营推演
            </h1>
            <p className="text-footnote text-muted-foreground mt-0.5 max-w-2xl leading-relaxed">
              成本中心四维 BSC + OKR 驱动的交付基线推演。只读·只产预测, 不写真值; 校准建议人工应用。
              执行协同请到 <Link href="/governance/three-departments" className="text-brand-600 hover:underline">Tandem · 三省六部</Link>。
            </p>
          </div>
          <div className="flex gap-1 bg-muted rounded-md p-0.5">
            <button
              onClick={() => setView('bsc')}
              className={cn(
                'px-3 py-1 text-footnote rounded transition-colors flex items-center gap-1',
                view === 'bsc' ? 'bg-background shadow-soft-sm' : 'text-muted-foreground',
              )}
            >
              <Building2 className="w-3 h-3" />
              成本中心 BSC
            </button>
            <button
              onClick={() => setView('fpa')}
              className={cn(
                'px-3 py-1 text-footnote rounded transition-colors flex items-center gap-1',
                view === 'fpa' ? 'bg-background shadow-soft-sm' : 'text-muted-foreground',
              )}
            >
              <Network className="w-3 h-3" />
              FP&amp;A 推演
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-auto">
        {view === 'bsc' ? <CostCenterBscView /> : <FpaRehearsalView />}
      </div>
    </div>
  );
}
