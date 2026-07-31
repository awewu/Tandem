export type SiteMaterialKey = 'home-hero' | 'brand-story' | 'service-banner' | 'footer-cert';
export type SiteHeroCarouselKey = 'home-hero-carousel';
export type SiteAudienceCardsKey = 'home-audience-cards';

export type SiteHeroCarouselItem = {
  id: string;
  src: string;
  filename: string;
  mimeType: string;
  size: number;
  updatedAt: string;
  linkUrl?: string;
  remark?: string;
  visible?: boolean;
  sortOrder: number;
};

export type SiteAudienceCardItem = {
  id: string;
  tagZh: string;
  tagEn: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  visible: boolean;
  sortOrder: number;
};

export type SiteMaterialManifest = Partial<
  Record<SiteMaterialKey, { src: string; filename: string; mimeType: string; size: number; updatedAt: string }> &
    Record<SiteHeroCarouselKey, SiteHeroCarouselItem[]> &
    Record<SiteAudienceCardsKey, SiteAudienceCardItem[]>
>;
