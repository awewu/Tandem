import { Injectable, Logger } from '@nestjs/common';

interface BrandData {
  news: { title: string; date: string; url: string }[];
  products: { name: string; category: string; url: string }[];
  trainings: { title: string; type: string; url: string }[];
  campaigns: { title: string; url: string }[];
  fetchedAt: string;
}

const TTL_MS = 6 * 60 * 60 * 1000; // 6小时缓存

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  private cache: BrandData | null = null;
  private fetchedAt = 0;

  async getData(): Promise<BrandData> {
    if (this.cache && Date.now() - this.fetchedAt < TTL_MS) return this.cache;
    return this.sync();
  }

  async sync(): Promise<BrandData> {
    const TARGETS = [
      'https://rheem.com.cn',
      'https://rheem.com.cn/news',
      'https://rheem.com.cn/products',
      'https://rheem.com.cn/training',
    ];

    const htmls = await Promise.allSettled(
      TARGETS.map(url =>
        fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RheemBot/1.0)' },
          signal: AbortSignal.timeout(8000),
        }).then(r => r.ok ? r.text() : '')
      )
    );

    const [homeHtml, newsHtml, productsHtml, trainingHtml] = htmls.map(r =>
      r.status === 'fulfilled' ? r.value : ''
    );

    const data: BrandData = {
      news:      this.extractNews(newsHtml || homeHtml),
      products:  this.extractProducts(productsHtml || homeHtml),
      trainings: this.extractTrainings(trainingHtml || homeHtml),
      campaigns: this.extractCampaigns(homeHtml),
      fetchedAt: new Date().toISOString(),
    };

    if (data.news.length || data.products.length) {
      this.cache = data;
      this.fetchedAt = Date.now();
      this.logger.log(`Brand data synced: ${data.news.length} news, ${data.products.length} products`);
    } else {
      // 返回兜底数据
      this.logger.warn('rheem.com.cn unreachable, using fallback brand data');
      return this.fallback();
    }

    return data;
  }

  private extractNews(html: string) {
    const results: BrandData['news'] = [];
    // 匹配新闻列表项：<a href="...">标题</a> 附近的日期
    const linkRe = /<a[^>]+href="([^"]*news[^"]*)"[^>]*>([^<]{5,80})<\/a>/gi;
    const dateRe = /(\d{4}[年/-]\d{1,2}[月/-]\d{1,2})/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null && results.length < 10) {
      const title = m[2].trim().replace(/&amp;/g, '&');
      if (title.length < 5) continue;
      const dateMatch = html.slice(Math.max(0, m.index - 200), m.index + 200).match(dateRe);
      results.push({
        title,
        url: m[1].startsWith('http') ? m[1] : `https://rheem.com.cn${m[1]}`,
        date: dateMatch?.[0] || '',
      });
    }
    return results;
  }

  private extractProducts(html: string) {
    const results: BrandData['products'] = [];
    const re = /<a[^>]+href="([^"]*product[^"]*)"[^>]*>([^<]{3,60})<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && results.length < 20) {
      const name = m[2].trim();
      if (name.length < 3) continue;
      const category = m[1].includes('water') ? '热水' :
                       m[1].includes('heat')  ? '采暖' :
                       m[1].includes('air')   ? '新风' : '其他';
      results.push({ name, category, url: m[1].startsWith('http') ? m[1] : `https://rheem.com.cn${m[1]}` });
    }
    return results;
  }

  private extractTrainings(html: string) {
    const results: BrandData['trainings'] = [];
    const re = /<a[^>]+href="([^"]*train[^"]*|[^"]*certif[^"]*|[^"]*课程[^"]*|[^"]*培训[^"]*)"[^>]*>([^<]{3,60})<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && results.length < 10) {
      const title = m[2].trim();
      if (title.length < 3) continue;
      const type = m[1].includes('certif') ? '认证' : '培训';
      results.push({ title, type, url: m[1].startsWith('http') ? m[1] : `https://rheem.com.cn${m[1]}` });
    }
    return results;
  }

  private extractCampaigns(html: string) {
    const results: BrandData['campaigns'] = [];
    const re = /<a[^>]+href="([^"]*activ[^"]*|[^"]*活动[^"]*|[^"]*promo[^"]*)"[^>]*>([^<]{3,60})<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && results.length < 6) {
      const title = m[2].trim();
      if (title.length < 3) continue;
      results.push({ title, url: m[1].startsWith('http') ? m[1] : `https://rheem.com.cn${m[1]}` });
    }
    return results;
  }

  private fallback(): BrandData {
    return {
      news: [
        { title: 'Rheem 2026 AHR Expo 发布可持续发展路线图', date: '2026-01', url: 'https://rheem.com.cn/news' },
        { title: '"Engineered for Life" 品牌焕新，庆祝百年', date: '2025-12', url: 'https://rheem.com.cn/news' },
        { title: 'Renaissance® 商用热泵系列扩展至3-10吨', date: '2025-11', url: 'https://rheem.com.cn/news' },
      ],
      products: [
        { name: '中央热水系统', category: '热水', url: 'https://rheem.com.cn/products' },
        { name: '地暖分集水器系统', category: '采暖', url: 'https://rheem.com.cn/products' },
        { name: '全热交换新风机', category: '新风', url: 'https://rheem.com.cn/products' },
        { name: 'Econet 智控系统', category: '智控', url: 'https://rheem.com.cn/products' },
      ],
      trainings: [
        { title: 'Rheem 经销商认证培训', type: '认证', url: 'https://rheem.com.cn/training' },
        { title: 'Econet 智控安装培训', type: '培训', url: 'https://rheem.com.cn/training' },
      ],
      campaigns: [
        { title: '2026年春季推广活动', url: 'https://rheem.com.cn/activities' },
      ],
      fetchedAt: new Date().toISOString(),
    };
  }
}
