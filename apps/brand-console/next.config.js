/** @type {import('next').NextConfig} */
// 后端访问全部在服务端完成（src/lib/brand.ts + /api/* route handlers）。
// 品牌运营数据面调用统一使用服务端铸造的 brand-service 令牌（scope=BRAND_TENANT），
// 令牌与 JWT_SECRET 从不下发到浏览器。配置见 .env.local：
//   NEXUS_API_URL     默认 https://web.rhautt.com
//   NEXUS_API_PREFIX  默认 /api/v2
//   JWT_SECRET        与 services/api 一致（铸服务令牌用）
//   BRAND_TENANT      默认 EVERHOT_TENANT_ID / Everhot 品牌运营 UUID    BRAND 默认 everhot
//   EVERHOT_DIR       everhot-cn 应用目录（发布时 spawn 构建脚本）
const path = require('path');

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

module.exports = nextConfig;
