#!/usr/bin/env node
/**
 * §CHARTER-UI-V1 lint · 扫描 raw Tailwind 违规
 *
 * 不依赖 ESLint plugin (零安装). 直接 ripgrep-style 扫 *.tsx.
 *
 * 用法:
 *   node scripts/check-ui-charter.mjs                # 扫全项目 (allowlist 过滤)
 *   node scripts/check-ui-charter.mjs --fix-hint     # 输出修复建议
 *   node scripts/check-ui-charter.mjs --strict       # 退出码 1 (CI 用)
 *
 * 退出码:
 *   0 = 无违规 (或 strict 关闭)
 *   1 = 有违规 + --strict 模式
 *
 * 维护:
 *   - 每条规则 = { pattern, hint }
 *   - allowlist 是已知遗留, 应逐步清零
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const STRICT = args.has('--strict');
const HINT = args.has('--fix-hint');

// ─────────────────────────────────────────────────────────────────────
// 规则: pattern (regex) + hint (合规替代方案)
// ─────────────────────────────────────────────────────────────────────
const RULES = [
  {
    name: 'no-raw-zinc-color',
    pattern: /\b(?:text|bg|border|ring)-zinc-\d+/g,
    hint: '走 text-ink-{primary,secondary,tertiary} / surface-card / border via CSS var',
    severity: 'error',
  },
  {
    name: 'no-raw-red-semantic',
    pattern: /\b(?:text|bg|border)-red-\d+/g,
    hint: '走 text-danger / bg-danger/5 / border-danger (charter §1.4 semantic)',
    severity: 'error',
  },
  {
    name: 'no-raw-green-semantic',
    pattern: /\b(?:text|bg|border)-green-\d+/g,
    hint: '走 text-success / bg-success/5 (charter §1.4)',
    severity: 'error',
  },
  {
    name: 'no-raw-amber-semantic',
    pattern: /\b(?:text|bg|border)-amber-\d+/g,
    hint: '走 text-warning / bg-warning/5 (charter §1.4)',
    severity: 'error',
  },
  {
    name: 'no-raw-text-size',
    pattern: /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl)\b(?!-)/g,
    hint: '走 text-{display,title-1,title-2,title-3,headline,body,caption,footnote} (charter §1.2)',
    severity: 'error',
    // §1.2 typography snapshot 2026-05-30 · P1.5 清零 · 已锁档, 新文件不许加
    allowlist: new Set([
      'app/admin/invite/page.tsx',
      'app/bitable/page.tsx',
      'app/calendar/page.tsx',
      'app/intranet/page.tsx',
      'app/knowledge/page.tsx',
      'app/login/page.tsx',
      'app/meetings/room/[id]/page.tsx',
      'app/organization/page.tsx',
      'app/search/page.tsx',
      'app/tandem/page.tsx',
      'components/convergence/ActionItemsForm.tsx',
      'components/convergence/ContextPanel.tsx',
      'components/convergence/DeliberationFeed.tsx',
      'components/decision-card/HeatMap.tsx',
      'components/documents/collab-textarea.tsx',
      'components/empty-state.tsx',
      'components/error-boundary.tsx',
      'components/hero-carousel.tsx',
      'components/im/contacts-tree.tsx',
      'components/markdown-renderer.tsx',
      'components/okr/okr-trend-chart.tsx',
      'components/persona/CourseTabs.tsx',
      'components/persona/DelegationConsole.tsx',
      'components/persona/StudentCard.tsx',
      'components/persona/TodayTab.tsx',
      'components/trust-banner.tsx',
      'components/voice-input-button.tsx',
      // UI primitives (shadcn-derived) - typography 不在此层管控, 由消费方
      'components/ui/badge.tsx',
      'components/ui/button.tsx',
      'components/ui/card.tsx',
      'components/ui/dialog.tsx',
      'components/ui/input.tsx',
      'components/ui/label.tsx',
      'components/ui/select.tsx',
      'components/ui/switch.tsx',
      'components/ui/tabs.tsx',
      'components/ui/textarea.tsx',
    ]),
  },
  {
    name: 'no-raw-rounded-xl',
    pattern: /\brounded-xl\b/g,
    hint: '改用 rounded-2xl (charter §1.7 corner radius)',
    severity: 'error',
    // §1.7 corner-radius snapshot 2026-05-30 · P1.5 清零
    allowlist: new Set([
      'app/intranet/page.tsx',
      'components/hero-carousel.tsx',
      'components/persona/CourseTabs.tsx',
      'components/persona/StudentCard.tsx',
    ]),
  },
  {
    // §1 motion: charter §1.10 motion language — 必须走 --duration-* / --ease-* CSS var
    // 不允许 raw "transition-{all,colors,...} duration-NNN" 组合 (旧 Tailwind 默认值, 跟 design-tokens 不一致)
    // 2026-05-30 P3.F 清零 (12 → 0), 提为 error 防止再加新债.
    name: 'no-raw-motion-duration',
    pattern: /\btransition-(?:all|colors|transform|opacity|shadow)\s+duration-\d+/g,
    hint: '走 CSS var: style={{ transitionDuration: "var(--duration-fast)", transitionTimingFunction: "var(--ease-standard)" }} 或 globals.css 里的语义类 (.surface-interactive / .card-elevated)',
    severity: 'error',
    // 已清零, allowlist 为空 (任何新加 = PR 打回)
    allowlist: new Set([]),
  },
  {
    name: 'no-raw-tailwind-shadow',
    pattern: /\bshadow-(?:sm|md|lg|xl)\b(?!-soft)/g,
    hint: '走 shadow-soft-{xs,sm,lg,xl} (charter §1.8)',
    severity: 'error',
    // §1.3/§1.8 shadow snapshot 2026-05-30 · P1.5 清零
    allowlist: new Set([
      'app/bitable/page.tsx',
      'app/calendar/page.tsx',
      'app/tandem/page.tsx',          // §1.8 false-positive: 注释里的反例
      'components/error-boundary.tsx',
      'components/hero-carousel.tsx',
      'components/persona/CourseTabs.tsx',
      'components/persona/StudentCard.tsx',
      'components/ui/card.tsx',
      'components/ui/dialog.tsx',
      'components/ui/select.tsx',
      'components/ui/switch.tsx',
      'components/voice-input-button.tsx',
    ]),
  },
];

// ─────────────────────────────────────────────────────────────────────
// allowlist · pre-existing 历史债 (snapshot 2026-05-29) · P1.5 清零
//
// 加入规则:
//   - 只有这份名单里的文件被允许残留 error 级违规
//   - 加新文件 = 重 PR 评审 (不要再制造新债)
//   - 删一个 = 真清零了一个, 永久从这里 rm
// ─────────────────────────────────────────────────────────────────────
const ALLOWLIST = new Set([
  // app/ · 业务页 (有 raw color 违规)
  'app/1on1/page.tsx',
  'app/360/page.tsx',
  'app/admin/company-brain/page.tsx',
  'app/admin/governance/okr-drift/page.tsx',
  'app/admin/intranet/page.tsx',
  'app/admin/kpi/analytics/page.tsx',
  'app/admin/kpi/bonus-payout/page.tsx',
  'app/admin/kpi/health-dashboard/page.tsx',
  'app/admin/kpi/manual-entry/page.tsx',
  'app/admin/kpi/setup/page.tsx',
  'app/admin/kpi/subjects/page.tsx',
  'app/admin/launchpad/page.tsx',
  'app/admin/organization/page.tsx',
  'app/admin/steward/page.tsx',
  'app/admin/tandem-skills/page.tsx',
  'app/agents/page.tsx',
  'app/analytics/page.tsx',
  'app/approvals/page.tsx',
  'app/bitable/[id]/page.tsx',
  'app/chat/page.tsx',
  'app/design/page.tsx',
  'app/documents/[id]/page.tsx',
  'app/documents/page.tsx',
  'app/drive/page.tsx',
  'app/im/page.tsx',
  'app/insights/page.tsx',
  'app/kpi/page.tsx',
  'app/logs/page.tsx',
  'app/mail/page.tsx',
  'app/mcp/page.tsx',
  'app/meetings/page.tsx',
  'app/memories/page.tsx',
  'app/nine-box/page.tsx',
  'app/nine-box/suggestions/page.tsx',
  'app/notifications/page.tsx',
  'app/okr/calendar/page.tsx',
  'app/okr/dashboard/page.tsx',
  'app/okr/page.tsx',
  'app/partner/join/page.tsx',
  'app/persona/evolution/page.tsx',
  'app/persona/me/proxy-actions/page.tsx',
  'app/persona/training/page.tsx',
  'app/register/employee/page.tsx',
  'app/register/page.tsx',
  'app/report/page.tsx',
  'app/report/weekly/page.tsx',
  'app/settings/email/page.tsx',
  'app/settings/llm/page.tsx',
  'app/settings/page.tsx',
  'app/skills/page.tsx',
  'app/tasks/page.tsx',
  'app/tti/page.tsx',
  'app/workflows/page.tsx',
  // components/
  'components/animated-hero.tsx',
  'components/convergence/ConvergenceRoom.tsx',
  'components/dashboard/pending-retros-card.tsx',
  'components/dashboard/workbench-agent-view.tsx',
  'components/decision-card/DecisionCardView.tsx',
  'components/file-manager.tsx',
  'components/hermes-health.tsx',
  'components/im/agent-mode-toggle.tsx',
  'components/im/ai-trace-button.tsx',
  'components/im/channel-settings-dialog.tsx',
  'components/im/company-brain-feedback.tsx',
  'components/im/create-channel-dialog.tsx',
  'components/im/message-reactions.tsx',
  'components/im/seed-from-org-dialog.tsx',
  'components/insights/insights-widget.tsx',
  'components/kpi/ExcelImportExport.tsx',
  'components/memories/tandem-memory-digest.tsx',
  'components/mobile-drawer.tsx',
  'components/nine-box/NineBoxMatrix.tsx',
  'components/okr/okr-activity.tsx',
  'components/okr/okr-alignment-tree.tsx',
  'components/okr/okr-comments.tsx',
  'components/okr/okr-diagnosis-panel.tsx',
  'components/okr/okr-health-panel.tsx',
  'components/okr/okr-initiatives.tsx',
  'components/okr/okr-monthly-comparison.tsx',
  'components/okr/okr-retrospective.tsx',
  'components/okr/okr-scoring.tsx',
  'components/okr/okr-templates.tsx',
  'components/okr/okr-tti-panel.tsx',
  'components/okr/okr-watchers.tsx',
  'components/persona/StageProgressDashboard.tsx',
  'components/persona/UpgradeProposalBanner.tsx',
  'components/placeholder-page.tsx',
  'components/steward/StewardDashboard.tsx',
  'components/sub-sidebar.tsx',
  'components/ui/toast.tsx',
]);

// ─────────────────────────────────────────────────────────────────────
// M1 响应断点 ratchet (2026-05-30) — 扫 app/*/page.tsx 是否带响应断点
// 防止移动端破碎进一步扩散 (51 文件 snapshot allowlist · 渐次清零)
// ─────────────────────────────────────────────────────────────────────
const RESPONSIVE_PAGE_ALLOWLIST = new Set([
  // 51 个 snapshot 2026-05-30 · 渐次清零 (按热度排序: /im /okr /tandem 已含, 此为补丁)
  'app/1on1/page.tsx',
  'app/admin/baseline/page.tsx',
  'app/admin/intranet/page.tsx',
  'app/admin/invite/page.tsx',
  'app/admin/kpi/bonus-payout/page.tsx',
  'app/admin/kpi/setup/page.tsx',
  'app/admin/kpi/subjects/page.tsx',
  'app/admin/launchpad/page.tsx',
  'app/admin/organization/page.tsx',
  'app/approvals/page.tsx',
  'app/bitable/[id]/page.tsx',
  'app/calendar/page.tsx',
  'app/convergence/[id]/page.tsx',
  'app/convergence/page.tsx',
  'app/documents/[id]/page.tsx',
  'app/documents/page.tsx',
  'app/drive/page.tsx',
  'app/intranet/category/[cat]/page.tsx',
  'app/intranet/ethics/page.tsx',
  'app/intranet/posts/[id]/page.tsx',
  'app/knowledge/page.tsx',
  'app/learning/certifications/page.tsx',
  'app/learning/compliance/page.tsx',
  'app/learning/onboarding/page.tsx',
  'app/learning/processes/page.tsx',
  'app/learning/products/page.tsx',
  'app/learning/tracks/page.tsx',
  'app/logs/page.tsx',
  'app/mail/page.tsx',
  'app/memories/page.tsx',
  'app/nine-box/suggestions/page.tsx',
  'app/notifications/page.tsx',
  'app/partner/join/page.tsx',
  'app/persona/data-source/page.tsx',
  'app/persona/delegation/page.tsx',
  'app/persona/evolution/page.tsx',
  'app/persona/me/proxy-actions/page.tsx',
  'app/persona/page.tsx',
  'app/persona/profile/page.tsx',
  'app/portfolio/page.tsx',
  'app/register/employee/page.tsx',
  'app/register/page.tsx',
  'app/retros/me/page.tsx',
  'app/search/page.tsx',
  'app/settings/llm/page.tsx',
  'app/settings/page.tsx',
  'app/settings/privacy/page.tsx',
  'app/summon/audit/page.tsx',
  'app/summon/external/page.tsx',
  'app/tasks/page.tsx',
  'app/workflows/page.tsx',
]);

