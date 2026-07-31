import { FolderOpen } from 'lucide-react';
import { PageHeader } from '@rhautt/ui';
import GrowthMaterialsTable from '../../../components/GrowthMaterialsTable';

export default function GrowthMaterialsPage() {
  return (
    <div style={{ background: 'linear-gradient(to bottom, var(--surface-1) 0%, var(--surface-2) 100%)', minHeight: '100%' }}>
      <div className="page-container" style={{ display: 'grid', gap: 20 }}>
        <PageHeader
          title="营销物料库管理"
          subtitle="基础营销物料的新增、编辑、下载与归档"
          actions={
            <span className="badge badge-info">
              <FolderOpen size={13} />
              独立管理页
            </span>
          }
        />
        <GrowthMaterialsTable />
      </div>
    </div>
  );
}
