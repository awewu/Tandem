import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import type { JwtPayload } from '../auth/auth.service';
import { withRlsTransaction } from '../common/rls';
import { AuditLogEntity } from '../governance/governance.entity';
import { BrandSiteBasicSettingsEntity, BrandSiteEntity } from './brand-site.entity';
import { normalizeSiteCode, resolvePublicSiteTenant } from './site-product-assignment.service';

type SettingsSection =
  | 'identity'
  | 'brandClaims'
  | 'stats'
  | 'organization'
  | 'contact'
  | 'dealerService'
  | 'legal'
  | 'privacy'
  | 'seo'
  | 'analytics';

export type BrandSiteBasicSettingsInput = Partial<Record<SettingsSection, Record<string, unknown>>>;

const SECTIONS: SettingsSection[] = [
  'identity', 'brandClaims', 'stats', 'organization', 'contact', 'dealerService',
  'legal', 'privacy', 'seo', 'analytics',
];
const SECTION_SET = new Set<string>(SECTIONS);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

export const EVERHOT_BASIC_SETTINGS_DEFAULTS: Record<SettingsSection, Record<string, unknown>> = {
  identity: {
    siteTitle: '恒热 Everhot | 中央采暖·热水·制冷整体解决方案',
    siteName: 'Everhot 中国 Everhot China',
    brandNameCn: '恒热',
    brandNameEn: 'Everhot',
    logoUrl: '/assets/img/brand/everhot-logo.png',
    whiteLogoUrl: '/assets/img/brand/everhot-logo-white.png',
    favicon16Url: '/favicon-16x16.png',
    favicon32Url: '/favicon-32x32.png',
    faviconIcoUrl: '/favicon.ico',
    appleTouchIconUrl: '/apple-touch-icon.png',
    themeColor: '#BF1924',
    siteUrl: 'https://www.everhot.com.cn',
    localeLabel: '中国 · 简体中文',
  },
  brandClaims: {
    heroEyebrow: '瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营',
    heroTitleLine1: '百年恒续',
    heroTitleLine2: '为爱恒热',
    heroSloganEn: 'EVERHOT FOR EVERLOVE',
    heroClaim: '大户型选恒热，多点用水没烦恼',
    ctaSlogan: '大户型选恒热 · 多点用水没烦恼',
    primaryCtaText: '家用产品',
    primaryCtaHref: '#residential',
    secondaryCtaText: '商用方案',
    secondaryCtaHref: '#commercial',
  },
  stats: {
    technicalStats: [
      { value: '≥105%', label: '冷凝热效率', sortOrder: 0, visible: true },
      { value: '≤5s', label: '出热水时间', sortOrder: 1, visible: true },
      { value: 'COP 4.2+', label: '系统能效比', sortOrder: 2, visible: true },
      { value: '24h', label: '商用连续供热', sortOrder: 3, visible: true },
    ],
    sustainabilityStats: [
      { value: '38%', label: '平均能耗降低', sortOrder: 0, visible: true },
      { value: '1,200+', label: '节能改造项目', sortOrder: 1, visible: true },
      { value: '6,800t', label: '年减少碳排放', sortOrder: 2, visible: true },
    ],
    serviceProvinceCount: '30',
    serviceOutletCount: '200+',
    serviceNetworkText: '覆盖全国 30 省市，200+ 授权服务网点',
  },
  organization: {
    operatorGroupName: '瑞合瑞德暖通科技集团',
    operatorGroupNameEn: 'Rhautt Comfort',
    operatorGroupUrl: 'https://rhautt.com',
    parentBrandRelationText: '瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营',
    rheemUrl: 'https://www.rheem.com.cn',
    ruudUrl: 'https://www.ruud.com.cn',
    groupSiteUrl: 'https://rhautt.com',
  },
  contact: {
    customerServiceHotline: '400-888-8888',
    customerServiceTelHref: 'tel:4008888888',
    serviceHours: '周一至周六 9:00—18:00',
    businessEmail: 'business@everhot.com.cn',
    mediaEmail: 'pr@everhot.com.cn',
    privacyEmail: 'privacy@everhot.com.cn',
    dealerJoinEmail: 'dealer@rhautt.com',
    contactFormSuccessText: '留言已提交，恒热客服将尽快与您联系。',
    urgentRepairNote: '提交后将由客服回拨。紧急报修请直接致电 400-888-8888。',
    contactCards: [
      { tag: '客服', title: '全国客服热线', body: '产品咨询、使用指导、售后报修', linkText: '400-888-8888', href: 'tel:4008888888', sortOrder: 0, visible: true },
      { tag: '售后', title: '预约上门维修', body: '在线预约授权服务工程师上门检测维修。', linkText: '立即预约', href: '/find-a-pro/', sortOrder: 1, visible: true },
      { tag: '商务', title: '工程与商务合作', body: '酒店、公寓、综合体项目与集采合作。', linkText: 'business@everhot.com.cn', href: 'mailto:business@everhot.com.cn', sortOrder: 2, visible: true },
      { tag: '加盟', title: '经销商加盟', body: '申请成为恒热授权经销商。', linkText: '加盟申请', href: '/professionals/residential/partner-programs/', sortOrder: 3, visible: true },
      { tag: '媒体', title: '媒体与品牌', body: '媒体采访与品牌合作。', linkText: 'pr@everhot.com.cn', href: 'mailto:pr@everhot.com.cn', sortOrder: 4, visible: true },
      { tag: '集团', title: '集团与其他品牌', body: '瑞美（Rheem）集团品牌矩阵，瑞合瑞德集团中国运营。', linkText: '访问集团官网', href: 'https://rhautt.com', sortOrder: 5, visible: true },
    ],
  },
  dealerService: {
    dealerLocatorButtonText: '查找经销商',
    dealerLocatorPageTitle: '查找授权经销商 | 恒热 Everhot',
    dealerLocatorDescription: '覆盖全国 30 省市，200+ 授权服务网点，专业安装工程师，完善售后保障。',
    dealerSearchPlaceholder: '输入城市 / 区域 / 地址，如：上海 浦东',
    nearestDealerButtonText: '离我最近',
    dealerJoinTitle: '成为恒热授权经销商',
    dealerJoinDescription: '加入恒热经销商网络，获取独家授权、培训支持与市场资源',
    dealerJoinButtonText: '申请加盟',
    dealerJoinHref: 'mailto:dealer@rhautt.com',
    authorizedServiceStandards: [
      { value: 'Rheem认证', label: '官方认证安装工程师', sortOrder: 0, visible: true },
      { value: '5年质保', label: '整机售后保障', sortOrder: 1, visible: true },
      { value: '48h响应', label: '售后上门时效', sortOrder: 2, visible: true },
      { value: '正品承诺', label: '官方渠道授权货源', sortOrder: 3, visible: true },
    ],
  },
  legal: {
    icpNumber: '沪ICP备XXXXXXXX号',
    icpUrl: 'https://beian.miit.gov.cn/',
    copyrightText: '© 2026 Everhot 恒热 · 瑞合瑞德暖通科技集团 · Everhot 为注册商标',
    copyrightYear: '2026',
    copyrightOwner: '瑞合瑞德暖通科技集团',
    trademarkText: 'Everhot / 恒热 为注册商标',
    privacyPolicyHref: '/privacy/',
    cookiePolicyHref: '/privacy/#cookie',
    legalStatementHref: '/privacy/#terms',
  },
  privacy: {
    privacyEffectiveDate: '2026-XX-XX',
    privacyLastUpdatedDate: '2026-XX-XX',
    privacyVersion: 'v1.0',
    legalOperatorName: '【运营主体全称】',
    registeredAddress: '【注册地址】',
    privacyContactEmail: 'privacy@everhot.com.cn',
    privacyContactHotline: '400-888-8888',
  },
  seo: {
    homeMetaTitle: '恒热 Everhot | 中央采暖·热水·制冷整体解决方案',
    homeMetaDescription: '恒热 Everhot —— 百年恒续，为爱恒热。专注家用与商用中央采暖、热水、制冷整体解决方案，瑞美集团旗下品牌。',
    homeMetaKeywords: '恒热,Everhot,壁挂炉,热水器,中央热水,中央采暖,空气能,商用热水,家用采暖',
    ogSiteName: 'Everhot 中国 Everhot China',
    defaultOgImage: 'https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp',
    defaultTwitterImage: 'https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp',
    canonicalBaseUrl: 'https://www.everhot.com.cn/',
    organizationName: 'Everhot 中国 Everhot China',
    organizationLogo: 'https://www.everhot.com.cn/assets/img/brand/everhot-logo.png',
    parentOrganizationName: 'Rhautt Comfort 瑞合瑞德暖通科技集团',
    parentOrganizationUrl: 'https://rhautt.com',
    sameAs: 'https://rhautt.com',
    sitemapUrl: 'https://www.everhot.com.cn/sitemap.xml',
  },
  analytics: {
    analyticsEndpoint: '',
    analyticsConsentEnabled: true,
    cookieConsentText: '本站使用 Cookie 与匿名统计以保障基本功能并改善体验。继续浏览即表示同意，您也可拒绝非必要统计。详见隐私政策。',
    cookieDenyText: '拒绝非必要',
    cookieAcceptText: '同意',
  },
};

