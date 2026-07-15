import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 配置 — 移动端 (Android / iOS) 瘦客户端.
 *
 * 架构与 Tauri 桌面端同构: WebView 加载远端 Next.js HTTPS 服务,
 * 本地壳仅处理系统集成 (返回键、状态栏、安全区域、外链).
 *
 * server.url 由构建环境变量 TANDEM_MOBILE_SERVER_URL 注入:
 *   - dev      : http://<dev-ip>:3005
 *   - staging  : https://staging.tandem.example.com
 *   - prod     : https://ai.rhautt.com
 * 生产强制 HTTPS; 开发允许 HTTP (secure cookie 在 dev 下为 false).
 *
 * webDir 指向 scripts/build-mobile-bootstrap.mjs 生成的连接页.
 * 连接页在无网络 / 服务器不可达时显示错误页 + 重试.
 */
const serverUrl = process.env.TANDEM_MOBILE_SERVER_URL ?? 'http://10.0.2.2:3005';
const isHttp = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'local.tandem.mobile',
  appName: 'Tandem',
  webDir: 'dist/mobile',
  server: {
    // HTTP 开发环境用 http scheme, 避免 https origin 下 cookie domain 不匹配导致登录失败.
    // 生产环境强制 https.
    androidScheme: isHttp ? 'http' : 'https',
    url: serverUrl,
    cleartext: isHttp,
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: isHttp,
    backgroundColor: '#0E0E0E',
  },
  ios: {
    backgroundColor: '#0E0E0E',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0E0E0E',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'none',
      resizeOnFullScreen: false,
      style: 'DARK',
    },
  },
};

export default config;
