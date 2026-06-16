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
  // item icons
  Sparkles as SparklesAlias,
  Grid3x3,
  Video,
  ScrollText,
  FileText,
  Database,
  Brain,
  HardDrive,
  Search,
  ClipboardCheck,
  Workflow,
  Clock3,
  CalendarDays,
  Users,
  Bot,
  Cpu,
  Megaphone,
  Mail,
  Inbox,
  Send,
  LayoutGrid,
  Palette,
  Lock,
  Plus,
  UserPlus,
  Activity,
  Compass,
  Store,
  GraduationCap,
  Network,
} from 'lucide-react';

export type Role = 'employee' | 'manager' | 'steward' | 'admin' | 'champion' | 'owner' | 'partner';

/** 内部员工角色集合（不含合作伙伴） */
export const INTERNAL_ROLES: Role[] = ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'];
/** 合作伙伴可见的模块/功能 */
export const PARTNER_ALLOWED_MODULES = ['dazi', 'settings'] as const;

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
  /**
   * Hub 子页 tab (二级页面范式): 重模块把“功能多”的子页收进 Hub,
   * 子页通过内容区顶部的 <HubTabs> 横向 tab 到达, 而非平铺在 SubSidebar.
   */
  tabs?: { name: string; href: string; visibleTo?: Role[] }[];
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
    fullLabel: '事半 · 战略执行基座',
    tagline: '围绕 OKR 推进, 战略执行与目标达成的核心基座',
    icon: Target,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    pathPrefixes: ['/okr', '/insights', '/analytics', '/kpi', '/tti', '/report'],
    items: [
      // KPI = BSC 底线绩效结果 (年度硬指标, 100% 才达标, 与奖金挂钩; KPI 只关联 BSC). 只读.
      { name: '绩效记分卡',         href: '/kpi',              icon: BarChart3,      group: 'KPI · BSC 底线绩效' },
      // TTI = 事半主轴 (前瞻提升轨, 60-70% 即健康, 与薪资分离). /tti=四要素填报, 与 /okr 同源互为镜像.
      { name: 'TTI（Target to Improve）牵引', href: '/tti',     icon: Activity,       group: '目标与关键成果法 OKR' },
      // 目标管理 (精简为符合 Tita 极简逻辑 of 3步流程)
      { name: '我的目标与对齐',    href: '/okr?owner=me',     icon: Target,         group: '目标与关键成果法 OKR' },
      { name: 'OKR 5 层级联树',    href: '/okr/cascade',      icon: Network,        group: '目标与关键成果法 OKR' },
      // 双入口: 战略项目走三省六部执行协同 (主高亮归 Tandem 议事模块, 此处仅可点直达).
      { name: '战略项目 · 三省六部', href: '/governance/three-departments', icon: Network, group: '目标与关键成果法 OKR' },
      { name: 'OKR 校准会',        href: '/okr/calibration',  icon: Grid3x3,        group: '目标与关键成果法 OKR', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
      { name: 'OKR 日历视图',      href: '/okr/calendar',     icon: CalendarDays,   group: '目标与关键成果法 OKR' },
      // 每日推进 (5min 日报 / 周回顾) 主入口已迁往「搭子 · 个人工作台」(每天和分身一起干活);
      // 因日报是 KR check-in 输入会回填进度, 此处保留一个深链, 做 OKR 的人仍可直达.
      { name: '每日推进 (日报 / 周回顾)', href: '/report', icon: Clock3, group: '目标与关键成果法 OKR' },
      // 经营推演 (FP&A 引擎: 成本中心 BSC + OKR 驱动交付基线; 高亮稳定归事半, 不弹跳 Tandem)
      { name: 'FP&A 经营推演',     href: '/okr/fpa',          icon: Building2,      group: '经营推演 FP&A' },
      // 分析洞察
      { name: 'AI 智能信号',       href: '/insights',         icon: SparklesAlias,  group: '分析洞察' },
      { name: '组织分析',          href: '/analytics',        icon: Grid3x3,        group: '分析洞察', visibleTo: ['manager', 'steward', 'admin', 'champion'] },
    ],
  },

  // ═══ IM · 群与部门协同 ═══
  {
    id: 'im',
    label: 'IM',
    fullLabel: 'IM · 群与部门协同',
    tagline: '群聊与部门协同, 把日常沟通沉淀为组织资产',
    icon: MessagesSquare,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    pathPrefixes: ['/im'],
    items: [
      { name: '消息', href: '/im', icon: MessagesSquare, group: '协同' },
    ],
  },

  // ═══ Tandem · 议事与决议 (会议 / 决议书 / 共同决策 / 重大公司级工作执行协同) ═══
  //
  // ⚠️ TODO(nav-naming): 命名碰撞 — 本模块名为 "Tandem" 但其 pathPrefixes 不含 /tandem;
  //   而路由 /tandem 实际归下方「搭子(dazi)」模块 (个人工作台). 即「叫 Tandem 的模块」
  //   ≠「/tandem 这个页」, 排查/接手极易踩坑. 改路由 (/tandem→/workbench 或本模块→/governance)
  //   有迁移成本, 暂不动; 合并后另起一轮统一. 见复盘 2026-06-09.
  {
    id: 'tandem',
    label: 'Tandem',
    fullLabel: 'Tandem · 议事与决议',
    tagline: '提案·审议·执行 — 重大公司级工作的协同与 17 分钟议事收敛',
    icon: Sparkles,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    pathPrefixes: ['/convergence', '/meetings', '/decisions', '/governance'],
    items: [
      { name: '议事室',   href: '/convergence', icon: SparklesAlias, accent: 'cta', badge: '17min', group: '议事' },
      { name: '会议室',   href: '/meetings',    icon: Video,                        group: '议事' },
      { name: '决议台账', href: '/decisions',   icon: ScrollText,                   group: '决议' },
      // 三省六部 = 提案(中书)→审议(门下)→执行(尚书六部) 的执行协同骨架, 支撑 OKR 战略执行.
      { name: '三省六部 · 执行协同', href: '/governance/three-departments', icon: Network, group: '执行协同' },
    ],
  },

  // ═══ 搭子 · 个人工作台 (用分身) ═══
  {
    id: 'dazi',
    label: '搭子',
    fullLabel: '搭子 · 个人工作台',
    tagline: '每天和你的分身一起干活 · 1 舞台 + 2 召唤',
    icon: BotMessageSquare,
    // ⚠️ 命名碰撞: 路由 /tandem 归本「搭子」模块, 而非上方名为 "Tandem" 的治理模块. 见上方 TODO(nav-naming).
    // /tandem 内部自有 1+2 召唤布局, 不需 SubSidebar (items=[] = sub-sidebar.tsx 返回 null).
    // /chat /agents = 用已固化 agent/Gem 干活, 归搭子 (入口在工作台"通用 AI"召唤).
    // /teammates = AI 同事目录 (中央 AI + 我的搭子, 一键召唤), 概念归搭子; 入口在首页 QuickAction.
    //   搭子无 SubSidebar (会破坏 /tandem 全屏布局), 故仅靠 pathPrefix 高亮 + 首页磁贴可达.
    pathPrefixes: ['/tandem', '/chat', '/agents', '/teammates'],
    items: [],
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
      { name: '组织记忆（需审批）', href: '/memories',  icon: Brain },
      { name: '知识图谱',     href: '/knowledge', icon: Database },
      { name: '多维表格',     href: '/bitable',   icon: LayoutGrid },
      { name: '云盘',         href: '/drive',     icon: HardDrive },
    ],
  },

  // ═══ 日程 · 高频日用 (独立顶级, Teams 式直达) ═══
  {
    id: 'calendar',
    label: '日程',
    fullLabel: '日程 · 我的时间',
    tagline: '会议 / 待办 / Check-in 节奏一屏掌握',
    icon: CalendarDays,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // /calendar 页内自有视图, items=[] 不走 SubSidebar (高频直达)
    pathPrefixes: ['/calendar'],
    items: [],
  },

  {
    id: 'flow',
    label: '流程',
    fullLabel: '流程 · 审批与工作流',
    tagline: '日常事务自动跑, 把时间还给思考',
    icon: ListChecks,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // /calendar 已提为顶级「日程」模块 (高频独立)
    pathPrefixes: ['/approvals', '/workflows'],
    items: [
      { name: '审批流',  href: '/approvals',  icon: ClipboardCheck },
      { name: '工作流',  href: '/workflows',  icon: Workflow },
    ],
  },

  // ═══ 拿捏 · 修炼分身与个人成长 (炼分身 · 学资料 · 调外部 skills) ═══
  {
    id: 'me',
    label: '拿捏',
    fullLabel: '拿捏 · 修炼分身与成长',
    tagline: '炼分身 · 学公司资料 · 调外部 skills, 让成长看得见',
    icon: GraduationCap,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // 注: /360 /nine-box 主高亮归「组织」模块, 此处仅保留可点 item, 不占 pathPrefix.
    // 注: /chat /agents (用 agent 干活) 已移交搭子; 拿捏只留"造/炼"层面.
    pathPrefixes: ['/persona', '/skills', '/learning', '/portfolio', '/retros', '/summon', '/settings/llm'],
    // 4-Hub 重构: 二级栏只留 4 个 Hub 入口, 各 Hub 的子页走页内 <HubTabs> 横向 tab.
    // 技能模式(设计/PM/...)收进 /persona 页内模式切换器, 不占独立项.
    items: [
      {
        name: '我的分身',
        href: '/persona',
        icon: Users,
        tabs: [
          { name: '分身主页', href: '/persona' },
          { name: '训练台', href: '/persona/training' },
          { name: '养料仪表盘', href: '/persona/data-source' },
          { name: '五阶段进化', href: '/persona/evolution' },
          { name: '实习权限', href: '/persona/delegation' },
          { name: '代办审计', href: '/persona/me/proxy-actions' },
        ],
      },
      {
        name: '自我画像与成长',
        href: '/persona/profile',
        icon: Grid3x3,
        tabs: [
          { name: '个人档案', href: '/persona/profile' },
          { name: '360° 评估', href: '/360' },
          { name: '9-Box 定位', href: '/nine-box' },
          { name: '我的技能', href: '/skills' },
          { name: '学习路径推荐', href: '/skills/learning' },
          { name: '我的复盘库', href: '/retros/me' },
          { name: '我的代表作', href: '/portfolio' },
        ],
      },
      {
        name: '学习中心',
        href: '/learning',
        icon: BookOpen,
        tabs: [
          { name: '学习台', href: '/learning' },
          { name: '入职必修', href: '/learning/onboarding' },
          { name: '合规与红线', href: '/learning/compliance' },
          { name: '产品学院', href: '/learning/products' },
          { name: '流程与标准', href: '/learning/processes' },
          { name: '专项进阶', href: '/learning/tracks' },
          { name: '我的认证', href: '/learning/certifications' },
        ],
      },
      {
        name: '寻找外部专家',
        href: '/summon/external',
        icon: Bot,
        tabs: [
          { name: '接入市面智能体', href: '/summon/external' },
          { name: 'Skill Gateway 审计', href: '/summon/audit' },
          { name: '模型设置', href: '/settings/llm' },
        ],
      },
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
    tagline: '部门是人归属哪里, 反馈评估让成长看得见',
    icon: Building2,
    visibleTo: ['employee', 'manager', 'steward', 'admin', 'champion', 'owner'],
    // 三省六部 已迁出: 主高亮归 Tandem(议事)模块「执行协同」, 事半模块设双入口.
    pathPrefixes: ['/organization', '/admin/organization', '/360', '/1on1', '/nine-box'],
    items: [
      // 公司架构 (HR 部门线 · 真员工数据)
      { name: '员工部门',       href: '/admin/organization',           icon: Building2, group: '公司架构', visibleTo: ['manager', 'steward', 'admin', 'champion', 'owner'] },
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
    pathPrefixes: ['/admin', '/mcp', '/tasks', '/logs', '/design'],
    visibleTo: ['admin', 'steward', 'champion'],
    // 6-Hub 重构 (同拿捏范式): 二级栏放 6 个 Hub, 各组子页走页内 <HubTabs> (按角色过滤).
    items: [
      {
        name: '用户与权限',
        href: '/admin/steward',
        icon: Users,
        visibleTo: ['admin', 'champion', 'steward', 'owner'],
        tabs: [
          { name: 'Steward 工作台', href: '/admin/steward', visibleTo: ['steward', 'admin', 'champion'] },
          { name: '邀请用户', href: '/admin/invite', visibleTo: ['admin', 'champion'] },
          { name: '员工部门 (HR)', href: '/admin/organization', visibleTo: ['admin', 'champion'] },
          { name: '上下游组织', href: '/admin/organizations', visibleTo: ['admin', 'owner'] },
          { name: '外部协作申请', href: '/admin/user-applications', visibleTo: ['admin', 'owner'] },
        ],
      },
      {
        name: 'KPI 设置',
        href: '/admin/kpi/setup',
        icon: Target,
        visibleTo: ['admin', 'champion', 'steward'],
        tabs: [
          { name: '周期与目标', href: '/admin/kpi/setup', visibleTo: ['admin', 'champion'] },
          { name: '科目主数据', href: '/admin/kpi/subjects', visibleTo: ['admin', 'champion'] },
          { name: '人工补录', href: '/admin/kpi/manual-entry', visibleTo: ['admin', 'champion'] },
          { name: '健康度看板', href: '/admin/kpi/health-dashboard', visibleTo: ['admin', 'champion', 'steward'] },
          { name: '分析中枢', href: '/admin/kpi/analytics', visibleTo: ['admin', 'champion', 'steward'] },
          { name: '奖金下发', href: '/admin/kpi/bonus-payout', visibleTo: ['admin', 'champion'] },
        ],
      },
      {
        name: '中央 AI 治理',
        href: '/admin/company-brain',
        icon: Brain,
        visibleTo: ['steward', 'admin', 'champion'],
        tabs: [
          { name: 'CompanyBrain 看板', href: '/admin/company-brain', visibleTo: ['steward', 'admin', 'champion'] },
          { name: 'OKR 主航道偏离', href: '/admin/governance/okr-drift', visibleTo: ['steward', 'admin', 'champion'] },
        ],
      },
      {
        name: '内容管理',
        href: '/admin/intranet',
        icon: Megaphone,
        visibleTo: ['admin', 'champion'],
        tabs: [
          { name: 'Intranet 编辑', href: '/admin/intranet', visibleTo: ['admin', 'champion'] },
          { name: 'Launchpad 管理', href: '/admin/launchpad', visibleTo: ['admin', 'champion'] },
          { name: 'Baseline', href: '/admin/baseline', visibleTo: ['admin', 'champion'] },
        ],
      },
      {
        name: '系统运维',
        href: '/admin/usage',
        icon: Activity,
        visibleTo: ['admin', 'steward'],
        tabs: [
          { name: '使用 + 成本', href: '/admin/usage', visibleTo: ['admin'] },
          { name: 'TAF Skills', href: '/admin/tandem-skills', visibleTo: ['admin'] },
          { name: 'AI 评估', href: '/admin/evals', visibleTo: ['admin', 'steward'] },
          { name: '定时任务', href: '/tasks', visibleTo: ['admin'] },
          { name: '系统日志', href: '/logs', visibleTo: ['admin'] },
        ],
      },
      {
        name: '工程参考',
        href: '/design',
        icon: Cpu,
        tabs: [
          { name: '设计语言', href: '/design' },
          { name: 'MCP 工具', href: '/mcp', visibleTo: ['admin'] },
        ],
      },
    ],
  },

  {
    id: 'atlas',
    label: '中枢',
    fullLabel: '中枢 · 公司治理与调度',
    tagline: '技能市场、决议地图、公司之声的中央调度',
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
      { name: '§13 数据自助', href: '/settings/privacy',       icon: Lock },
    ],
  },
];

