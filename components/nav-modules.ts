/**
 * Navigation modules (single source of truth for AppRail + SubSidebar).
 *
 * Each module = one Rail icon. Items inside it render in the SubSidebar
 * when the module is active. Role-based visibility is enforced both at
 * module level (whole bucket hidden) and item level (individual entry hidden).
 *
 * Active detection: the module whose pathPrefixes contain the longest match
 * with the current pathname wins. Falls back to 'home' if nothing matches.
 */

import {
  Home,
  Target,
  MessagesSquare,
  BookOpen,
  ListChecks,
  Sparkles,
  Building2,
  Wrench,
  Settings,
  // item icons
  Sparkles as SparklesAlias,
  Grid3x3,
  MessageSquare,
  Video,
  FileText,
  Database,
  Brain,
  HardDrive,
  Search,
  ClipboardCheck,
  Workflow,
  Clock3,
  CalendarDays,
  Bell,
  Users,
  Layers,
  Bot,
  Cpu,
  Ticket,
  ShieldCheck,
  ScrollText,
  Megaphone,
  FileLock,
  PartyPopper,
  Gift,
  Mail,
  Inbox,
  Send,
  LayoutGrid,
  CheckSquare,
  Palette,
  Lock,
  Plus,
  UserPlus,
  Activity,
} from 'lucide-react';

export type Role = 'employee' | 'manager' | 'steward' | 'admin' | 'champion';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  visibleTo?: Role[]; // undefined = visible to all
  /**
   * Visual emphasis. `cta` renders as a Rheem-red filled call-to-action
   * (used for high-frequency actions like "新建群聊" so they stand out
   * from passive nav links). Default = normal nav item.
   */
  accent?: 'cta';
  /**
   * Optional grouping label. Items sharing the same `group` render under
   * the same uppercase mini-header in the SubSidebar (Linear/Raycast style).
   * Group order = first-occurrence order in the items array.
   * Items without `group` render in an unlabeled lead section.
   */
  group?: string;
}

export interface NavModule {
  id: string;
  label: string;                   // short label under rail icon (2-3 chars ideal)
  fullLabel: string;               // long label for sub-sidebar header
  /**
   * One-line spirit / guiding principle. Shown:
   *   · As the second line of the Rail hover tooltip (after fullLabel)
   *   · As the subtitle row under fullLabel in the SubSidebar header
   * Use it to remind users *why* this module exists, not what it does.
   */
  tagline?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** All path prefixes this module owns. Longest match wins for active state. */
  pathPrefixes: string[];
  items: NavItem[];                // empty array = no sub-sidebar (e.g. home)
  visibleTo?: Role[];              // whole module hidden if role mismatch
}

