'use client';

import { useEffect, useState } from 'react';
import { PersonaDashboard } from '@/components/persona/PersonaDashboard';
import { useCurrentUserId } from '@/lib/hooks/use-current-user';
import type { Persona } from '@/lib/types/persona';

// Demo 回退: 未同步 / 未初始化时用
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
    preferredOptions: ['SOP', 'reasoning', 'historical', 'reasoning', 'original'],
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

export default function PersonaPage() {
  const userId = useCurrentUserId();
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

  // 在加载或未初始化时回退 demo, 避免空页
  const view = persona ?? DEMO_PERSONA;

  return (
    <main className="container mx-auto max-w-3xl py-6 px-4">
      {loading && (
        <div className="text-xs text-muted-foreground mb-3">加载中…</div>
      )}
      {!loading && !persona && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
          未检测到你的 Persona 记录, 展示为示范数据. 首次质押决策后会自动初始化.
        </div>
      )}
      <PersonaDashboard persona={view} />
    </main>
  );
}
