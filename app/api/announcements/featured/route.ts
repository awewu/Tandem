/**
 * GET /api/announcements/featured
 *
 * 返回首页 Hero 轮播 + 公司动态条共用的精选数据.
 * 当前从 lib/intranet/featured 读取 seed 数据; M3 改为查 IntranetPost 表.
 */

import { NextResponse } from 'next/server';
import {
  HERO_SLIDES,
  LATEST_NEWS,
  FEATURED_ARCHIVE,
} from '@/lib/intranet/featured';

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({
    slides: HERO_SLIDES,
    news: LATEST_NEWS,
    archive: FEATURED_ARCHIVE,
  });
}
