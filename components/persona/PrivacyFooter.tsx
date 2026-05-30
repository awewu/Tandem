'use client';

/**
 * PrivacyFooter · 校规与权益 (collapsible)
 *
 * 立项: docs/ACADEMY-METAPHOR-2026-05-29.md
 * 设计语言: MANIFESTO §20 + docs/CHARTER-UI-V1.md
 *   - surface-card-soft 折叠容器
 *   - text-caption 正文
 */

import { Shield, ChevronRight } from 'lucide-react';

const ITEMS: Array<{ title: string; body: string }> = [
  {
    title: '学籍归属',
    body: '学籍数据所有权归公司 (按法定要求保留)',
  },
  {
    title: '学员尊严',
    body: '离职后画像匿名化, 公司只保留聚合贡献, 不留个人画像',
  },
  {
    title: '导出权',
    body: '员工随时可导出 ORIGIN 原始学习记录 (走 /persona/data-source)',
  },
  {
    title: '否决权',
    body: '对 AI 提交的任何代行决议, 24h 内可撤回',
  },
  {
    title: '私密性',
    body: '主分身 brief / 学习记录 / 召唤对话 — Steward / Admin / 主管后台无权检索',
  },
  {
    title: '个人 AI 接入',
    body: '员工自由用市面任何 AI (Claude / Cursor / Kimi / Hermes ...), 通过 MCP 走 Skill Gateway 4 道闸 (MANIFESTO §19)',
  },
];

export function PrivacyFooter() {
  return (
    <details className="group surface-card-soft p-4 sm:p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-body font-medium text-secondary list-none">
        <Shield className="h-4 w-4 text-tertiary" />
        <span className="text-primary">📜 校规与权益</span>
        <span className="text-tertiary">· 数据归属铁律 (MANIFESTO §13)</span>
        <ChevronRight className="ml-auto h-4 w-4 text-tertiary transition-transform group-open:rotate-90" />
      </summary>
      <ul className="mt-4 space-y-2 text-caption text-secondary">
        {ITEMS.map((it) => (
          <li key={it.title} className="leading-relaxed">
            <span className="font-semibold text-primary">{it.title}:</span>{' '}
            {it.body}
          </li>
        ))}
      </ul>
    </details>
  );
}
