import type { Metadata, Viewport } from 'next';
import './globals.css';
import { GROUP, CONTACT, LINKS } from '../lib/brand';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import Analytics from '../components/Analytics';
import { HubReturnButton } from '@rhautt/shared-auth';

// 字体：使用 globals.css 中的自托管系统字体栈（--font-inter / --font-bebas），
// 不依赖 Google Fonts 构建时抓取，确保中国大陆构建与运行稳定。

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${GROUP.domain}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${GROUP.nameCn} | ${GROUP.taglineCn}`,
    template: `%s | ${GROUP.nameShort}`,
  },
  description: `${GROUP.nameCn}（${GROUP.nameEn}）— 瑞美集团 Rheem · Ruud · EverHot 中国独家授权运营，中央热水 / 采暖制冷 / 空气品质 / 水处理 / 智控系统集成服务商。`,
  applicationName: GROUP.nameCn,
  keywords: ['瑞合瑞德', 'Rhautt', 'Rheem 中国', 'Ruud', 'EverHot', '中央热水', '采暖制冷', '暖通系统集成'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: GROUP.nameCn,
    title: `${GROUP.nameCn} | ${GROUP.taglineCn}`,
    description: `瑞美集团 Rheem · Ruud · EverHot 中国独家授权运营 — 建筑舒适系统集成`,
    url: SITE_URL,
    locale: 'zh_CN',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: GROUP.nameCn,
  alternateName: GROUP.nameEn,
  url: SITE_URL,
  slogan: GROUP.taglineCn,
  foundingDate: String(GROUP.foundedYear),
  telephone: CONTACT.hotline,
  email: CONTACT.emails.service,
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'CN',
    addressRegion: '上海市',
    addressLocality: '浦东新区',
  },
  sameAs: [LINKS.rheem, LINKS.ruud, LINKS.everhot],
};

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: GROUP.nameCn,
  url: SITE_URL,
  inLanguage: 'zh-CN',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-v20-latin-regular.woff2" crossOrigin="anonymous" />
        <link rel="preload" as="font" type="font/woff2" href="/fonts/poppins-v24-latin-700.woff2" crossOrigin="anonymous" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <Analytics />
        <HubReturnButton />
      </body>
    </html>
  );
}
