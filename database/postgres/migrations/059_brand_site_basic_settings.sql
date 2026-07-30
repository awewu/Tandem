-- Rhautt Nexus - Migration 059
-- Tenant-owned basic settings for brand official sites.

SET search_path TO rhautt_nexus, public;

CREATE TABLE IF NOT EXISTS rhautt_nexus.brand_site_basic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES rhautt_nexus.tenants(id),
  site_id uuid NOT NULL REFERENCES rhautt_nexus.tenant_brand_sites(id) ON DELETE CASCADE,
  site_code text NOT NULL,
  identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  brand_claims jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  organization jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  dealer_service jsonb NOT NULL DEFAULT '{}'::jsonb,
  legal jsonb NOT NULL DEFAULT '{}'::jsonb,
  privacy jsonb NOT NULL DEFAULT '{}'::jsonb,
  seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  analytics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES rhautt_nexus.users(id),
  updated_by uuid REFERENCES rhautt_nexus.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, site_id)
);

CREATE INDEX IF NOT EXISTS brand_site_basic_settings_site_code_idx
  ON rhautt_nexus.brand_site_basic_settings (tenant_id, site_code);

ALTER TABLE rhautt_nexus.brand_site_basic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rhautt_nexus.brand_site_basic_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_site_basic_settings_tenant_isolation ON rhautt_nexus.brand_site_basic_settings;
CREATE POLICY brand_site_basic_settings_tenant_isolation ON rhautt_nexus.brand_site_basic_settings
  USING (tenant_id = rhautt_nexus.current_tenant_id())
  WITH CHECK (tenant_id = rhautt_nexus.current_tenant_id());

