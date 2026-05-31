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
  BotMessageSquare,
  BarChart3,
  TrendingUp,
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
  Compass,
  Store,
  Bell as BellAlias,
  GraduationCap,
  Network,
} from 'lucide-react';

export type Role = 'employee' | 'manager' | 'steward' | 'admin' | 'champion' | 'owner' | 'partner';

/** 内部员工角色集合（不含合作伙伴） */
export const INTERNAL_ROLES: Role[] = ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'];
/** 合作伙伴可见的模块/功能 */
export const PARTNER_ALLOWED_MODULES = ['ai', 'settings'] as const;

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
    id: 'tandem',
    label: 'Tandem',
    fullLabel: 'Tandem · 个人工作台',
    tagline: '1 舞台 + 2 召唤 · 身份在左 / 行动在右',
    icon: Sparkles,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // /tandem 内部自有 1+2 召唤布局, 不需 SubSidebar (items=[] = sub-sidebar.tsx 返回 null).
    pathPrefixes: ['/tandem'],
    items: [],
  },

  {
    id: 'okr',
    label: '事半',
    fullLabel: '事半 · 目标与反馈',
    tagline: '围绕 OKR 推进, 不跑偏才能事半功倍',
    icon: Target,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    pathPrefixes: ['/okr', '/insights', '/analytics', '/kpi', '/tti', '/report'],
    items: [
      // 绩效目标 (KPI 年度硬指标, 只读)
      { name: '我的绩效目标',       href: '/kpi',              icon: BarChart3,      group: 'KPI 绩效达成' },
      { name: '部门绩效对比',       href: '/kpi?view=dept',    icon: TrendingUp,     group: 'KPI 绩效达成', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      // 目标管理 (精简为符合 Tita 极简逻辑 of 3步流程)
      { name: '我的目标与对齐',    href: '/okr?owner=me',     icon: Target,         group: '目标与关键成果法 OKR' },
      { name: '日常推进 (TTI)',    href: '/tti',              icon: SparklesAlias,  group: '目标与关键成果法 OKR' },
      { name: '团队效能 Dashboard',href: '/okr/dashboard',    icon: Grid3x3,        group: '目标与关键成果法 OKR', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: 'OKR 5 层级联树',    href: '/okr/cascade',      icon: Network,        group: '目标与关键成果法 OKR' },
      { name: 'OKR 日历视图',      href: '/okr/calendar',     icon: CalendarDays,   group: '目标与关键成果法 OKR' },
      // 每日推进 — 5min 日报与周回顾 (OKR daily/weekly check-in 输入, 与KR互动推进)
      { name: '5min 智能日报', href: '/report',         icon: Clock3,        group: '每日推进', accent: 'cta' },
      { name: '本周回顾',      href: '/report/weekly',  icon: CalendarDays,  group: '每日推进' },
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
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // /chat moved to `me` (单聊 LLM 是个人 AI 工具, 不属于团队沟通)
    pathPrefixes: ['/im', '/convergence', '/meetings'],
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
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // /search 移除 (⌘K Command Palette 已覆盖全局搜索)
    pathPrefixes: ['/documents', '/knowledge', '/memories', '/drive', '/bitable'],
    items: [
      { name: '文档协作',     href: '/documents', icon: FileText },
      { name: 'Memory 知识库', href: '/memories',  icon: Brain },
      { name: '知识图谱',     href: '/knowledge', icon: Database },
      { name: '多维表格',     href: '/bitable',   icon: LayoutGrid },
      { name: '云盘',         href: '/drive',     icon: HardDrive },
    ],
  },

  {
    id: 'flow',
    label: '流程',
    fullLabel: '流程 · 审批与日程',
    tagline: '日常事务自动跑, 把时间还给思考',
    icon: ListChecks,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
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
    fullLabel: '拿捏 · 个人成长',
    tagline: '认识自己、积累技能, 让成长看得见',
    icon: Sparkles,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    pathPrefixes: ['/persona', '/skills', '/learning', '/portfolio', '/retros', '/360', '/nine-box'],
    items: [
      // 我的分身 — SUMMON-AND-NURTURE V1 必交付 (B1-B4)
      { name: '我的分身',     href: '/persona',            icon: Users,            group: '🤖 我的分身' },
      { name: '分身训练台',   href: '/persona/training',   icon: BotMessageSquare, group: '🤖 我的分身' },
      { name: '养料仪表盘',   href: '/persona/data-source', icon: Database,        group: '🤖 我的分身' },
      { name: '五阶段进化',   href: '/persona/evolution',  icon: SparklesAlias,    group: '🤖 我的分身' },
      { name: '实习权限',     href: '/persona/delegation', icon: ShieldCheck,      group: '🤖 我的分身' },

      // 自我画像 — 我是谁
      { name: '个人档案',     href: '/persona/profile',    icon: Users,            group: '📊 自我画像' },
      { name: '360° 评估',    href: '/360',                icon: Activity,         group: '📊 自我画像' },
      { name: '9-Box 定位',    href: '/nine-box',           icon: Grid3x3,          group: '📊 自我画像' },

      // 技能与成长 — 我会什么
      { name: '我的技能',     href: '/skills',             icon: Layers,           group: '🎓 技能与成长' },
      { name: '学习路径推荐', href: '/skills/learning',    icon: SparklesAlias,    group: '🎓 技能与成长' },
      { name: '我的复盘库',   href: '/retros/me',          icon: Brain,            group: '🎓 技能与成长' },
      { name: '我的代表作',   href: '/portfolio',          icon: Gift,             group: '🎓 技能与成长' },

      // 📚 学习中心 — 我在学什么 (P2 MVP)
      { name: '学习台',         href: '/learning',                  icon: BookOpen,        accent: 'cta', group: '📚 学习中心' },
      { name: '入职必修',     href: '/learning/onboarding',       icon: PartyPopper,                    group: '📚 学习中心' },
      { name: '合规与红线',   href: '/learning/compliance',       icon: FileLock,                       group: '📚 学习中心' },
      { name: '产品学院',     href: '/learning/products',         icon: Layers,                         group: '📚 学习中心' },
      { name: '流程与标准',   href: '/learning/processes',        icon: Workflow,                       group: '📚 学习中心' },
      { name: '专项进阶',     href: '/learning/tracks',           icon: TrendingUp,                     group: '📚 学习中心' },
      { name: '我的认证',     href: '/learning/certifications',   icon: ScrollText,                     group: '📚 学习中心' },
    ],
  },

  {
    id: 'ai',
    label: '搭子',
    fullLabel: '召唤搭子',
    tagline: '一个 AI 分身陪你长大, 拿捏老板拿捏未来',
    icon: BotMessageSquare,
    pathPrefixes: ['/chat', '/agents', '/settings/llm', '/summon'],
    items: [
      // 🌟 主分身工作台 — 今日 brief + 代办审计 (P1 MVP)
      { name: '主分身工作台',   href: '/persona',                  icon: BotMessageSquare, accent: 'cta', group: '🌟 主分身工作台' },
      { name: '主分身代办审计', href: '/persona/me/proxy-actions', icon: Activity,                       group: '🌟 主分身工作台' },

      // 🧬 技能模式 — 同一主分身参数切换 (不是新 Agent)
      { name: '🎨 设计模式',   href: '/persona?mode=design',     icon: Palette,                        group: '🧬 技能模式' },
      { name: '📦 PM 模式',      href: '/persona?mode=pm',         icon: ClipboardCheck,                 group: '🧬 技能模式' },
      { name: '💻 技术模式',   href: '/persona?mode=tech',       icon: Cpu,                            group: '🧬 技能模式' },
      { name: '📣 营销模式',   href: '/persona?mode=marketing',  icon: Megaphone,                      group: '🧬 技能模式' },
      { name: '🎯 战略模式',   href: '/persona?mode=strategy',   icon: Target,                         group: '🧬 技能模式' },

      // 🌉 个人 AI 接入 — MANIFESTO §19 拥抱市面智能体 + Skill Gateway 4 道闸 (P4 加固)
      { name: '接入市面智能体', href: '/summon/external',         icon: Bot,                            group: '🌉 个人 AI 接入' },
      { name: 'Skill Gateway 审计', href: '/summon/audit',          icon: ShieldCheck,                    group: '🌉 个人 AI 接入' },

      // ⚙️ 召唤台 + 配置
      { name: '作战室对话',     href: '/chat',                     icon: MessageSquare,                  group: '⚙️ 召唤台 + 配置' },
      { name: 'Agent 超市',     href: '/agents',                   icon: Bot,                            group: '⚙️ 召唤台 + 配置' },
      { name: '模型设置',       href: '/settings/llm',             icon: Cpu,                            group: '⚙️ 召唤台 + 配置' },
    ],
  },

  {
    id: 'mail',
    label: '邮箱',
    fullLabel: '邮箱 · 对外正式沟通',
    tagline: '正式承诺与外部协同, 留痕可追溯',
    icon: Mail,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
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
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    pathPrefixes: ['/intranet'],
    // /intranet 全部导航走 app/intranet/layout.tsx 的横向 IntranetSubnav.
    // SubSidebar 在此模块不渲染 (items=[] 时 sub-sidebar.tsx 返回 null).
    items: [],
  },

  {
    id: 'org',
    label: '组织',
    fullLabel: '组织 · 公司架构与治理',
    tagline: '部门是人归属哪里, 三省六部是事如何流转',
    icon: Building2,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    pathPrefixes: ['/organization', '/governance', '/admin/organization', '/360', '/1on1', '/nine-box'],
    items: [
      // 公司架构 (HR 部门线 · 真员工数据)
      { name: '员工部门',       href: '/admin/organization',           icon: Building2, group: '公司架构', visibleTo: ['manager', 'steward', 'admin', 'champion', 'owner'] },
      // 项目治理 (三省六部 · 跨部门协同模板)
      { name: '三省六部 · 项目治理', href: '/governance/three-departments', icon: Network,   group: '项目治理' },
      // 反馈评估 (现在归属组织模块)
      { name: '1on1 对话',         href: '/1on1',             icon: MessagesSquare, group: '反馈评估' },
      { name: '360 评估',          href: '/360',              icon: SparklesAlias,  group: '反馈评估', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: '9 宫格',            href: '/nine-box',         icon: Grid3x3,        group: '反馈评估', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: '9-box 联动建议',    href: '/nine-box/suggestions', icon: Grid3x3,    group: '反馈评估', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
    ],
  },

  {
    id: 'admin',
    label: '管理',
    fullLabel: '管理 · 系统与运维',
    tagline: 'Steward 守护治理, 让规则可解释可追溯',
    icon: Wrench,
    pathPrefixes: ['/admin', '/mcp', '/tasks', '/logs', '/design', '/governance'],
    visibleTo: ['admin', 'steward', 'champion'],
    items: [
      // 用户与权限
      { name: '邀请用户',       href: '/admin/invite',        icon: Ticket,        group: '用户与权限', visibleTo: ['admin', 'champion'] },
      { name: 'Steward 工作台', href: '/admin/steward',       icon: ShieldCheck,   group: '用户与权限', visibleTo: ['steward', 'admin', 'champion'] },
      { name: '员工部门 (HR)',  href: '/admin/organization',  icon: Users,         group: '用户与权限', visibleTo: ['admin', 'champion'] },
      { name: '外部协作申请',   href: '/admin/user-applications', icon: Ticket,     group: '用户与权限', visibleTo: ['admin', 'owner'] },
      // KPI 设置 (CHARTER-KPI-TTI)
      { name: 'KPI 科目主数据', href: '/admin/kpi/subjects',         icon: Layers,        group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      { name: 'KPI 周期与目标',  href: '/admin/kpi/setup',            icon: Target,        group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      { name: 'KPI 人工补录',      href: '/admin/kpi/manual-entry',     icon: ScrollText,    group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      { name: 'KPI 健康度看板',  href: '/admin/kpi/health-dashboard', icon: Grid3x3,       group: 'KPI 设置', visibleTo: ['admin', 'champion', 'steward'] },
      { name: 'KPI 分析中枢',    href: '/admin/kpi/analytics',        icon: Activity,      group: 'KPI 设置', visibleTo: ['admin', 'champion', 'steward'] },
      { name: 'KPI 奖金下发',    href: '/admin/kpi/bonus-payout',     icon: ShieldCheck,   group: 'KPI 设置', visibleTo: ['admin', 'champion'] },
      // 中央 AI 治理 (灵魂层第 2 + 6 条 · CA-13 + B-015)
      { name: 'CompanyBrain 看板',     href: '/admin/company-brain',          icon: Brain,    group: '中央 AI 治理', visibleTo: ['steward', 'admin', 'champion'] },
      { name: 'OKR 主航道偏离',         href: '/admin/governance/okr-drift',   icon: Target,   group: '中央 AI 治理', visibleTo: ['steward', 'admin', 'champion'] },
      // 内容管理
      { name: 'Intranet 编辑',  href: '/admin/intranet',      icon: Megaphone,     group: '内容管理', visibleTo: ['admin', 'champion'] },
      { name: 'Launchpad 管理', href: '/admin/launchpad',     icon: LayoutGrid,    group: '内容管理', visibleTo: ['admin', 'champion'] },
      { name: 'Baseline',       href: '/admin/baseline',      icon: ScrollText,    group: '内容管理', visibleTo: ['admin', 'champion'] },
      // 系统运维
      { name: 'TAF Skills',     href: '/admin/tandem-skills', icon: Layers,        group: '系统运维', visibleTo: ['admin'] },
      { name: '使用 + 成本',    href: '/admin/usage',         icon: Activity,      group: '系统运维', visibleTo: ['admin'] },
      { name: 'AI 评估',        href: '/admin/evals',         icon: Sparkles,      group: '系统运维', visibleTo: ['admin', 'steward'] },
      { name: '定时任务',       href: '/tasks',               icon: CheckSquare,   group: '系统运维', visibleTo: ['admin'] },
      { name: '系统日志',       href: '/logs',                icon: FileText,      group: '系统运维', visibleTo: ['admin'] },
      // 工程参考
      { name: 'MCP 工具',       href: '/mcp',                 icon: Cpu,           group: '工程参考', visibleTo: ['admin'] },
      { name: '设计语言',       href: '/design',              icon: Palette,       group: '工程参考' },
    ],
  },

  {
    id: 'atlas',
    label: 'Atlas',
    fullLabel: 'Atlas · 公司中央 AI',
    tagline: '调度技能市场、决议地图、公司之声',
    icon: Brain,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // /atlas 独立栏, items=[] 不走 SubSidebar (页内自有栏目网格).
    pathPrefixes: ['/atlas'],
    items: [],
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

export const ALL_ROLES: Role[] = ['owner', 'admin', 'champion', 'steward', 'manager', 'employee', 'partner'];

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
