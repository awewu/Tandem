import { Injectable, Logger } from '@nestjs/common';

export const SMS_SENDER = 'SMS_SENDER';

export interface SmsSender {
  send(phone: string, code: string): Promise<void>;
}

/**
 * 默认短信发送器（可插拔）。
 * - 配置了真实服务商（SMS_PROVIDER + 凭据）→ 调用真实短信 API（此处留接入点）。
 * - 未配置：生产环境 **fail-closed**（抛错，绝不静默放行）；非生产打印验证码到日志（开发投递，
 *   仍是随机真实验证码，非 000000 后门）。
 */
@Injectable()
export class DefaultSmsSender implements SmsSender {
  private readonly logger = new Logger('SmsSender');
  private readonly provider = process.env.SMS_PROVIDER;

  async send(phone: string, code: string): Promise<void> {
    if (this.provider) {
      // TODO(接入): 依 SMS_PROVIDER 调用阿里云/腾讯云短信 API 下发 code。
      this.logger.log(`[sms] provider=${this.provider} 下发验证码至 ${phone}`);
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS provider 未配置，生产环境短信登录不可用（fail-closed）');
    }
    this.logger.warn(`[sms:dev] 未配置服务商，开发投递：${phone} => ${code}`);
  }
}
