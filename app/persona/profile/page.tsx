'use client';

import { Users } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function ProfilePage() {
  return (
    <PlaceholderPage
      icon={Users}
      title="个人档案"
      subtitle="我是谁 · 标签 / 经历 / 风格 / 偏好"
      pillar="拿捏 · 自我画像"
      phase="P0 IA 占位 · 后续合并到 /persona 主页 tab"
      features={[
        '基础信息 (来自 PG User 表)',
        '个性标签与工作风格',
        '简历 / 经历沉淀',
        '与 360° / 9-Box 数据双向关联',
      ]}
      fallback={{ label: '查看我的分身主页', href: '/persona' }}
    />
  );
}
