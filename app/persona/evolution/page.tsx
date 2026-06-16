'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StageProgressDashboard } from '@/components/persona/StageProgressDashboard';
import { DelegationConsole, type DelegationSettings } from '@/components/persona/DelegationConsole';
import { UpgradeProposalBanner } from '@/components/persona/UpgradeProposalBanner';
import { ReflexionLogPanel } from '@/components/persona/ReflexionLogPanel';
import { Card, CardContent } from '@/components/ui/card';
import type { StageProgress } from '@/lib/persona/learning-collector';
import type { Persona } from '@/lib/types/persona';

const DEMO_USER_ID = 'demo-user';

export default function PersonaEvolutionPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') ?? 'progress') as 'progress' | 'delegation' | 'reflexion';
  const [progress, setProgress] = useState<StageProgress | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [tab, setTab] = useState<'progress' | 'delegation' | 'reflexion'>(
    ['progress', 'delegation', 'reflexion'].includes(initialTab) ? initialTab : 'progress',
  );

  async function fetchProgress() {
    const res = await fetch(`/api/persona/${DEMO_USER_ID}/progress`);
    if (res.ok) {
      const data = await res.json();
      setProgress(data.progress);
      setPersona(data.persona);
    }
  }

  useEffect(() => {
    void fetchProgress();
  }, []);

  return (
    <main className="container mx-auto max-w-3xl space-y-4 px-4 py-6 md:px-8">
      <h1 className="text-title-3 font-bold">主分身 · 进阶轨迹 (新手 → 拿手)</h1>
      <p className="text-caption text-muted-foreground">
        Tandem autonomy 守门: 任何升级与实习权限 (代行边界) 都由员工本人确认.
      </p>

      {/* cron 识别的高风险升级提议 (assistant→deputy / deputy→partner) — 始终置顶 */}
      {persona && (
        <UpgradeProposalBanner persona={persona} onChanged={fetchProgress} />
      )}

      <div className="flex gap-2 border-b">
        <TabBtn active={tab === 'progress'} onClick={() => setTab('progress')}>
          进化进度
        </TabBtn>
        <TabBtn active={tab === 'delegation'} onClick={() => setTab('delegation')}>
          代行控制台
        </TabBtn>
        <TabBtn active={tab === 'reflexion'} onClick={() => setTab('reflexion')}>
          学到的教训
        </TabBtn>
      </div>

      {tab === 'progress' &&
        (progress && persona ? (
          <StageProgressDashboard
            progress={progress}
            bossCaptureScore={persona.bossCaptureScore}
            onConfirmUpgrade={async () => {
              const res = await fetch('/api/tandem/persona/upgrade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ personaId: persona.id }),
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                window.alert(`升级失败: ${err.error ?? res.statusText}`);
              }
              void fetchProgress();
            }}
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              加载 Persona 数据中...
            </CardContent>
          </Card>
        ))}

      {tab === 'delegation' && persona && (
        <DelegationConsole
          initial={getInitialSettings(persona)}
          onSave={async (s) => {
            await fetch(`/api/persona/${persona.id}/delegation`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(s),
            });
          }}
          onKillSwitch={async () => {
            await fetch(`/api/persona/${persona.id}/kill-switch`, { method: 'POST' });
            void fetchProgress();
          }}
        />
      )}

      {tab === 'reflexion' && <ReflexionLogPanel />}
    </main>
  );
}

function getInitialSettings(persona: Persona): DelegationSettings {
  return {
    learningActive: persona.learningActive,
    allowedScenarios: { chat: true, email: true, standup: true, meeting: false },
    topicBlacklist: [],
    dailyTokenBudget: 100_000,
    killSwitchEngaged: false,
  };
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-1.5 text-caption font-medium transition ${
        active
          ? 'border-warning text-warning'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
