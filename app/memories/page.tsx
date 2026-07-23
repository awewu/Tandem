'use client';

import { TandemMemoryDigest } from '@/components/memories/tandem-memory-digest';
import { MemoryBrowser } from '@/components/memories/memory-browser';

export default function MemoriesPage() {
  // 组织记忆模块只承载【公司权威记忆】(company/dept/team, 经签批喂 AI)。
  // 私人记事本已归位「搭子手抄」(私人空间, 公司不读不蒸馏) —— 不再在此出现。
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4">
        <TandemMemoryDigest />
        <MemoryBrowser />
      </div>
    </div>
  );
}
