import type { MetadataRoute } from 'next';
import { GROUP } from '../lib/brand';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? `https://${GROUP.domain}`;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