export const ALL_ROLES: Role[] = ['owner', 'admin', 'champion', 'steward', 'manager', 'employee', 'partner'];

/** auth 外部角色 (lib/auth/roles.ts EXTERNAL_ROLES). nav 只用 'partner' 表达外部视图. */
const EXTERNAL_AUTH_ROLES = new Set(['guest', 'partner', 'contractor']);

export function isVisible(scopeRoles: Role[] | undefined, userRoles: Role[]): boolean {
  if (!scopeRoles || scopeRoles.length === 0) return true;
  return scopeRoles.some((r) => userRoles.includes(r));
}

/**
 * 把 auth 角色解析为导航可见性角色集 (SSOT, 供 AppRail / MobileDrawer 复用).
 * - 未发起 fetch: 默认 employee (避免闪烁)
 * - 未登录: ALL_ROLES (登录页等公开壳不依赖此)
 * - admin@tandem.local 无角色: ALL_ROLES (bootstrap)
 * - 命中已知 nav 角色: 原样返回
 * - 纯外部角色 (guest/contractor 等 nav 未登记): 统一映射为 partner 视图 (只见授权模块)
 * - 其它空: employee
 */
export function resolveNavRoles(
  authRoles: readonly string[] | undefined,
  opts?: { fetched?: boolean; unauthenticated?: boolean; email?: string },
): Role[] {
  if (opts && opts.fetched === false) return ['employee'];
  if (opts?.unauthenticated) return ALL_ROLES;
  const known = (authRoles ?? []).filter(
    (x): x is Role => typeof x === 'string' && (ALL_ROLES as string[]).includes(x),
  );
  if (opts?.email === 'admin@tandem.local' && known.length === 0) return ALL_ROLES;
  if (known.length > 0) return known;
  if ((authRoles ?? []).some((r) => EXTERNAL_AUTH_ROLES.has(r))) return ['partner'];
  return ['employee'];
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
