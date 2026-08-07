'use client';

import { PageHeader } from '@rhautt/ui';
import { DealerCockpit } from '../../components/DealerCockpit';

export default function DealerPage() {
  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container" style={{ display: 'grid', gap: 20, maxWidth: 'none', width: '100%' }}>
        <PageHeader
          title="我的工作台"
          subtitle="经销商视角：我的线索 · 客户 · 报价历史 · 业绩（本账号数据）"
        />
        <DealerCockpit />
      </div>
    </div>
  );
}