export const NAV_MODULES: NavModule[] = [
  {
    id: 'home',
    label: '首页',
    fullLabel: '首页',
    icon: Home,
    pathPrefixes: ['/'],
    items: [], // home has no sub-sidebar
  },

  {
    id: 'okr',
    label: '事半',
    fullLabel: '事半 · 目标与反馈',
    tagline: '围绕 OKR 推进, 不跑偏才能事半功倍',
    icon: Target,
    pathPrefixes: ['/okr', '/360', '/1on1', '/nine-box', '/insights', '/analytics', '/kpi', '/tti'],
    items: [
      // 绩效 KPI (年度硬指标, 只读)
      { name: '我的 KPI',          href: '/kpi',              icon: Target,         group: '绩效 KPI' },
      // TTI 四要素 (软目标, 自主填报)
      { name: '我的 TTI 四要素',    href: '/tti',              icon: SparklesAlias,  group: 'TTI 成长', accent: 'cta' },
      // 目标管理
      { name: '我的 OKR',          href: '/okr?owner=me',     icon: Target,         group: '目标管理' },
      { name: 'OKR 5 层 Cascade',  href: '/okr/cascade',      icon: Target,         group: '目标管理' },
      { name: '部门 Dashboard',    href: '/okr/dashboard',    icon: Grid3x3,        group: '目标管理', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: 'OKR 日历',          href: '/okr/calendar',     icon: CalendarDays,   group: '目标管理' },
      // 反馈评估
      { name: '1on1 对话',         href: '/1on1',             icon: MessagesSquare, group: '反馈评估' },
      { name: '360 评估',          href: '/360',              icon: SparklesAlias,  group: '反馈评估' },
      { name: '9 宫格',            href: '/nine-box',         icon: Grid3x3,        group: '反馈评估', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: '9-box 联动建议',    href: '/nine-box/suggestions', icon: Grid3x3,    group: '反馈评估', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      // 分析洞察
      { name: 'AI 智能信号',       href: '/insights',         icon: SparklesAlias,  group: '分析洞察' },
      { name: '组织分析',          href: '/analytics',        icon: Grid3x3,        group: '分析洞察', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
    ],
  },

  {
    id: 'comm',
    label: '沟通',
    fullLabel: '沟通 · IM 与议事',
    tagline: '17 分钟达成共识, 把闲聊沉淀为决议',
    icon: MessagesSquare,
    // /chat moved to `me` (单聊 LLM 是个人 AI 工具, 不属于团队沟通)
    pathPrefixes: ['/im', '/convergence', '/meetings', '/decision-card'],
    items: [
      // 高频发起 (CTA, 顶部)
      { name: '新建群聊', href: '/im?new=1',   icon: Plus,     accent: 'cta', group: '发起' },
      { name: '找人私聊', href: '/im?dm=new',  icon: UserPlus, accent: 'cta', group: '发起' },
      // 沟通工具 — 议事室前置 (差异化核心)
      { name: '议事室',   href: '/convergence', icon: SparklesAlias, badge: '17min', group: '沟通' },
      { name: 'IM 协同',  href: '/im',          icon: MessagesSquare,                group: '沟通' },
      { name: '会议室',   href: '/meetings',    icon: Video,                          group: '沟通' },
    ],
  },

  {
    id: 'kb',
    label: '知识',
    fullLabel: '知识 · 文档与检索',
    tagline: '让组织记忆持续生长, 而非随员工流失',
    icon: BookOpen,
    // /search 移除 (⌘K Command Palette 已覆盖全局搜索)
    pathPrefixes: ['/documents', '/knowledge', '/memories', '/drive'],
    items: [
      { name: '文档协作',     href: '/documents', icon: FileText },
      { name: 'Memory 知识库', href: '/memories',  icon: Brain },
      { name: '知识图谱',     href: '/knowledge', icon: Database },
      { name: '云盘',         href: '/drive',     icon: HardDrive },
    ],
  },

  {
    id: 'flow',
    label: '流程',
    fullLabel: '流程 · 审批与日程',
    tagline: '日常事务自动跑, 把时间还给思考',
    icon: ListChecks,
    // /report 移到拿捏 · /notifications 由 AppRail 顶部 bell 承担 · /calendar 移到日程并入 comm
    pathPrefixes: ['/approvals', '/workflows', '/calendar'],
    items: [
      { name: '审批流',  href: '/approvals',  icon: ClipboardCheck },
      { name: '工作流',  href: '/workflows',  icon: Workflow },
      { name: '日程',    href: '/calendar',   icon: CalendarDays },
    ],
  },

  {
    id: 'me',
    label: '拿捏',
    fullLabel: '拿捏 · 个人成长 & AI',
    tagline: '一个 AI 分身陪你长大, 拿捏老板拿捏未来',
    icon: Sparkles,
    pathPrefixes: ['/persona', '/skills', '/agents', '/chat', '/report'],
    items: [
      // 我的成长
      { name: '我的分身',   href: '/persona',           icon: Users,         group: '我的成长' },
      { name: '成长路径',   href: '/persona/evolution', icon: SparklesAlias, group: '我的成长' },
      { name: '我的技能',   href: '/skills',            icon: Layers,        group: '我的成长' },
      { name: '学习路径',   href: '/skills/learning',   icon: SparklesAlias, group: '我的成长' },
      // 每日记录
      { name: '5min 日报',  href: '/report',            icon: Clock3,        group: '每日记录' },
      // AI 协作
      { name: 'AI 一对一',  href: '/chat',              icon: MessageSquare, group: 'AI 协作' },
      { name: 'AI 助手',    href: '/agents',            icon: Bot,           group: 'AI 协作' },
    ],
  },

  {
    id: 'mail',
    label: '邮箱',
    fullLabel: '邮箱 · 对外正式沟通',
    tagline: '正式承诺与外部协同, 留痕可追溯',
    icon: Mail,
    pathPrefixes: ['/mail'],
    items: [
      { name: '收件箱', href: '/mail',                  icon: Inbox },
      { name: '写邮件', href: '/mail?tab=compose',      icon: Send, accent: 'cta' },
      { name: '已发送', href: '/mail?folder=sent',      icon: Send },
      { name: '草稿',   href: '/mail?folder=drafts',    icon: FileText },
      { name: '星标',   href: '/mail?folder=starred',   icon: SparklesAlias },
    ],
  },

  {
    id: 'intranet',
    label: '内网',
    fullLabel: '企业内网 · 公告与大事记',
    tagline: '同一频道听公司心跳, 不再错过关键播报',
    icon: Megaphone,
    pathPrefixes: ['/intranet'],
    // 注: /intranet 页面自带横向 TopSubnav (公告/政策/大事记/福利),
    // SubSidebar 不再重复, 只保留与横轴互补的入口 (CEO 直通车 / A-Z / 论坛 / 编辑入口归 admin).
    items: [
      { name: '内网首页', href: '/intranet', icon: Megaphone },
      { name: 'CEO 直通车', href: '/intranet/town-hall', icon: Megaphone },
      { name: 'A-Z 资源', href: '/intranet/a-z', icon: FileLock },
      { name: '内部论坛', href: '/intranet/forum', icon: PartyPopper },
    ],
  },

  {
    id: 'org',
    label: '组织',
    fullLabel: '组织 · 公司架构',
    tagline: '看清架构与节奏, 协作不再各干各',
    icon: Building2,
    pathPrefixes: ['/organization'],
    items: [
      { name: '组织架构',   href: '/organization',           icon: Building2 },
      { name: '部门列表',   href: '/organization?view=departments', icon: Users },
      { name: '三省六部制', href: '/organization?view=ministries',  icon: Layers },
    ],
  },

  {
    id: 'admin',
    label: '管理',
    fullLabel: '管理 · 系统与运维',
    tagline: 'Steward 守护治理, 让规则可解释可追溯',
    icon: Wrench,
    pathPrefixes: ['/admin', '/mcp', '/tasks', '/logs', '/design'],
    visibleTo: ['admin', 'steward', 'champion'],
    items: [
      // 用户与权限
      { name: '邀请用户',       href: '/admin/invite',        icon: Ticket,        group: '用户与权限', visibleTo: ['admin', 'champion'] },
      { name: 'Steward 工作台', href: '/admin/steward',       icon: ShieldCheck,   group: '用户与权限', visibleTo: ['steward', 'admin', 'champion'] },
      // KPI 设置 (CHARTER-KPI-TTI)
      { name: 'KPI 科目主数据', href: '/admin/kpi/subjects',         icon: Layers,        group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      { name: 'KPI 周期与目标',  href: '/admin/kpi/setup',            icon: Target,        group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      { name: 'KPI 人工补录',      href: '/admin/kpi/manual-entry',     icon: ScrollText,    group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      { name: 'KPI 健康度看板',  href: '/admin/kpi/health-dashboard', icon: Grid3x3,       group: 'KPI 设置', visibleTo: ['admin', 'champion', 'steward'] },
      { name: 'KPI 分析中枢',    href: '/admin/kpi/analytics',        icon: Activity,      group: 'KPI 设置', visibleTo: ['admin', 'champion', 'steward'] },
      { name: 'KPI 奖金下发',    href: '/admin/kpi/bonus-payout',     icon: ShieldCheck,   group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      // 内容管理
      { name: 'Intranet 编辑',  href: '/admin/intranet',      icon: Megaphone,     group: '内容管理', visibleTo: ['admin', 'champion'] },
      { name: 'Launchpad 管理', href: '/admin/launchpad',     icon: LayoutGrid,    group: '内容管理', visibleTo: ['admin', 'champion'] },
      { name: 'Baseline',       href: '/admin/baseline',      icon: ScrollText,    group: '内容管理', visibleTo: ['admin', 'champion'] },
      // 系统运维
      { name: 'TAF Skills',     href: '/admin/tandem-skills', icon: Layers,        group: '系统运维', visibleTo: ['admin'] },
      { name: '定时任务',       href: '/tasks',               icon: CheckSquare,   group: '系统运维', visibleTo: ['admin'] },
      { name: '系统日志',       href: '/logs',                icon: FileText,      group: '系统运维', visibleTo: ['admin'] },
      // 工程参考
      { name: 'MCP 工具',       href: '/mcp',                 icon: Cpu,           group: '工程参考', visibleTo: ['admin'] },
      { name: '设计语言',       href: '/design',              icon: Palette,       group: '工程参考' },
    ],
  },

  {
    id: 'settings',
    label: '设置',
    fullLabel: '设置',
    icon: Settings,
    pathPrefixes: ['/settings'],
    items: [
      { name: '个人设置',     href: '/settings',               icon: Settings },
      { name: '外观与品牌',   href: '/settings/appearance',    icon: Palette },
      { name: '邮箱配置',     href: '/settings/email',         icon: Mail },
      { name: '通知偏好',     href: '/notifications',          icon: Bell },
      { name: '§13 数据自助', href: '/settings/privacy',       icon: Lock },
    ],
  },
];

export const ALL_ROLES: Role[] = ['admin', 'champion', 'steward', 'manager', 'employee'];

export function isVisible(scopeRoles: Role[] | undefined, userRoles: Role[]): boolean {
  if (!scopeRoles || scopeRoles.length === 0) return true;
  return scopeRoles.some((r) => userRoles.includes(r));
}

/**
 * Find which module owns the given pathname. Picks the module whose
 * pathPrefix has the longest match (so /admin/launchpad beats /admin's
 * shorter prefix against home's `/`).
 *
 * Returns 'home' as fallback for paths nothing else claims.
 */
export function activeModuleId(pathname: string | null | undefined): string {
  if (!pathname) return 'home';
  let bestId = 'home';
  let bestLen = 0;
  for (const m of NAV_MODULES) {
    for (const p of m.pathPrefixes) {
      // Exact '/' only matches '/'
      if (p === '/') {
        if (pathname === '/' && bestLen === 0) bestId = m.id;
        continue;
      }
      if (pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?')) {
        if (p.length > bestLen) {
          bestLen = p.length;
          bestId = m.id;
        }
      }
    }
  }
  return bestId;
}
