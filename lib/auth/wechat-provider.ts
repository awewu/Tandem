/**
 * WeChat Provider · 微信扫码登录接入口 (留好接入口)
 *
 * 由 .env `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 驱动 (微信开放平台网站应用).
 * 未配置返回 null → 调用方诚实报"待配置".
 *
 * 接入真实开放平台: 实现 WechatOpenPlatformProvider
 *   - createQrTicket: 调微信 OAuth2 生成带 state 的扫码 URL / ticket
 *   - checkScan: 轮询 state 对应的扫码/确认状态; confirmed 时用 code 换 access_token → unionid
 *   详见: https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
 */

export interface WechatQrTicket {
  /** 服务端 state, 客户端轮询用 */
  ticket: string;
  /** 二维码图片 URL 或 微信授权 URL (前端渲染/跳转) */
  qrUrl: string;
  expiresInSec: number;
}

export type WechatScanState =
  | { status: 'pending' }
  | { status: 'scanned' }
  | { status: 'confirmed'; unionId: string; nickname?: string; avatar?: string }
  | { status: 'expired' };

export interface WechatProvider {
  name: string;
  createQrTicket(): Promise<WechatQrTicket>;
  checkScan(ticket: string): Promise<WechatScanState>;
}

/**
 * 返回当前配置的微信服务商; 未配置 (缺 APP_ID/SECRET) 返回 null.
 *
 * 接入后: return new WechatOpenPlatformProvider({
 *   appId: process.env.WECHAT_APP_ID!, appSecret: process.env.WECHAT_APP_SECRET!,
 *   redirectUri: process.env.WECHAT_REDIRECT_URI!,
 * });
 */
export function getWechatProvider(): WechatProvider | null {
  if (!process.env.WECHAT_APP_ID || !process.env.WECHAT_APP_SECRET) return null;
  // TODO: 实现并返回 WechatOpenPlatformProvider
  return null;
}

export function isWechatConfigured(): boolean {
  return getWechatProvider() !== null;
}
