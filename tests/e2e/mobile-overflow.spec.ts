/**
 * Mobile horizontal-overflow audit · 真渲染量取横向溢出 (非静态猜测)
 *
 * 在 iPhone 14 (390×844) 宽度下逐页加载, 量
 *   document.documentElement.scrollWidth > clientWidth (= 页面被撑宽 = 横向溢出)
 * 并定位「右边缘超出视口」的罪魁元素 (tag/class/尺寸/文本片段), 输出报告.
 *
 * 用法 (dev server 已在 3005):
 *   PORT=3005 npx playwright test mobile-overflow --project=chromium --reporter=list
 *
 * 首轮设计为「软断言」: 用 expect.soft 标记溢出但不中断, 一次跑完拿到完整清单.
 */

import { test, expect } from '@playwright/test';

const SCAN_WIDTH = Number(process.env.SCAN_WIDTH ?? 390);
test.use({ viewport: { width: SCAN_WIDTH, height: 844 } });
test.setTimeout(180_000);

// 静态路由 (动态 [id] 路由需具体数据, 不在自动扫描范围)
const ROUTES = [
  '/',
  '/okr',
  '/okr/calibration',
  '/kpi',
  '/tandem',
  '/im',
  '/analytics',
  '/report/weekly',
  '/mcp',
  '/nine-box/suggestions',
  '/governance/three-departments',
  '/admin/organization',
  '/admin/organizations',
  '/admin/usage',
  '/admin/kpi/bonus-payout',
  '/admin/kpi/setup',
  '/admin/kpi/health-dashboard',
  '/convergence',
  '/persona/training',
  '/shouchao',
  '/settings',
];

interface OffenderInfo {
  scrollWidth: number;
  clientWidth: number;
  overflowPx: number;
  offenders: Array<{ tag: string; cls: string; w: number; right: number; text: string }>;
}

test('mobile horizontal-overflow sweep @390px', async ({ page }) => {
  const report: Array<{ route: string; info: OffenderInfo | null; err?: string }> = [];

  for (const route of ROUTES) {
    try {
      // 不用 networkidle: dev server 的 HMR websocket / SSE 长连接永不 idle.
      await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // 给客户端 hydration / 首屏 fetch 落定
      await page.waitForTimeout(1500);

      const info = await page.evaluate<OffenderInfo>(() => {
        const docEl = document.documentElement;
        const vw = docEl.clientWidth;
        const scrollWidth = docEl.scrollWidth;
        const offenders: OffenderInfo['offenders'] = [];
        if (scrollWidth > vw + 1) {
          const all = Array.from(document.querySelectorAll<HTMLElement>('body *'));
          for (const el of all) {
            const r = el.getBoundingClientRect();
            // 右边缘越界 且 元素本身不是全宽容器 (排除 body 级)
            if (r.right > vw + 1 && r.width > 8 && r.width <= scrollWidth) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className || '').toString().slice(0, 80),
                w: Math.round(r.width),
                right: Math.round(r.right),
                text: (el.textContent || '').trim().slice(0, 40),
              });
            }
          }
          // 取「最深 + 最靠右」的几个 (按 right 降序, 去掉明显是祖先的大块)
          offenders.sort((a, b) => b.right - a.right);
        }
        return {
          scrollWidth,
          clientWidth: vw,
          overflowPx: scrollWidth - vw,
          offenders: offenders.slice(0, 6),
        };
      });

      report.push({ route, info });
    } catch (e) {
      report.push({ route, info: null, err: (e as Error).message });
    }
  }

  // ---- 打印报告 ----
  const overflowing = report.filter((r) => r.info && r.info.overflowPx > 1);
  // eslint-disable-next-line no-console
  console.log(`\n================ MOBILE OVERFLOW REPORT (${SCAN_WIDTH}px) ================`);
  for (const r of report) {
    if (!r.info) {
      // eslint-disable-next-line no-console
      console.log(`  [ERR ] ${r.route} :: ${r.err}`);
      continue;
    }
    const flag = r.info.overflowPx > 1 ? 'XXXX' : ' ok ';
    // eslint-disable-next-line no-console
    console.log(`  [${flag}] ${r.route}  scroll=${r.info.scrollWidth} client=${r.info.clientWidth} over=${r.info.overflowPx}px`);
    if (r.info.overflowPx > 1) {
      for (const o of r.info.offenders) {
        // eslint-disable-next-line no-console
        console.log(`           ↳ <${o.tag} class="${o.cls}"> w=${o.w} right=${o.right} "${o.text}"`);
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(`================ ${overflowing.length}/${report.length} routes overflow ================\n`);

  // 软断言: 不中断, 但留下红字便于回归
  for (const r of overflowing) {
    expect.soft(r.info!.overflowPx, `${r.route} 横向溢出 ${r.info!.overflowPx}px`).toBeLessThanOrEqual(1);
  }
});
