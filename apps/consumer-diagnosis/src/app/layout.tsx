import type { Metadata, Viewport } from 'next';
import { Roboto, Oswald } from 'next/font/google';
import './globals.css';
import { BRAND, CONTACT, LEGAL, LINKS } from '../lib/brand';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import { HubReturnButton } from '@rhautt/shared-auth';

// Ruud 官方主字体 Roboto（变量名保留 --font-inter 以兼容 globals.css token）
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-inter',
  display: 'swap',
});

// Ruud 官方展示字体 Oswald（Brand Toolkit 指定）
const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-bebas',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${BRAND.domain}`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.nameCn} | ${BRAND.taglineCn}`,
    template: `%s | ${BRAND.nameCn}`,
  },
  description: `${BRAND.nameCn}（${BRAND.nameEn}）— AI 舒适家问诊，中央热水 / 采暖制冷 / 空气品质 / 水处理 / 智控系统选型推荐。`,
  applicationName: BRAND.nameCn,
  keywords: ['瑞诺瓦', 'Rysnova', 'AI 问诊', '舒适家', '中央热水', '采暖制冷', '暖通选型', '智能家居'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: BRAND.nameCn,
    title: `${BRAND.nameCn} | ${BRAND.taglineCn}`,
    description: `AI 驱动的舒适家居选型工具 — 中立、智能、精准`,
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
  name: BRAND.nameCn,
  alternateName: BRAND.nameEn,
  url: SITE_URL,
  slogan: BRAND.taglineCn,
  telephone: CONTACT.hotline,
  email: CONTACT.emails.service,
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'CN',
    addressRegion: '上海市',
    addressLocality: '浦东新区',
  },
};

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: BRAND.nameCn,
  url: SITE_URL,
  inLanguage: 'zh-CN',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${roboto.variable} ${oswald.variable}`}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <HubReturnButton />
      </body>
    </html>
  );
}
