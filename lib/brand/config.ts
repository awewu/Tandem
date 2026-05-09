/**
 * Brand Configuration · 品牌配置系统
 *
 * 设计目标: 任何品牌字段都通过此模块, 实现一键白标切换.
 *
 * 用法:
 *   import { brand } from '@/lib/brand/config';
 *   <h1>{brand.productName}</h1>
 *
 * 切换品牌:
 *   1. 修改 BRAND_PROFILE 常量 (默认走 Rheclaw)
 *   2. 或环境变量 NEXT_PUBLIC_BRAND_PROFILE=enterprise_xyz
 *   3. 或客户白标 SaaS 模式下从数据库加载
 */

export interface BrandTheme {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
}

export interface BrandAssets {
  /** Logo 文件路径 (相对 public/) */
  logo: string;
  /** Logo 暗色模式 */
  logoDark?: string;
  /** Favicon */
  favicon: string;
  /** 应用 icon (Tauri / PWA) */
  appIcon: string;
}

export interface BrandStrings {
  /** 产品名 (英文) */
  productName: string;
  /** 产品名 (中文) */
  productNameZh: string;
  /** 公司名 */
  companyName: string;
  /** 公司域名 */
  domain: string;
  /** 一句话定位 */
  tagline: string;
  /** 一句话定位 (中文) */
  taglineZh: string;
  /** Slogan */
  slogan: string;
  /** Slogan (中文) */
  sloganZh: string;
}

export interface BrandLegal {
  privacyUrl: string;
  termsUrl: string;
  contactEmail: string;
  copyright: string;
}

export interface BrandProfile {
  id: string;
  strings: BrandStrings;
  assets: BrandAssets;
  theme: BrandTheme;
  legal: BrandLegal;
  /** 是否允许客户在产品内自定义品牌 */
  enableCustomerBranding: boolean;
}

/**
 * 默认品牌: Tandem / 牛马搭子 (产品官方品牌)
 *
 * 仓库目前名 Hermes 是历史遗留, 不代表品牌.
 * 本配置定义了品牌语言、颜色、资产, 任何 UI 代码都应该调用 brand.* 而非硬编码.
 */
export const TANDEM_PROFILE: BrandProfile = {
  id: 'tandem',
  strings: {
    productName: 'Tandem',
    productNameZh: '牛马搭子',
    companyName: 'Tandem',
    domain: 'tandem.work',
    tagline: 'AI buddy for the working class',
    taglineZh: '员工的 AI 搭子, 让工作更体面',
    slogan: 'Get off work an hour earlier',
    sloganZh: '让你下班早一小时',
  },
  assets: {
    logo: '/brand/tandem-logo.svg',
    logoDark: '/brand/tandem-logo-dark.svg',
    favicon: '/favicon.ico',
    appIcon: '/icons/icon.png',
  },
  theme: {
    primary: '#0F172A',
    primaryForeground: '#F8FAFC',
    accent: '#3B82F6',
    accentForeground: '#FFFFFF',
  },
  legal: {
    privacyUrl: '/legal/privacy',
    termsUrl: '/legal/terms',
    contactEmail: 'hello@tandem.work',
    copyright: `© ${new Date().getFullYear()} Tandem. All rights reserved.`,
  },
  enableCustomerBranding: true,
};

/** 客户白标示例 profile (V2 起客户可配置) */
export const ENTERPRISE_TEMPLATE: BrandProfile = {
  id: 'enterprise_template',
  strings: {
    productName: 'YourCo Workspace',
    productNameZh: '贵司工作台',
    companyName: 'YourCo',
    domain: 'yourco.com',
    tagline: 'Your enterprise AI buddy',
    taglineZh: '贵司专属 AI 工作搭子',
    slogan: '',
    sloganZh: '',
  },
  assets: {
    logo: '/brand/yourco-logo.svg',
    favicon: '/favicon.ico',
    appIcon: '/icons/icon.png',
  },
  theme: {
    primary: '#0F172A',
    primaryForeground: '#F8FAFC',
    accent: '#3B82F6',
    accentForeground: '#FFFFFF',
  },
  legal: {
    privacyUrl: '/legal/privacy',
    termsUrl: '/legal/terms',
    contactEmail: 'support@yourco.com',
    copyright: `© ${new Date().getFullYear()} YourCo. All rights reserved.`,
  },
  enableCustomerBranding: false,
};

/** 注册表: 所有可用 profile */
const PROFILES: Record<string, BrandProfile> = {
  tandem: TANDEM_PROFILE,
  enterprise_template: ENTERPRISE_TEMPLATE,
};

/** 解析当前激活的品牌 */
function resolveActiveProfile(): BrandProfile {
  const envProfile =
    typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_BRAND_PROFILE
      : undefined;

  if (envProfile && PROFILES[envProfile]) {
    return PROFILES[envProfile];
  }

  return TANDEM_PROFILE;
}

/** 当前生效的品牌配置 (由模块加载时确定) */
export const brand: BrandProfile = resolveActiveProfile();

/**
 * 运行时切换品牌 (仅供白标 SaaS 客户租户场景使用).
 * 注意: 仅切内存状态, 不影响 SSR 静态生成.
 */
let runtimeOverride: BrandProfile | null = null;

export function setBrandProfile(profile: BrandProfile): void {
  runtimeOverride = profile;
}

export function getBrand(): BrandProfile {
  return runtimeOverride ?? brand;
}

/**
 * 注册新品牌 (供 V2 白标客户管理后台调用)
 */
export function registerBrandProfile(profile: BrandProfile): void {
  PROFILES[profile.id] = profile;
}

/** 列出所有可用品牌 */
export function listBrandProfiles(): BrandProfile[] {
  return Object.values(PROFILES);
}
