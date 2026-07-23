import type { MetadataRoute } from 'next';
import { GROUP } from '../lib/brand';
import { NEWS } from '../lib/news';
import { listSiteProducts } from '../lib/site-products';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${GROUP.domain}`;

/** 静态路由 → 优先级（未列出的默认 0.6） */
const STATIC_ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '',                    priority: 1.0, freq: 'weekly' },
  { path: '/brands',             priority: 0.9, freq: 'monthly' },
  { path: '/solutions',          priority: 0.8, freq: 'monthly' },
  { path: '/products',           priority: 0.8, freq: 'weekly' },
  { path: '/sustainability',     priority: 0.8, freq: 'monthly' },
  { path: '/about',              priority: 0.7, freq: 'monthly' },
  { path: '/about/our-story',    priority: 0.6, freq: 'yearly' },
  { path: '/about/leadership',   priority: 0.6, freq: 'yearly' },
  { path: '/about/our-values',   priority: 0.6, freq: 'yearly' },
  { path: '/about/governance',   priority: 0.6, freq: 'yearly' },
  { path: '/professional',       priority: 0.7, freq: 'monthly' },
  { path: '/dealers',            priority: 0.7, freq: 'monthly' },
  { path: '/news',               priority: 0.7, freq: 'weekly' },
  { path: '/careers',            priority: 0.6, freq: 'monthly' },
  { path: '/contact',            priority: 0.7, freq: 'monthly' },
  { path: '/calculator',         priority: 0.5, freq: 'monthly' },
  { path: '/warranty',           priority: 0.5, freq: 'monthly' },
  { path: '/privacy',            priority: 0.3, freq: 'yearly' },
  { path: '/terms',              priority: 0.3, freq: 'yearly' },
  { path: '/recall',             priority: 0.3, freq: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await listSiteProducts();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));

  const productEntries: MetadataRoute.Sitemap = products.items.map((p) => ({
    url: `${SITE_URL}/products/${p.id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const newsEntries: MetadataRoute.Sitemap = NEWS.map((n) => ({
    url: `${SITE_URL}/news/${n.slug}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  return [...staticEntries, ...productEntries, ...newsEntries];
}
