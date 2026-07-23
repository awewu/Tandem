import type { MetadataRoute } from 'next';
import { BRAND } from '../lib/brand';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${BRAND.domain}`;

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/solutions', '/products', '/about', '/contact', '/privacy'];
  const now = new Date();
  return routes.map((r) => ({
    url: `${SITE_URL}${r}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: r === '' ? 1 : 0.7,
  }));
}
