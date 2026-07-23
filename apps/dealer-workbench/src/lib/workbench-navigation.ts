import {
  BadgeCheck,
  Boxes,
  FileText,
  Flame,
  FolderOpen,
  Globe2,
  Megaphone,
  MonitorCog,
  Package,
  PenTool,
  Radio,
  Rocket,
  Search,
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
  children: WorkbenchChild[];
};

export const WORKBENCH_NAV: WorkbenchNavItem[] = [
  {
    key: 'brand-sites',
    label: '品牌官网管理',
    shortLabel: '品牌官网',
    desc: 'Rheem · Ruud · Everhot 官网',
    href: '/comfort/sites',
    icon: Globe2,
    group: 0,
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
    label: '市场营销',
    shortLabel: '市场营销',
    desc: 'GEO · 文案 Copilot · 舆情雷达 · 营销自动化',
    href: '/growth',
    icon: Rocket,
    group: 0,
    children: [
      { key: 'geo', label: 'GEO', href: '/growth/geo', icon: Search },
      { key: 'copywriter', label: '文案 Copilot', href: '/growth/copywriter', icon: PenTool },
      { key: 'sentiment', label: '舆情雷达', href: '/growth/sentiment', icon: Radio },
      { key: 'automation', label: '营销自动化', href: '/growth/automation', icon: Zap },
      { key: 'materials', label: '营销物料库', href: '/growth/materials', icon: FolderOpen },
    ],
  },
  {
    key: 'product',
    label: '产品',
    shortLabel: '产品',
    desc: '产品底座 · 设备库 · 分类定价',
    href: '/products',
    icon: Boxes,
    group: 0,
    children: [
      { key: 'product-list', label: '产品库', href: '/products?module=catalog', icon: Package },
      { key: 'product-materials', label: '产品资料管理', href: '/products?module=materials', icon: FileText },
      { key: 'product-base', label: '产品目录底座', href: '/products?module=base', icon: Boxes },
    ],
  },
  {
    key: 'accounts',
    label: '账号管理',
    shortLabel: '账号',
    desc: '账号 · 角色权限 · 启停 · 密码重置',
    href: '/accounts',
    icon: UsersRound,
    group: 1,
    children: [
      { key: 'account-list', label: '账号列表', href: '/accounts', icon: UsersRound },
      { key: 'account-create', label: '新建账号', href: '/accounts', icon: MonitorCog },
    ],
  },
];

export function navItemForPath(path: string | null): WorkbenchNavItem {
  if (path?.startsWith('/accounts')) return WORKBENCH_NAV.find((item) => item.key === 'accounts')!;
  if (path?.startsWith('/products')) return WORKBENCH_NAV.find((item) => item.key === 'product')!;
  if (path?.startsWith('/growth')) return WORKBENCH_NAV.find((item) => item.key === 'growth')!;
  if (path?.startsWith('/comfort')) return WORKBENCH_NAV.find((item) => item.key === 'brand-sites')!;
  if (path?.startsWith('/brand')) return WORKBENCH_NAV.find((item) => item.key === 'brand-sites')!;
  return WORKBENCH_NAV[0];
}
