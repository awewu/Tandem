'use client';

import { Workflow } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function ProcessesPage() {
  return (
    <PlaceholderPage
      icon={Workflow}
      title="流程与标准"
      subtitle="日常事务 SOP · 不学不会用"
      pillar="拿捏 · 学习中心"
      phase="P2 MVP · 即将上线"
      features={[
        '决议流程 SOP (来自 /memories?type=sop)',
        '报销与采购',
        '招聘与绩效',
        '项目管理标准',
        '完成 → PM Mode Proficiency +N',
      ]}
    />
  );
}
