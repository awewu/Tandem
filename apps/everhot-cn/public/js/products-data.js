/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 产品数据库（可替换占位层）
   SWAPPABLE PRODUCT DB.
   后台 / API 上线后，只需用同结构的数据替换 /* AUTO-GENERATED 自 Nexus 公开端点 2026-07-01T01:04:58.552Z；勿手改数组，改后台后重跑 fetch-products-from-nexus.mjs */
/* AUTO-GENERATED 自 Nexus 公开端点 2026-07-01T02:15:17.542Z；勿手改数组，改后台后重跑 fetch-products-from-nexus.mjs */
/* AUTO-GENERATED 自 Nexus 公开端点 2026-07-22T13:11:48.455Z；勿手改数组，改后台后重跑 fetch-products-from-nexus.mjs */
window.EVERHOT_PRODUCTS = [];

/* 分类工具：按 cat+sys 取产品；按 slug 取单品 */
window.EVERHOT_CATALOG = {
  by:function(cat,sys){ return window.EVERHOT_PRODUCTS.filter(function(p){return p.cat===cat&&p.sys===sys;}); },
  one:function(slug){ return window.EVERHOT_PRODUCTS.filter(function(p){return p.slug===slug;})[0]||null; }
};
