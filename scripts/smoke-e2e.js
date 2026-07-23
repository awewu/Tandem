#!/usr/bin/env node
/**
 * 烟测脚本：门户 → 产品目录底座 → 返回门户
 * 前置：./scripts/dev-start-all.sh 已启动所有服务
 */
const { chromium } = require('playwright');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  try {
    // 1. 登录
    console.log('1. 访问登录页...');
    await page.goto('http://localhost:5000/?returnUrl=/hub');
    await page.locator('input[type="text"]').fill('13900000000');
    await page.locator('input[type="password"]').fill('Super@2026');
    await page.locator('button:has-text("登录")').click();

    // 2. 进入统一门户
    console.log('2. 等待进入统一门户...');
    await page.waitForURL('http://localhost:5000/hub', { timeout: 10000 });
    const hubTitle = await page.locator('text=产品目录').first().isVisible().catch(() => false);
    console.log('   门户可见:', hubTitle);

    // 3. 点击产品目录卡片（5000 内部 /products 链接）
    console.log('3. 点击产品目录卡片...');
    const productLink = page.locator('a[href*="/products"]').first();
    await productLink.waitFor({ state: 'visible', timeout: 5000 });
    await productLink.click();

    // 4. 5000 原生产品库
    console.log('4. 等待 5000 原生产品库...');
    await page.waitForURL(/:5000\/products/, { timeout: 10000 });
    const productName = await page.locator('text=5000 原生产品库').first().isVisible().catch(() => false);
    console.log('   原生产品库已显示:', productName);

    // 5. 返回门户按钮
    console.log('5. 点击返回门户...');
    const returnBtn = page.locator('a:has-text("返回门户")');
    await returnBtn.waitFor({ state: 'visible', timeout: 5000 });
    await returnBtn.click();

    // 6. 回到门户
    console.log('6. 等待回到门户...');
    await page.waitForURL('http://localhost:5000/hub', { timeout: 10000 });
    console.log('   已返回门户');

    console.log('\n✅ 全链路烟测通过');
  } catch (err) {
    errors.push(err.message);
    console.error('\n❌ 烟测失败:', err.message);
    await page.screenshot({ path: '.logs/dev/smoke-e2e-failure.png' });
    console.log('   失败截图: .logs/dev/smoke-e2e-failure.png');
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
