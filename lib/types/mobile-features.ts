/**
 * Mobile feature configuration
 *
 * Stored in KvStore collection `mobile_feature_configs`.
 * Tenant-level switches let PC admins control the Android/iOS App surface
 * without rebuilding the native shell.
 */

export const MOBILE_FEATURE_KEYS = [
  'home_dashboard',
  'central_ai',
  'shouchao',
  'mail',
  'calendar',
  'daily_report',
  'naba',
] as const;

export type MobileFeatureKey = (typeof MOBILE_FEATURE_KEYS)[number];

export interface MobileFeatureMeta {
  key: MobileFeatureKey;
  label: string;
  description: string;
  route: string | null;
  surface: 'tab' | 'floating' | 'dashboard-card';
}

export interface MobileFeatureConfig {
  id: string;
  tenantId: string;
  enabledFeatures: MobileFeatureKey[];
  bottomNav: MobileFeatureKey[];
  dashboardCards: MobileFeatureKey[];
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const MOBILE_FEATURE_META: MobileFeatureMeta[] = [
  {
    key: 'home_dashboard',
    label: '首页 / 整体看板',
    description: 'App 第一屏，汇总今日日程、邮箱、日报、手抄、拿捏与 AI 提醒。',
    route: '/',
    surface: 'tab',
  },
  {
    key: 'central_ai',
    label: '中央 AI',
    description: '全局悬浮入口，任何页面都可以随时询问。',
    route: null,
    surface: 'floating',
  },
  {
    key: 'shouchao',
    label: '搭子手抄',
    description: '移动端快速记录、整理个人笔记和资料。',
    route: '/shouchao',
    surface: 'tab',
  },
  {
    key: 'mail',
    label: '邮箱',
    description: '正式沟通、待回复邮件、AI 草稿与摘要。',
    route: '/mail',
    surface: 'dashboard-card',
  },
  {
    key: 'calendar',
    label: '日程',
    description: '今日会议、待办节奏、创建或查看日程。',
    route: '/calendar',
    surface: 'tab',
  },
  {
    key: 'daily_report',
    label: '日报',
    description: '事半中的 5min 日报，作为 OKR 进展输入源。',
    route: '/report',
    surface: 'tab',
  },
  {
    key: 'naba',
    label: '拿捏',
    description: '分身成长、训练进度与待确认代行动作。',
    route: '/persona',
    surface: 'tab',
  },
];

export const DEFAULT_MOBILE_ENABLED_FEATURES: MobileFeatureKey[] = [
  'home_dashboard',
  'central_ai',
  'shouchao',
  'mail',
  'calendar',
  'daily_report',
  'naba',
];

export const DEFAULT_MOBILE_BOTTOM_NAV: MobileFeatureKey[] = [
  'home_dashboard',
  'shouchao',
  'daily_report',
  'calendar',
  'naba',
];

export const DEFAULT_MOBILE_DASHBOARD_CARDS: MobileFeatureKey[] = [
  'central_ai',
  'mail',
  'calendar',
  'daily_report',
  'shouchao',
  'naba',
];

