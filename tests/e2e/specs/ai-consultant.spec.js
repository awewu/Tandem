/**
 * E2E测试: AI问诊三方案推荐
 * @description 测试用户完成AI问诊并获取三方案推荐的完整流程
 */

const { test, expect } = require('@playwright/test');

test.describe('AI问诊三方案推荐', () => {
  
  test.beforeEach(async ({ page }) => {
    // 访问管理面板
    await page.goto('/hvac-dashboard.html');
  });

  test('用户应该能看到AI问诊模块', async ({ page }) => {
    // 验证AI问诊卡片存在
    const aiCard = page.locator('.card:has-text("AI问诊三方案")');
    await expect(aiCard).toBeVisible();
    
    // 验证标签
    await expect(aiCard.locator('.tag:has-text("68%推荐率")')).toBeVisible();
    
    // 验证API端点显示
    await expect(aiCard.locator('text=/api/ai-consultant/recommend')).toBeVisible();
  });

  test('点击测试按钮应该显示三方案推荐结果', async ({ page }) => {
    // 点击AI问诊测试按钮
    const testButton = page.locator('button:has-text("测试AI问诊")');
    await testButton.click();
    
    // 等待结果显示
    const resultPanel = page.locator('#test-result');
    await expect(resultPanel).toBeVisible();
    
    // 验证成功消息
    await expect(page.locator('text=AI问诊测试成功')).toBeVisible();
    
    // 验证三方案数据存在
    const output = page.locator('#test-output');
    await expect(output).toContainText('basic');
    await expect(output).toContainText('comfort');
    await expect(output).toContainText('premium');
  });

  test('响应时间应该在合理范围内', async ({ page }) => {
    // 点击测试按钮
    const testButton = page.locator('button:has-text("测试AI问诊")');
    
    const startTime = Date.now();
    await testButton.click();
    
    // 等待结果
    await page.waitForSelector('text=AI问诊测试成功', { timeout: 5000 });
    const responseTime = Date.now() - startTime;
    
    // 验证响应时间 < 5秒
    expect(responseTime).toBeLessThan(5000);
  });
});

test.describe('API功能测试', () => {
  
  test('所有系统API应该在线', async ({ page }) => {
    const systems = [
      { name: '水路系统', tag: 'Darcy-Weisbach' },
      { name: '采暖系统', tag: '螺旋算法' },
      { name: '空调系统', tag: 'VRF设计' },
      { name: '五恒系统', tag: '毛细管辐射' },
      { name: '新风设计', tag: 'CFD优化' },
      { name: 'DOAS系统', tag: 'ASHRAE 62.1' }
    ];
    
    for (const system of systems) {
      const card = page.locator(`.card:has-text("${system.name}")`);
      await expect(card).toBeVisible();
      await expect(card.locator(`.feature-tag:has-text("${system.tag}")`)).toBeVisible();
      await expect(card.locator('.status-online')).toBeVisible();
    }
  });

  test('测试水路系统API', async ({ page }) => {
    const waterCard = page.locator('.card:has-text("水路系统设计")');
    const testButton = waterCard.locator('button:has-text("测试API")');
    
    await testButton.click();
    
    // 等待结果
    await page.waitForSelector('#test-result', { state: 'visible' });
    
    // 验证成功
    const output = page.locator('#test-output');
    await expect(output).toContainText('✅');
  });
});
