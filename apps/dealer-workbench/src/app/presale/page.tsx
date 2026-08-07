'use client';

import { PageHeader } from '@rhautt/ui';
import { PresaleWorkbench } from '../../components/PresaleWorkbench';

export default function PresalePage() {
  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container" style={{ display: 'grid', gap: 20, maxWidth: 'none', width: '100%' }}>
        <PageHeader
          title="售前专业度"
          subtitle="AI 问诊 · 选型计算(合规闸) · 报价 —— 技术支持止于售前的门面"
        />
        <PresaleWorkbench />
      </div>
    </div>
  );
}
