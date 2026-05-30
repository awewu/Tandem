'use client';

import { Bot } from 'lucide-react';
import { PlaceholderPage } from '@/components/placeholder-page';

export default function ExternalAiPage() {
  return (
    <PlaceholderPage
      icon={Bot}
      title="接入市面智能体"
      subtitle="拥抱市面 AI · MANIFESTO §19 拥抱个人 AI"
      pillar="搭子 · 个人 AI 接入"
      phase="P4 加固 + v2 BYOK · 落地中"
      features={[
        'Claude Code · Cursor · ChatGPT · Notion AI · Kimi (H1 首批 5 个)',
        '员工自带 key (BYOK) 不消耗公司 token (v2)',
        '所有调用走 Skill Gateway 4 道闸',
        '个人 AI 产出反哺组织: IDE 插件 / 邮件 webhook / 文档 metadata',
        'Tandem 不重发明个人 AI · 做组织级网关',
      ]}
      relatedDoc="MANIFESTO"
      fallback={{ label: '审计 Skill Gateway 调用', href: '/summon/audit' }}
    />
  );
}
