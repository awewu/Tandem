import { PenTool } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import GrowthCopyTable from '../../../components/GrowthCopyTable';

export default function GrowthCopywriterPage() {
  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container growth-copywriter-page" style={{ display: 'grid', gap: 20 }}>
        <PageHeader
          title="文案库管理"
          subtitle="AI 文案生成、合规审核、归档与复用"
          actions={
            <span className="badge badge-info">
              <PenTool size={13} />
              独立管理页
            </span>
          }
        />
        <GrowthCopyTable />
      </div>
    </div>
  );
}
