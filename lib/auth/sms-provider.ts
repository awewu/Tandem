/**
 * SMS Provider · 短信验证码下发接入口 (留好接入口)
 *
 * 解析当前短信服务商, 由 .env `SMS_PROVIDER` 驱动:
 *   - 'log'    : dev 把验证码打到服务端日志 (不发真实短信, 联调用)
 *   - 'aliyun' / 'tencent' : 真实服务商 (待接 SDK, 见下方 scaffold)
 *   - 缺省/none : 返回 null → 调用方诚实报"待配置", 不伪造验证码
 *
 * 接入真实服务商: 在 getSmsProvider() 的 switch 加分支, 实现 sendVerificationCode.
 */

export interface SmsProvider {
  name: string;
  /** 下发 6 位验证码到手机号. 失败抛错. */
  sendVerificationCode(phone: string, code: string): Promise<void>;
}

/** Dev provider: 验证码打到服务端日志 (仅 dev 联调, 不真实下发短信). */
class LogSmsProvider implements SmsProvider {
  name = 'log';
  async sendVerificationCode(phone: string, code: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.info(`[sms:log] 验证码 ${code} → ${phone} (dev only · 未真实下发短信)`);
  }
}

/**
 * 返回当前配置的短信服务商; 未配置返回 null.
 *
 * 接真实服务商示例 (待实现):
 *   case 'aliyun':
 *     return new AliyunSmsProvider({
 *       accessKeyId: process.env.SMS_ALIYUN_ACCESS_KEY_ID!,
 *       accessKeySecret: process.env.SMS_ALIYUN_ACCESS_KEY_SECRET!,
 *       signName: process.env.SMS_ALIYUN_SIGN_NAME!,
 *       templateCode: process.env.SMS_ALIYUN_TEMPLATE_CODE!,
 *     });
 */
export function getSmsProvider(): SmsProvider | null {
  const p = (process.env.SMS_PROVIDER ?? 'none').toLowerCase();
  switch (p) {
    case 'log':
      return new LogSmsProvider();
    // case 'aliyun':  return new AliyunSmsProvider({ ... });
    // case 'tencent': return new TencentSmsProvider({ ... });
    case 'none':
    default:
      return null;
  }
}

export function isSmsConfigured(): boolean {
  return getSmsProvider() !== null;
}