const RESPONSIVE_BREAKPOINT_REGEX = /\b(?:sm|md|lg|xl|2xl):/;

// ─────────────────────────────────────────────────────────────────────
// 扫描
// ─────────────────────────────────────────────────────────────────────
const SCAN_DIRS = ['app', 'components'];
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (IGNORE_DIRS.has(name)) continue;
      yield* walk(full);
    } else if (name.endsWith('.tsx') || name.endsWith('.ts')) {
      yield full;
    }
  }
}

const violations = [];

for (const top of SCAN_DIRS) {
  const abs = join(ROOT, top);
  try { statSync(abs); } catch { continue; }
  for (const file of walk(abs)) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (ALLOWLIST.has(rel)) continue;
    const src = readFileSync(file, 'utf8');
    const lines = src.split('\n');
    for (const rule of RULES) {
      if (rule.allowlist && rule.allowlist.has(rel)) continue;
      rule.pattern.lastIndex = 0;
      let m;
      while ((m = rule.pattern.exec(src)) !== null) {
        const upToMatch = src.slice(0, m.index);
        const lineNo = upToMatch.split('\n').length;
        violations.push({
          file: rel,
          line: lineNo,
          rule: rule.name,
          match: m[0],
          hint: rule.hint,
          severity: rule.severity,
        });
      }
    }

    // M1 响应断点检查 (仅 app/**/page.tsx, allowlist 跳过)
    // 跳过无 className 的页面 (纯 redirect / 纯 metadata 导出, 没有可响应的布局)
    if (
      rel.startsWith('app/') &&
      rel.endsWith('/page.tsx') &&
      !RESPONSIVE_PAGE_ALLOWLIST.has(rel) &&
      /className\s*=/.test(src)
    ) {
      if (!RESPONSIVE_BREAKPOINT_REGEX.test(src)) {
        violations.push({
          file: rel,
          line: 1,
          rule: 'requires-responsive-layout',
          match: '(无 sm:|md:|lg:|xl: 断点)',
          hint: '加至少 1 个响应断点 (sm:/md:/lg:/xl:) 让小屏不破碎. 主组件可参考 components/mobile-* 现有实现.',
          severity: 'error',
        });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// 输出
// ─────────────────────────────────────────────────────────────────────
const errors = violations.filter((v) => v.severity === 'error');
const warns = violations.filter((v) => v.severity === 'warn');

if (violations.length === 0) {
  console.log('✓ CHARTER-UI-V1 合规 · 0 违规');
  console.log(`  扫描范围: ${SCAN_DIRS.join(' / ')} · allowlist ${ALLOWLIST.size} 条 (KPI 后台遗留)`);
  process.exit(0);
}

const byFile = new Map();
for (const v of violations) {
  if (!byFile.has(v.file)) byFile.set(v.file, []);
  byFile.get(v.file).push(v);
}

console.log(`\n⚠ CHARTER-UI-V1 违规扫描: ${errors.length} error, ${warns.length} warn\n`);
for (const [file, vs] of byFile) {
  console.log(`  ${file}`);
  for (const v of vs) {
    const sym = v.severity === 'error' ? '✗' : '!';
    console.log(`    ${sym} L${v.line}  ${v.rule}  '${v.match}'`);
    if (HINT) console.log(`       → ${v.hint}`);
  }
  console.log('');
}

console.log(`总计: ${violations.length} 条 · allowlist ${ALLOWLIST.size} 文件已跳过 (P1.5 清零)`);
console.log(`提示: 添加 --fix-hint 看建议; --strict CI 用 (有 error 退 1)`);

if (STRICT && errors.length > 0) {
  console.log(`\n✗ STRICT 模式: ${errors.length} error → exit 1`);
  process.exit(1);
}
process.exit(0);
