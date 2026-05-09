'use client';

import { useEffect, useState } from 'react';
import { StageProgressDashboard } from '@/components/persona/StageProgressDashboard';
import { DelegationConsole, type DelegationSettings } from '@/components/persona/DelegationConsole';
import { Card, CardContent } from '@/components/ui/card';
import type { StageProgress } from '@/lib/persona/learning-collector';
import type { Persona } from '@/lib/types/persona';

const DEMO_USER_ID = 'demo-user';

export default function PersonaEvolutionPage() {
  const [progress, setProgress] = useState<StageProgress | null>(null);
  const [persona, setPersona] = useState<Persona | null>(null);
  const [tab, setTab] = useState<'progress' | 'delegation'>('progress');

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
    <main className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">拿捏老板分身 · 进化与控制</h1>
      <p className="text-sm text-muted-foreground">
        Tandem autonomy 守门: 任何升级与代行边界都由员工本人确认.
      </p>

      <div className="flex gap-2 border-b">
        <TabBtn active={tab === 'progress'} onClick={() => setTab('progress')}>
          进化进度
        </TabBtn>
        <TabBtn active={tab === 'delegation'} onClick={() => setTab('delegation')}>
          代行控制台
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
      className={`border-b-2 px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-amber-500 text-amber-700'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
