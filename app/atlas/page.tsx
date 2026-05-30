'use client';

/**
 * /atlas — 中央 AI 独立栏 (Tandem Atlas)
 *
 * 决议来源: docs/PLATFORM-ARCHITECTURE-2026-05-29.md
 *   D13 三层 AI: 通用 / 中央 (本栏) / 个人主分身
 *   D15 中央 AI 独立 UI: 路由 /atlas, 4 大栏目 (公司大脑相关)
 *   G2 数据红线网关: 中央 AI 不读个人 IM/邮箱/通用 AI 沙盒
 *   G3 Skill 署名 + 撤回 + 复议
 *
 * 注: 公司之声 / 入职教师 等内容生产/HR 培训型模块, 归属 /intranet 与 /learning,
 *     不在中央 AI 调度范围. /atlas 只管 AI 工具/Memory/合规守护.
 *
 * Phase 1 = 骨架壳, 4 个栏目占位, Skill Market + Memory Atlas 优先实装 (Phase 2).
 */

import Link from 'next/link';
import {
  Bell,
  BookHeart,
  Brain,
  Compass,
  Sparkles,
  Store,
  type LucideIcon,
} from 'lucide-react';

interface AtlasSection {
  id: string;
  title: string;
  icon: LucideIcon;
  desc: string;
  href?: string;             // 已实装 → 跳转
  status: 'p1' | 'p2' | 'p3'; // 阶段
  guardrail?: string;        // 关联宪章护栏
}

const SECTIONS: AtlasSection[] = [
  {
    id: 'skill-market',
    title: 'Skill Market',
    icon: Store,
    desc: '技能市场 · 贡献 / 订阅 / 评分. 上架走宪章 §13 四道关, 贡献者署名 + 撤回 + 复议三段式.',
    href: '/skills',
    status: 'p2',
    guardrail: 'G3 / §13',
  },
  {
    id: 'memory-atlas',
    title: 'Memory Atlas',
    icon: Brain,
    desc: '公司决议地图. 可问答 "上次 X 怎么决的", 由签名链溯源.',
    href: '/memories',
    status: 'p2',
    guardrail: '§9',
  },
  {
    id: 'alerts',
    title: '监控告警',
    icon: Bell,
    desc: 'OKR 偏差 · 决策卡风险 · 合规扫描. 走数据红线网关, 不读个人 IM / 邮箱 / 通用 AI 沙盒.',
    status: 'p3',
    guardrail: 'G2 / §19',
  },
  {
    id: 'steward',
    title: 'Steward 副驾',
    icon: Compass,
    desc: '公司级决策的 AI 顾问, 给 3+1 选项, 不替高管拍板 (宪章 §2).',
    href: '/admin/steward',
    status: 'p3',
    guardrail: '§2',
  },
];

// 归属修正 (2026-05-29):
//   - 「公司之声」已下架: 跟 /intranet/leadership + /intranet/town-hall 重复, 属内网门户而非中央 AI
//   - 「入职教师」已下架: 属学院模块 (/learning/onboarding), 不属中央 AI 调度
//   /atlas 仅保留中央 AI 调度自身相关的栏目 (Skill Market / Memory Atlas / 监控告警 / Steward 副驾)

const STATUS_META: Record<AtlasSection['status'], { label: string; pill: string }> = {
  p1: { label: 'P1 已上线', pill: 'pill-brand' },
  p2: { label: 'P2 进行中', pill: 'pill-neutral' },
  p3: { label: 'P3 计划中', pill: 'pill-neutral' },
};

export default function AtlasPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-8">
      {/* Hero */}
      <section className="hero-ink rounded-3xl p-8 shadow-soft-lg">
        <div className="flex items-center gap-2 text-white/70 text-caption mb-3">
          <Sparkles className="h-4 w-4" />
          <span>中央 AI · Tandem Atlas</span>
        </div>
        <h1 className="text-title-1 text-white">公司大脑.</h1>
        <p className="mt-3 text-body text-white/75 max-w-2xl">
          Tandem Atlas 是公司的中央 AI: 调度技能市场、绘制决议地图、监控合规与 OKR 偏差,
          为公司级决策提供 3+1 副驾建议. 它不读个人 IM 与邮箱, 也不替高管拍板.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/skills"
            className="inline-flex items-center gap-2 rounded-full bg-white text-[rgb(var(--rheem-ink-black))] px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/90"
          >
            <Store className="h-4 w-4" /> 进入技能市场
          </Link>
          <Link
            href="/memories"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/10"
          >
            <Brain className="h-4 w-4" /> 公司决议地图
          </Link>
          <Link
            href="/docs/MANIFESTO"
            className="inline-flex items-center gap-2 rounded-full border border-white/30 text-white px-4 py-2 text-caption font-medium surface-interactive hover:bg-white/10"
          >
            <BookHeart className="h-4 w-4" /> 产品宪章
          </Link>
        </div>
      </section>

      {/* 6 大栏目 */}
      <section className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const meta = STATUS_META[s.status];
          const card = (
            <article
              className="surface-card rounded-2xl p-5 shadow-soft-xs h-full flex flex-col gap-3
                         surface-interactive hover:shadow-soft-sm"
            >
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="rounded-md bg-[rgb(var(--brand-50))] p-2 text-[rgb(var(--brand-600))]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-title-3 text-primary truncate">{s.title}</h3>
                </div>
                <span className={meta.pill}>{meta.label}</span>
              </header>
              <p className="text-caption text-secondary leading-relaxed">{s.desc}</p>
              {s.guardrail && (
                <div className="text-footnote text-tertiary">
                  护栏: <span className="text-primary">{s.guardrail}</span>
                </div>
              )}
            </article>
          );
          return s.href ? (
            <Link key={s.id} href={s.href} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={s.id} className="h-full">{card}</div>
          );
        })}
      </section>

      {/* 数据红线说明 */}
      <section className="surface-card-soft rounded-2xl p-5">
        <h2 className="text-headline text-primary mb-2">数据红线 (G2)</h2>
        <ul className="text-caption text-secondary space-y-1 list-disc list-inside">
          <li>中央 AI 只读 已公开的 OKR · 决策卡 · 合规风险线索.</li>
          <li>不读 个人 IM 内容 · 个人邮箱 · 通用 AI 沙盒会话.</li>
          <li>越界请求自动拒绝并入 <code className="text-primary">/admin/audit</code> 审计日志.</li>
        </ul>
      </section>

      <footer className="text-footnote text-tertiary text-center pt-2">
        Tandem Atlas v1.0 骨架 · 见 <code>docs/PLATFORM-ARCHITECTURE-2026-05-29.md §D15 / §G2 / §G3 / §G4</code>
      </footer>
    </div>
  );
}