@Injectable()
export class BrandSiteBasicSettingsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  get(user: JwtPayload, siteCode: string) {
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const row = await em.getRepository(BrandSiteBasicSettingsEntity).findOneBy({
        tenantId: user.tenantId,
        siteId: site.id,
      });
      return this.toView(site, row);
    }, this.scope(user));
  }

  update(user: JwtPayload, siteCode: string, input: BrandSiteBasicSettingsInput) {
    this.validateInput(input);
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const repo = em.getRepository(BrandSiteBasicSettingsEntity);
      const existing = await repo.findOneBy({ tenantId: user.tenantId, siteId: site.id });
      const before = existing ? this.snapshot(existing) : null;
      const patch = this.normalizedPatch(input);
      const row = existing || repo.create({
        tenantId: user.tenantId,
        siteId: site.id,
        siteCode: site.code,
        createdBy: user.userId,
      });
      Object.assign(row, patch, {
        siteCode: site.code,
        updatedBy: user.userId,
      });
      const saved = await repo.save(row);
      await this.audit(em, user, 'brand-site-basic-settings.update', saved.id, before, this.snapshot(saved));
      return this.toView(site, saved);
    }, this.scope(user));
  }

  updateSection(user: JwtPayload, siteCode: string, sectionInput: string, sectionValue: Record<string, unknown>) {
    const section = this.normalizeSection(sectionInput);
    this.validateSectionInput(section, sectionValue);
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, user.tenantId, siteCode);
      const repo = em.getRepository(BrandSiteBasicSettingsEntity);
      const existing = await repo.findOneBy({ tenantId: user.tenantId, siteId: site.id });
      const previousSection = existing
        ? this.cleanObject(((existing as any)[section] || {}) as Record<string, unknown>)
        : null;
      const row = existing || repo.create({
        tenantId: user.tenantId,
        siteId: site.id,
        siteCode: site.code,
        createdBy: user.userId,
      });
      const nextSection = this.cleanObject(sectionValue);
      Object.assign(row, {
        [section]: nextSection,
        siteCode: site.code,
        updatedBy: user.userId,
      });
      const saved = await repo.save(row);
      await this.audit(
        em,
        user,
        `brand-site-basic-settings.${section}.update`,
        saved.id,
        previousSection === null ? null : { section, [section]: previousSection },
        { section, [section]: nextSection },
      );
      return {
        siteId: site.id,
        siteCode: site.code,
        section,
        [section]: {
          ...EVERHOT_BASIC_SETTINGS_DEFAULTS[section],
          ...(((saved as any)[section] || {}) as Record<string, unknown>),
        },
        updatedAt: saved.updatedAt || null,
      };
    }, this.scope(user));
  }

  publicGet(siteCodeInput: string) {
    const siteCode = normalizeSiteCode(siteCodeInput);
    const tenantId = resolvePublicSiteTenant(siteCode);
    if (!tenantId || !UUID_RE.test(tenantId)) throw new NotFoundException('website public tenant is not configured');
    return withRlsTransaction(this.ds, async (em) => {
      const site = await this.findSite(em, tenantId, siteCode);
      const row = await em.getRepository(BrandSiteBasicSettingsEntity).findOneBy({ tenantId, siteId: site.id });
      return { success: true, data: this.toView(site, row) };
    }, { tenantId });
  }

  private normalizedPatch(input: BrandSiteBasicSettingsInput): Partial<BrandSiteBasicSettingsEntity> {
    const patch: Partial<BrandSiteBasicSettingsEntity> = {};
    for (const section of SECTIONS) {
      if (!Object.prototype.hasOwnProperty.call(input, section)) continue;
      const value = input[section];
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new BadRequestException(`${section} must be an object`);
      }
      (patch as Record<string, unknown>)[section] = this.cleanObject(value);
    }
    return patch;
  }

  private cleanObject(value: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(value));
  }

  private normalizeSection(sectionInput: string): SettingsSection {
    const section = String(sectionInput || '').trim() as SettingsSection;
    if (!SECTION_SET.has(section)) throw new BadRequestException('basic settings section is invalid');
    return section;
  }

  private validateSectionInput(section: SettingsSection, value: Record<string, unknown>) {
    this.validateInput({ [section]: value } as BrandSiteBasicSettingsInput);
  }

  private validateInput(input: BrandSiteBasicSettingsInput) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('basic settings payload must be an object');
    }
    this.walk(input, (key, value) => {
      if (typeof value !== 'string') return;
      if (/javascript:|<script|onerror=|onclick=|onload=/i.test(value)) {
        throw new BadRequestException(`${key} contains unsafe content`);
      }
      if (/(url|href|link|endpoint|siteUrl|sameAs|logo|icon|image)$/i.test(key) && value.trim()) {
        this.validateLink(key, value.trim());
      }
      if (/email$/i.test(key) && value.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())) {
        throw new BadRequestException(`${key} must be a valid email`);
      }
    });
  }

  private validateLink(key: string, value: string) {
    if (value.startsWith('/') || value.startsWith('#')) return;
    if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(value)) return;
    if (/^tel:[0-9+\-\s]+$/i.test(value)) return;
    let url: URL;
    try { url = new URL(value); } catch { throw new BadRequestException(`${key} must be a valid URL`); }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new BadRequestException(`${key} only allows http/https, relative, mailto, or tel links`);
    }
  }

  private walk(value: unknown, visitor: (key: string, value: unknown) => void, key = '') {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.walk(item, visitor, `${key}[${index}]`));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        this.walk(childValue, visitor, childKey);
      }
      return;
    }
    visitor(key, value);
  }

  private async findSite(em: EntityManager, tenantId: string, siteCode: string) {
    const code = normalizeSiteCode(siteCode);
    const site = await em.getRepository(BrandSiteEntity).findOne({
      where: { tenantId, code } as any,
    });
    if (!site || site.deletedAt) throw new NotFoundException('brand site not found');
    return site;
  }

  private toView(site: BrandSiteEntity, row: BrandSiteBasicSettingsEntity | null) {
    const data = Object.fromEntries(SECTIONS.map((section) => [
      section,
      {
        ...EVERHOT_BASIC_SETTINGS_DEFAULTS[section],
        ...(row ? ((row as any)[section] || {}) : {}),
      },
    ]));
    return {
      siteId: site.id,
      siteCode: site.code,
      defaultsApplied: !row,
      ...data,
      updatedAt: row?.updatedAt || null,
    };
  }

  private snapshot(row: BrandSiteBasicSettingsEntity): Record<string, unknown> {
    return Object.fromEntries([
      ['id', row.id],
      ['tenantId', row.tenantId],
      ['siteId', row.siteId],
      ['siteCode', row.siteCode],
      ...SECTIONS.map((section) => [section, (row as any)[section]]),
    ]);
  }

  private scope(user: JwtPayload) {
    return { tenantId: user.tenantId, actorId: user.userId, role: user.role };
  }

  private async audit(
    em: EntityManager,
    user: JwtPayload,
    action: string,
    id: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown>,
  ) {
    await em.getRepository(AuditLogEntity).save(em.getRepository(AuditLogEntity).create({
      tenantId: user.tenantId,
      actorUserId: user.userId,
      action,
      resourceType: 'brand-site-basic-settings',
      resourceId: id,
      beforeState: before,
      afterState: after,
      requestId: null,
      traceId: null,
      ipHash: null,
    }));
  }
}
