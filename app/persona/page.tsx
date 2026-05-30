'use client';

/**
 * /persona · 学员主页 (Academy Student Hub)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 * 心智模型: 学员证 + 4 面 tab (今日课表/实习日志/培养计划/实习权限)
 *
 */

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StudentCard } from '@/components/persona/StudentCard';
import {
  CourseTabs,
  isPersonaTab,
  type PersonaTab,
} from '@/components/persona/CourseTabs';
import { TodayTab } from '@/components/persona/TodayTab';
import { ArchiveTab } from '@/components/persona/ArchiveTab';
import { PrivacyFooter } from '@/components/persona/PrivacyFooter';
import { AskBossButton } from '@/components/boss-ai';
import { STAGE_META } from '@/lib/persona/stage-meta';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import type { Persona } from '@/lib/types/persona';

// ---------------------------------------------------------------------------
// Demo 回退: 未同步 / 未初始化时用
// ---------------------------------------------------------------------------

const DEMO_PERSONA: Persona = {
  id: 'persona_demo',
  userId: 'demo-user',
  schemaVersion: 'tandem.v1',
  stage: 'apprentice',
  stageEnteredAt: new Date(Date.now() - 35 * 86400 * 1000).toISOString(),
  delegationLevel: 'report_only',
  decisionHistory: {
    totalDecisions: 47,
    selfMade: 38,
    aiAssisted: 9,
    vetoedByUser: 3,
    vetoRate: 0.064,
  },
  styleProfile: {
    decisionSpeed: 'medium',
    riskAppetite: 0.4,
    communicationStyle: 'analytical',
    preferredOptions: [
      'SOP',
      'reasoning',
      'historical',
      'reasoning',
      'original',
    ],
    communicationExamples: [],
  },
  growthAreas: [
    {
      id: 'growth_1',
      category: '决策风格',
      description: '近期偏好 AI 推演 (B 选项), 建议主动尝试 D 原创方案',
      identifiedAt: new Date().toISOString(),
      status: 'identified',
    },
  ],
  bossCaptureScore: 28,
  dataOwnership: {
    companyOwnsData: true,
    anonymizationPending: false,
    employeeCanExportOrigins: true,
  },
  learningActive: true,
  createdAt: new Date(Date.now() - 35 * 86400 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// 主页 (suspense wrapper, 因为 useSearchParams 必须在 Suspense 下)
// ---------------------------------------------------------------------------

export default function PersonaPage() {
  return (
    <Suspense
      fallback={
        <main className="container mx-auto max-w-3xl px-4 py-8">
          <div className="text-caption text-tertiary">加载学员主页…</div>
        </main>
      }
    >
      <PersonaPageInner />
    </Suspense>
  );
}

function PersonaPageInner() {
  const userId = useCurrentUserId();
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const activeTab: PersonaTab = isPersonaTab(tabParam) ? tabParam : 'today';

  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetch(`/api/persona/${encodeURIComponent(userId)}`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancel) return;
        setPersona(j?.persona ?? null);
      })
      .catch(() => {
        if (!cancel) setPersona(null);
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [userId]);

  const view = persona ?? DEMO_PERSONA;
  const isDemo = !loading && !persona;

  // P1 mock: 待办课/badges 数; P1.5 真接入 brief API 后从 streaming 数据计算
  const badges = useMemo<Partial<Record<PersonaTab, number>>>(
    () => ({ today: 2 }),
    [],
  );

  const stageMeta = STAGE_META[view.stage];
  return (
    <main className="container mx-auto max-w-3xl space-y-5 px-4 py-6">
      {/* Hero · 学员证 (含 5 主修网格) */}
      <StudentCard persona={view} isDemo={isDemo} />

      {/* §灵魂入口深链 · 给学员一个"问老板我怎么晋升"的快捷 */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <AskBossButton
          prompt={`我现在是 Lv.${stageMeta.level} ${stageMeta.title}, 综合 GPA ${view.bossCaptureScore}/100. 我下一阶段晋升缺什么? 应该先训练哪个主修方向?`}
          task={`Persona 阶段咨询: Lv.${stageMeta.level} ${stageMeta.title}`}
        >
          问老板我怎么晋升
        </AskBossButton>
        <AskBossButton
          variant="pill"
          prompt={`我应该如何训练我的主分身让它代我做更多事? 我现在的代行权限够不够用?`}
          task={`Persona 训练咨询: delegationLevel=${view.delegationLevel}`}
        >
          我该怎么训练分身
        </AskBossButton>
      </div>

      {/* 4 面 tab */}
      <CourseTabs active={activeTab} badges={badges} />

      {/* tab content */}
      {activeTab === 'today' && <TodayTab />}
      {activeTab === 'archive' && <ArchiveTab persona={view} />}

      {/* 校规与权益 (折叠) */}
      <PrivacyFooter />
    </main>
  );
}
