import {
  BadgeCheck,
  Boxes,
  FileText,
  Flame,
  FolderOpen,
  Globe2,
  Megaphone,
  Package,
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
    ],
  },
  {
    key: 'growth',
    label: '市场增长',
    shortLabel: '市场增长',
    desc: 'GEO · 文案 Copilot · 舆情雷达 · 营销自动化',
    href: '/growth',
    icon: Rocket,
    group: 1,
    permission: 'marketing.campaigns.view',
    children: [
      { key: 'geo', label: 'GEO', href: '/growth/geo', icon: Search },
      { key: 'copywriter', label: '文案 Copilot', href: '/growth/copywriter', icon: PenTool },
      { key: 'wechat-review', label: '内容审核', href: '/growth/wechat-review', icon: BadgeCheck },
      { key: 'wechat-accounts', label: '发布账号配置', href: '/growth/wechat-accounts', icon: Settings2 },
      { key: 'wechat-drafts', label: '发布记录', href: '/growth/wechat-drafts', icon: Send },
      { key: 'sentiment', label: '舆情雷达', href: '/growth/sentiment', icon: Radio },
      { key: 'automation', label: '营销自动化', href: '/growth/automation', icon: Zap },
      { key: 'materials', label: '营销物料库管理', href: '/growth/materials', icon: FolderOpen },
    ],
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
      { key: 'product-materials', label: '产品资料', href: '/products?module=materials', icon: FileText },
      { key: 'product-base', label: '产品目录底座', href: '/products?module=base', icon: Boxes },
      { key: 'product-categories', label: '产品分类', href: '/products?module=categories', icon: FolderOpen },
    ],
  },
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
  if (path?.startsWith('/accounts')) return WORKBENCH_NAV.find((item) => item.key === 'accounts')!;
  if (path?.startsWith('/products')) return WORKBENCH_NAV.find((item) => item.key === 'product')!;
  if (path?.startsWith('/growth')) return WORKBENCH_NAV.find((item) => item.key === 'growth')!;
  if (path?.startsWith('/comfort')) return WORKBENCH_NAV.find((item) => item.key === 'brand-sites')!;
  if (path?.startsWith('/brand')) return WORKBENCH_NAV.find((item) => item.key === 'brand-sites')!;
  return WORKBENCH_NAV[0];
}