INSERT INTO rhautt_nexus.brand_site_basic_settings (
  tenant_id,
  site_id,
  site_code,
  identity,
  brand_claims,
  stats,
  organization,
  contact,
  dealer_service,
  legal,
  privacy,
  seo,
  analytics
)
SELECT
  site.tenant_id,
  site.id,
  site.code,
  jsonb_build_object(
    'siteTitle', '恒热 Everhot | 中央采暖·热水·制冷整体解决方案',
    'siteName', 'Everhot 中国 Everhot China',
    'brandNameCn', '恒热',
    'brandNameEn', 'Everhot',
    'logoUrl', '/assets/img/brand/everhot-logo.png',
    'whiteLogoUrl', '/assets/img/brand/everhot-logo-white.png',
    'favicon16Url', '/favicon-16x16.png',
    'favicon32Url', '/favicon-32x32.png',
    'faviconIcoUrl', '/favicon.ico',
    'appleTouchIconUrl', '/apple-touch-icon.png',
    'themeColor', '#BF1924',
    'siteUrl', 'https://www.everhot.com.cn',
    'localeLabel', '中国 · 简体中文'
  ),
  jsonb_build_object(
    'heroEyebrow', '瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营',
    'heroTitleLine1', '百年恒续',
    'heroTitleLine2', '为爱恒热',
    'heroSloganEn', 'EVERHOT FOR EVERLOVE',
    'heroClaim', '大户型选恒热，多点用水没烦恼',
    'ctaSlogan', '大户型选恒热 · 多点用水没烦恼',
    'primaryCtaText', '家用产品',
    'primaryCtaHref', '#residential',
    'secondaryCtaText', '商用方案',
    'secondaryCtaHref', '#commercial'
  ),
  jsonb_build_object(
    'technicalStats', jsonb_build_array(
      jsonb_build_object('value', '≥105%', 'label', '冷凝热效率', 'sortOrder', 0, 'visible', true),
      jsonb_build_object('value', '≤5s', 'label', '出热水时间', 'sortOrder', 1, 'visible', true),
      jsonb_build_object('value', 'COP 4.2+', 'label', '系统能效比', 'sortOrder', 2, 'visible', true),
      jsonb_build_object('value', '24h', 'label', '商用连续供热', 'sortOrder', 3, 'visible', true)
    ),
    'sustainabilityStats', jsonb_build_array(
      jsonb_build_object('value', '38%', 'label', '平均能耗降低', 'sortOrder', 0, 'visible', true),
      jsonb_build_object('value', '1,200+', 'label', '节能改造项目', 'sortOrder', 1, 'visible', true),
      jsonb_build_object('value', '6,800t', 'label', '年减少碳排放', 'sortOrder', 2, 'visible', true)
    ),
    'serviceProvinceCount', '30',
    'serviceOutletCount', '200+',
    'serviceNetworkText', '覆盖全国 30 省市，200+ 授权服务网点'
  ),
  jsonb_build_object(
    'operatorGroupName', '瑞合瑞德暖通科技集团',
    'operatorGroupNameEn', 'Rhautt Comfort',
    'operatorGroupUrl', 'https://rhautt.com',
    'parentBrandRelationText', '瑞美（Rheem）集团旗下 · 瑞合瑞德集团中国运营',
    'rheemUrl', 'https://www.rheem.com.cn',
    'ruudUrl', 'https://www.ruud.com.cn',
    'groupSiteUrl', 'https://rhautt.com'
  ),
  jsonb_build_object(
    'customerServiceHotline', '400-888-8888',
    'customerServiceTelHref', 'tel:4008888888',
    'serviceHours', '周一至周六 9:00—18:00',
    'businessEmail', 'business@everhot.com.cn',
    'mediaEmail', 'pr@everhot.com.cn',
    'privacyEmail', 'privacy@everhot.com.cn',
    'dealerJoinEmail', 'dealer@rhautt.com',
    'contactFormSuccessText', '留言已提交，恒热客服将尽快与您联系。',
    'urgentRepairNote', '提交后将由客服回拨。紧急报修请直接致电 400-888-8888。',
    'contactCards', jsonb_build_array(
      jsonb_build_object('tag', '客服', 'title', '全国客服热线', 'body', '产品咨询、使用指导、售后报修', 'linkText', '400-888-8888', 'href', 'tel:4008888888', 'sortOrder', 0, 'visible', true),
      jsonb_build_object('tag', '售后', 'title', '预约上门维修', 'body', '在线预约授权服务工程师上门检测维修。', 'linkText', '立即预约', 'href', '/find-a-pro/', 'sortOrder', 1, 'visible', true),
      jsonb_build_object('tag', '商务', 'title', '工程与商务合作', 'body', '酒店、公寓、综合体项目与集采合作。', 'linkText', 'business@everhot.com.cn', 'href', 'mailto:business@everhot.com.cn', 'sortOrder', 2, 'visible', true),
      jsonb_build_object('tag', '加盟', 'title', '经销商加盟', 'body', '申请成为恒热授权经销商。', 'linkText', '加盟申请', 'href', '/professionals/residential/partner-programs/', 'sortOrder', 3, 'visible', true),
      jsonb_build_object('tag', '媒体', 'title', '媒体与品牌', 'body', '媒体采访与品牌合作。', 'linkText', 'pr@everhot.com.cn', 'href', 'mailto:pr@everhot.com.cn', 'sortOrder', 4, 'visible', true),
      jsonb_build_object('tag', '集团', 'title', '集团与其他品牌', 'body', '瑞美（Rheem）集团品牌矩阵，瑞合瑞德集团中国运营。', 'linkText', '访问集团官网', 'href', 'https://rhautt.com', 'sortOrder', 5, 'visible', true)
    )
  ),
  jsonb_build_object(
    'dealerLocatorButtonText', '查找经销商',
    'dealerLocatorPageTitle', '查找授权经销商 | 恒热 Everhot',
    'dealerLocatorDescription', '覆盖全国 30 省市，200+ 授权服务网点，专业安装工程师，完善售后保障。',
    'dealerSearchPlaceholder', '输入城市 / 区域 / 地址，如：上海 浦东',
    'nearestDealerButtonText', '离我最近',
    'dealerJoinTitle', '成为恒热授权经销商',
    'dealerJoinDescription', '加入恒热经销商网络，获取独家授权、培训支持与市场资源',
    'dealerJoinButtonText', '申请加盟',
    'dealerJoinHref', 'mailto:dealer@rhautt.com',
    'authorizedServiceStandards', jsonb_build_array(
      jsonb_build_object('value', 'Rheem认证', 'label', '官方认证安装工程师', 'sortOrder', 0, 'visible', true),
      jsonb_build_object('value', '5年质保', 'label', '整机售后保障', 'sortOrder', 1, 'visible', true),
      jsonb_build_object('value', '48h响应', 'label', '售后上门时效', 'sortOrder', 2, 'visible', true),
      jsonb_build_object('value', '正品承诺', 'label', '官方渠道授权货源', 'sortOrder', 3, 'visible', true)
    )
  ),
  jsonb_build_object(
    'icpNumber', '沪ICP备XXXXXXXX号',
    'icpUrl', 'https://beian.miit.gov.cn/',
    'copyrightText', '© 2026 Everhot 恒热 · 瑞合瑞德暖通科技集团 · Everhot 为注册商标',
    'copyrightYear', '2026',
    'copyrightOwner', '瑞合瑞德暖通科技集团',
    'trademarkText', 'Everhot / 恒热 为注册商标',
    'privacyPolicyHref', '/privacy/',
    'cookiePolicyHref', '/privacy/#cookie',
    'legalStatementHref', '/privacy/#terms'
  ),
  jsonb_build_object(
    'privacyEffectiveDate', '2026-XX-XX',
    'privacyLastUpdatedDate', '2026-XX-XX',
    'privacyVersion', 'v1.0',
    'legalOperatorName', '【运营主体全称】',
    'registeredAddress', '【注册地址】',
    'privacyContactEmail', 'privacy@everhot.com.cn',
    'privacyContactHotline', '400-888-8888'
  ),
  jsonb_build_object(
    'homeMetaTitle', '恒热 Everhot | 中央采暖·热水·制冷整体解决方案',
    'homeMetaDescription', '恒热 Everhot —— 百年恒续，为爱恒热。专注家用与商用中央采暖、热水、制冷整体解决方案，瑞美集团旗下品牌。',
    'homeMetaKeywords', '恒热,Everhot,壁挂炉,热水器,中央热水,中央采暖,空气能,商用热水,家用采暖',
    'ogSiteName', 'Everhot 中国 Everhot China',
    'defaultOgImage', 'https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp',
    'defaultTwitterImage', 'https://www.everhot.com.cn/assets/img/hero-poster-desktop.webp',
    'canonicalBaseUrl', 'https://www.everhot.com.cn/',
    'organizationName', 'Everhot 中国 Everhot China',
    'organizationLogo', 'https://www.everhot.com.cn/assets/img/brand/everhot-logo.png',
    'parentOrganizationName', 'Rhautt Comfort 瑞合瑞德暖通科技集团',
    'parentOrganizationUrl', 'https://rhautt.com',
    'sameAs', 'https://rhautt.com',
    'sitemapUrl', 'https://www.everhot.com.cn/sitemap.xml'
  ),
  jsonb_build_object(
    'analyticsEndpoint', '',
    'analyticsConsentEnabled', true,
    'cookieConsentText', '本站使用 Cookie 与匿名统计以保障基本功能并改善体验。继续浏览即表示同意，您也可拒绝非必要统计。详见隐私政策。',
    'cookieDenyText', '拒绝非必要',
    'cookieAcceptText', '同意'
  )
FROM rhautt_nexus.tenant_brand_sites site
WHERE lower(site.code) = 'everhot'
  AND site.deleted_at IS NULL
ON CONFLICT (tenant_id, site_id) DO NOTHING;
