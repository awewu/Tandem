'use client';

import { ScrollText } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function CertificationsPage() {
  return (
    <PlaceholderPage
      icon={ScrollText}
      title="我的认证"
      subtitle="已获得的能力凭证 · 时效跟踪"
      pillar="拿捏 · 学习中心"
      phase="P2 MVP · 即将上线"
      features={[
        '入职必修认证 (一次性)',
        '合规季度认证 (每季度刷新)',
        '产品/流程认证 (按需续期)',
        '专项认证 (含晋升解锁标识)',
        '认证作为 KR 完成度的一种类型 (E1)',
      ]}
    />
  );
}
