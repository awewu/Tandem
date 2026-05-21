'use client';

/**
 * /intranet/a-z — A-Z 全部资源索引 stub.
 *
 * RheemNet 风格的资源字母索引. V1 用 seed 数据, M3 接资源库后改为真实索引.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

interface Resource {
  name: string;
  href: string;
  desc?: string;
}

const RESOURCES: Resource[] = [
  { name: 'AI 使用红线', href: '/intranet/posts/h4', desc: '涉客户数据需经 Steward 批准' },
  { name: 'OKR 节奏手册', href: '/okr', desc: '季度 / 周对齐节奏' },
  { name: 'OKR 周记模板', href: '/report', desc: '5 分钟日报标准格式' },
  { name: '差旅政策 v1.4', href: '/intranet/posts/n3', desc: '国内出差日补 +50' },
  { name: '差旅报销流程', href: '/approvals', desc: '在审批中心提交' },
  { name: '议事室手册', href: '/convergence', desc: '17 分钟达成共识' },
  { name: '健康关怀计划', href: '/intranet/posts/h3', desc: '春季体检报名' },
  { name: 'IM 使用规范', href: '/im', desc: '决议型已读 · 不焦虑' },
  { name: 'IP / 知识产权', href: '/intranet/posts/ip', desc: '发明专利申报' },
  { name: '组织架构', href: '/organization', desc: '部门 / 小组 / 岗位' },
  { name: 'Persona AI 分身', href: '/persona', desc: '陪你长大的 AI' },
  { name: 'Persona 进化报告', href: '/persona/evolution', desc: 'Skill / Memory 成长' },
  { name: 'Q2 OKR 全员对齐', href: '/intranet/posts/n1', desc: '5 月 15 日 14:00' },
  { name: '人才发展通道', href: '/persona/evolution', desc: '员工成长地图' },
  { name: '入职指南', href: '/intranet/posts/onboarding', desc: '前 30 天必读' },
  { name: 'Steward 工作台', href: '/admin/steward', desc: '治理 / 红线值守' },
  { name: 'Town Hall 回放', href: '/intranet/town-hall', desc: 'CEO 直通车' },
  { name: '招聘 / 内推', href: '/intranet/posts/careers', desc: '内推奖金 + 流程' },
  { name: '组织里程碑', href: '/intranet/posts/h1', desc: '议事室上线 100 天' },
  { name: '知识库 / Memory', href: '/memories', desc: '500+ SOP 沉淀' },
  { name: '工程平台', href: '/intranet/posts/eng', desc: 'Engineering 工具栈' },
  { name: '邮箱使用规范', href: '/settings/email', desc: '正式承诺与外部协同' },
  { name: '云盘 / 文件', href: '/drive', desc: '团队共享存储' },
  { name: 'Q&A · CEO', href: '/intranet/forum?room=ceo-feedback', desc: '匿名意见箱' },
];

function groupByLetter(list: Resource[]): Record<string, Resource[]> {
  const out: Record<string, Resource[]> = {};
  for (const r of list) {
    const ch = r.name[0]?.toUpperCase() ?? '#';
    const key = /[A-Z]/.test(ch) ? ch : '中文';
    if (!out[key]) out[key] = [];
    out[key].push(r);
  }
  return out;
}

export default function AZPage() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return RESOURCES;
    return RESOURCES.filter((r) =>
      r.name.toLowerCase().includes(q) || (r.desc?.toLowerCase().includes(q) ?? false),
    );
  }, [query]);

  const grouped = useMemo(() => groupByLetter(filtered), [filtered]);
  const keys = Object.keys(grouped).sort((a, b) => {
    if (a === '中文') return 1;
    if (b === '中文') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="page-container py-10 max-w-5xl space-y-8">
      <Link
        href="/intranet"
        className="inline-flex items-center gap-1.5 text-caption text-brand-600 hover:text-brand-700 font-medium"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回公司动态
      </Link>

      <header className="space-y-2">
        <p className="text-footnote uppercase tracking-wider text-ink-tertiary">A-Z INDEX</p>
        <h1 className="text-title-1 text-ink-primary">全部资源 A 到 Z</h1>
        <p className="text-body text-ink-secondary">
          {RESOURCES.length} 项 · 涵盖政策 / 工具 / 流程 / 福利 / 知识库
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-tertiary" />
        <input
          type="search"
          placeholder="搜索资源 ..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 h-10 rounded-md border border-border bg-surface-1 text-caption text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-500))]/40"
        />
      </div>

      {keys.length === 0 ? (
        <div className="card-elevated p-12 text-center text-caption text-ink-tertiary">
          没有匹配的资源
        </div>
      ) : (
        <div className="space-y-8">
          {keys.map((letter) => (
            <section key={letter}>
              <h2 className="rheem-display text-title-2 text-[rgb(var(--brand-500))] mb-3">
                {letter}
              </h2>
              <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {grouped[letter].map((r) => (
                  <li key={r.href + r.name}>
                    <Link
                      href={r.href}
                      className="block card-elevated p-3 surface-interactive hover:border-brand-200"
                    >
                      <p className="text-caption font-semibold text-ink-primary">{r.name}</p>
                      {r.desc && (
                        <p className="mt-0.5 text-footnote text-ink-tertiary line-clamp-1">
                          {r.desc}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-footnote text-ink-tertiary italic pt-6 border-t border-border">
        V1 seed · 资源清单当前为静态. M3 接 IntranetResource 表后启用真实编辑 + 权限.
      </p>
    </div>
  );
}
