import {
  BadgeCheck,
  Boxes,
  FileText,
  Flame,
  FolderOpen,
  Gauge,
  Globe2,
  Landmark,
  Megaphone,
  Package,
  Route,
  Store,
  PenTool,
  Radio,
  Rocket,
  Search,
  Send,
  Settings2,
  Shield,
  UsersRound,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const WORKBENCH_PORTS = {
  dealer: 5000,
  public: 5005,
  nexus: 5010,
  brand: 5012,
  product: 5016,
} as const;

export type WorkbenchChild = {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
};

export type WorkbenchNavItem = {
  key: string;
  label: string;
  shortLabel: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  group: number;
  permission?: string;
  children: WorkbenchChild[];
};

export const WORKBENCH_NAV: WorkbenchNavItem[] = [
  {
    key: 'cockpit',
    label: 'GTM AI驾驶舱',
    shortLabel: '驾驶舱',
    desc: '北极星 · 活跃盈利经销商数 · 网络 GMV · 品牌健康度',
    href: '/cockpit',
    icon: Gauge,
    group: 0,
    permission: 'marketing.campaigns.view',
    children: [
      { key: 'cockpit-northstar', label: '北极星总览', href: '/cockpit', icon: Gauge },
      { key: 'cockpit-cmo', label: 'CMO 管理驾驶舱', href: '/cmo', icon: Gauge },
      { key: 'strategy-overview', label: '集团战略概览', href: '/strategy/overview', icon: Landmark },
      { key: 'strategy-turbine', label: '品牌涡轮', href: '/strategy/brand-turbine', icon: Rocket },
      { key: 'strategy-roadmap', label: '营销战略路线图', href: '/strategy/roadmap', icon: Route },
    ],
  },
  {
    key: 'brand-sites',
    label: '品牌官网管理',
    shortLabel: '品牌官网',
    desc: 'Rheem · Ruud · Everhot 官网与品牌内容',
    href: '/comfort/sites',
    icon: Globe2,
    group: 0,
    permission: 'brand.library.view',
    children: [
      { key: 'sites', label: '品牌官网管理', href: '/comfort/sites', icon: Globe2 },
      { key: 'site-rheem', label: '瑞美 Rheem', href: '/comfort/sites/rheem', icon: BadgeCheck },
      { key: 'site-ruud', label: '瑞德 Ruud', href: '/comfort/sites/ruud', icon: Shield },
      { key: 'site-everhot', label: '恒热 Everhot', href: '/comfort/sites/everhot', icon: Flame },
      { key: 'brand-operations', label: '品牌运营', href: '/brand', icon: Megaphone },
      { key: 'positioning', label: '品牌定位 Messaging House', href: '/positioning', icon: BadgeCheck },
    ],
  },
  // ── 市场增长：功能主栏目已升级为一级菜单（便于一键直达）──
  {
    key: 'geo', label: 'GEO 引擎', shortLabel: 'GEO',
    desc: 'GEO 探测 · AgenticGEO 自主闭环 · 选点/认知资产/引爆',
    href: '/growth/geo', icon: Search, group: 1, permission: 'marketing.campaigns.view',
    children: [
      { key: 'geo', label: 'GEO 探测', href: '/growth/geo', icon: Search },
      { key: 'agentic-geo', label: 'AgenticGEO 自主闭环', href: '/agentic-geo', icon: Zap },
      { key: 'geo-focus', label: '选点·认知资产·引爆', href: '/geo-focus', icon: Flame },
    ],
  },
  {
    key: 'insight', label: '竞品情报', shortLabel: '竞品',
    desc: '按品类跟踪竞品与 AI 声量份额(SoV)',
    href: '/insight', icon: Radio, group: 1, permission: 'marketing.campaigns.view',
    children: [{ key: 'insight', label: '竞品情报(按品类)', href: '/insight', icon: Radio }],
  },
  {
    key: 'content', label: '内容工厂', shortLabel: '内容',
    desc: '内容生产·审核·发布 · 文案 Copilot · 公众号发布',
    href: '/content', icon: PenTool, group: 1, permission: 'marketing.campaigns.view',
    children: [
      { key: 'content', label: '内容工厂', href: '/content', icon: PenTool },
      { key: 'copywriter', label: '文案 Copilot', href: '/growth/copywriter', icon: PenTool },
      { key: 'wechat-review', label: '内容审核', href: '/growth/wechat-review', icon: BadgeCheck },
      { key: 'wechat-accounts', label: '发布账号配置', href: '/growth/wechat-accounts', icon: Settings2 },
      { key: 'wechat-drafts', label: '发布记录', href: '/growth/wechat-drafts', icon: Send },
    ],
  },
  {
    key: 'channel', label: '渠道营销', shortLabel: '渠道',
    desc: '招募 · 分层认证 · 返利毛利闸 · 绩效',
    href: '/channel', icon: Megaphone, group: 1, permission: 'marketing.campaigns.view',
    children: [{ key: 'channel', label: '渠道与伙伴营销', href: '/channel', icon: Megaphone }],
  },
  {
    key: 'activation', label: '活动运营', shortLabel: '活动',
    desc: '优惠券 · 拼团 · 秒杀 · 裂变 · 转介绍',
    href: '/activation', icon: Zap, group: 1, permission: 'marketing.campaigns.view',
    children: [{ key: 'activation', label: '活动运营', href: '/activation', icon: Zap }],
  },
  {
    key: 'gtm', label: '战役·MROI·OKR', shortLabel: '战役',
    desc: '战役预算 · MROI 投产比 · 三级 OKR',
    href: '/gtm', icon: Rocket, group: 1, permission: 'marketing.campaigns.view',
    children: [{ key: 'gtm', label: '战役·预算MROI·OKR', href: '/gtm', icon: Rocket }],
  },
  {
    key: 'sentiment', label: '舆情雷达', shortLabel: '舆情',
    desc: '全网舆情监测与预警',
    href: '/growth/sentiment', icon: Radio, group: 1, permission: 'marketing.campaigns.view',
    children: [{ key: 'sentiment', label: '舆情雷达', href: '/growth/sentiment', icon: Radio }],
  },
  {
    key: 'automation', label: '营销自动化', shortLabel: '自动化',
    desc: '营销自动化编排',
    href: '/growth/automation', icon: Zap, group: 1, permission: 'marketing.campaigns.view',
    children: [{ key: 'automation', label: '营销自动化', href: '/growth/automation', icon: Zap }],
  },
  {
    key: 'materials', label: '营销物料', shortLabel: '物料',
    desc: '营销物料库管理',
    href: '/growth/materials', icon: FolderOpen, group: 1, permission: 'marketing.campaigns.view',
    children: [{ key: 'materials', label: '营销物料库管理', href: '/growth/materials', icon: FolderOpen }],
  },
  {
    key: 'dealer-portal',
    label: '经销商门户',
    shortLabel: '门户',
    desc: '经销商自助：物料领取 · 政策返利 · 线索认领 · 培训认证',
    href: '/portal',
    icon: Store,
    group: 2,
    permission: 'marketing.campaigns.view',
    children: [{ key: 'portal-home', label: '经销商门户', href: '/portal', icon: Store }],
  },
  {
    key: 'product',
    label: '产品',
    shortLabel: '产品',
    desc: '产品目录 · 产品资料 · 产品底座',
    href: '/products',
    icon: Boxes,
    group: 2,
    permission: 'product.catalog.view',
    children: [
      { key: 'product-list', label: '产品目录', href: '/products?module=catalog', icon: Package },
      { key: 'product-mgmt', label: '产品管理(生命周期/上市/定价)', href: '/product-mgmt', icon: Boxes },
      { key: 'product-materials', label: '产品资料', href: '/products?module=materials', icon: FileText },
      { key: 'product-base', label: '产品目录底座', href: '/products?module=base', icon: Boxes },
      { key: 'product-categories', label: '产品分类', href: '/products?module=categories', icon: FolderOpen },
    ],
  },
  // 客户赋能(独立产品线)界面：我的工作台 /dealer · 售前闭环 /presale 已从营销中台导航移除，
  // 归未来独立经销商应用(页面文件留存·可逆)。
  {
    key: 'accounts',
    label: '营销账号权限',
    shortLabel: '账号权限',
    desc: '营销账号 · 角色权限 · 启停 · 密码重置',
    href: '/accounts',
    icon: UsersRound,
    group: 3,
    permission: 'admin.users.view',
    children: [
      { key: 'account-list', label: '账号列表', href: '/accounts', icon: UsersRound },
      { key: 'account-audit', label: '操作日志', href: '/accounts?module=audit', icon: FileText },
    ],
  },
];

export function canSeeNavItem(
  item: WorkbenchNavItem,
  permissions: string[] = [],
  role?: string | null,
): boolean {
  if (!item.permission) return true;
  if (role === 'platform_admin' || role === 'hq_admin') return true;
  return permissions.includes('*') || permissions.includes(item.permission);
}

export function navItemForPath(path: string | null): WorkbenchNavItem {
  const byKey = (k: string) => WORKBENCH_NAV.find((item) => item.key === k)!;
  if (path?.startsWith('/cockpit') || path?.startsWith('/cmo') || path?.startsWith('/strategy')) return byKey('cockpit');
  // 增长功能一级菜单
  if (path?.startsWith('/agentic-geo') || path?.startsWith('/geo-focus') || path?.startsWith('/growth/geo')) return byKey('geo');
  if (path?.startsWith('/insight')) return byKey('insight');
  if (path?.startsWith('/content') || path?.startsWith('/growth/copywriter') || path?.startsWith('/growth/wechat')) return byKey('content');
  if (path?.startsWith('/channel')) return byKey('channel');
  if (path?.startsWith('/activation')) return byKey('activation');
  if (path?.startsWith('/gtm')) return byKey('gtm');
  if (path?.startsWith('/growth/sentiment')) return byKey('sentiment');
  if (path?.startsWith('/growth/automation')) return byKey('automation');
  if (path?.startsWith('/growth/materials')) return byKey('materials');
  if (path?.startsWith('/portal')) return byKey('dealer-portal');
  if (path?.startsWith('/positioning')) return byKey('brand-sites');
  if (path?.startsWith('/product-mgmt')) return byKey('product');
  if (path?.startsWith('/accounts')) return byKey('accounts');
  if (path?.startsWith('/products')) return byKey('product');
  if (path?.startsWith('/growth/geo') || path?.startsWith('/growth')) return byKey('geo');
  if (path?.startsWith('/comfort')) return byKey('brand-sites');
  if (path?.startsWith('/brand')) return byKey('brand-sites');
  return WORKBENCH_NAV[0];
}
