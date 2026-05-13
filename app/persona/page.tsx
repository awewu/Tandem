'use client';

import { PersonaDashboard } from '@/components/persona/PersonaDashboard';
import type { Persona } from '@/lib/types/persona';

// V1 demo: 静态 fixture; M3 接 /api/persona/me
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
    avgDecisionQuality: 0.72,
    krHitRate: 0.81,
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
  return (
    <main className="container mx-auto max-w-3xl py-6 px-4">
      <PersonaDashboard persona={DEMO_PERSONA} />
    </main>
  );
}
