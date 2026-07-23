/**
 * V9 Routes Loader - 集中式路由注册
 * 替代 server-production.js 中分散的 app.use() 调用
 */

function loadRoutes(app) {
  const loaded = [];
  const failed = [];

  function mount(path, routeFile, description) {
    try {
      const router = require(routeFile);
      app.use(path, router);
      loaded.push({ path, description });
    } catch (err) {
      failed.push({ path, description, error: err.message });
      console.warn(`⚠️ [RoutesLoader] ${description} 挂载失败: ${err.message}`);
    }
  }

  // ===== 核心业务路由 =====
  mount('/api/business', '../../server/routes/business-domain', '业务域统一路由(39端点)');
  mount('/api/oneclick', '../../server/routes/oneclick-api', '一键计算API');
  mount('/api/calculation', '../../server/routes/calculation-api', '专业计算API');
  mount('/api/supreme', '../../server/routes/supreme-api', 'Supreme统一API');
  mount('/api/three-tier', '../../server/routes/threeTier', '三档方案API');
  mount('/api/custom-quotation', '../../server/routes/customQuotation', '自定义报价API');

  // ===== 设计工具路由 =====
  mount('/api/reports', '../../server/routes/reports', '报告与图纸');
  mount('/api/exports', '../../server/routes/exports', '导出功能');
  mount('/api/revit', '../../server/routes/revit-integration', 'Revit集成');
  mount('/api/ai-assistant', '../../server/routes/ai-assistant', 'AI设计助手');
  mount('/api/smart-routing', '../../server/routes/smart-routing', '智能管路');
  mount('/api/hotwater', '../../server/routes/hotwater', '热水系统');

  // ===== 流程管理路由 =====
  mount('/api/workflows', '../../server/routes/workflows', '工作流管理');
  mount('/api/delivery', '../../server/routes/delivery', '技术交付');
  mount('/api/package', '../../server/routes/packagePurchase', '套餐购买');

  // ===== 渠道/平台路由 =====
  mount('/api/channel', '../../server/api/channel-api', '渠道管理(25端点)');
  mount('/api/ppt-export', '../../server/api/ppt-export-api', 'PPT导出');

  // ===== V9 新增路由 =====
  mount('/api/v9', '../../server/v9/v9-api', 'V9新功能API');

  console.log(`\n📡 [RoutesLoader] ${loaded.length}/${loaded.length + failed.length} 路由挂载成功`);
  if (failed.length > 0) {
    console.log(`⚠️  ${failed.length} 个路由挂载失败:`);
    failed.forEach(f => console.log(`   - ${f.path}: ${f.error}`));
  }

  return { loaded, failed };
}

module.exports = { loadRoutes };
