import { BadRequestException, HttpException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { hashPII } from '../compliance/compliance.pii';
import { OtpChallengeEntity } from './otp-challenge.entity';
import { SMS_SENDER, SmsSender } from './sms-sender';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const PHONE_RE = /^1[3-9]\d{9}$/;

/**
 * 真实短信 OTP：随机 6 位码，仅存 bcrypt 哈希，5 分钟过期，60 秒重发冷却，
 * 5 次尝试锁死，一次性消费。取代 legacy 内存 Map + 000000 后门。
 */
@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpChallengeEntity) private readonly otps: Repository<OtpChallengeEntity>,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
  ) {}

  private phoneHash(phone: string): string {
    return hashPII(phone.replace(/\D/g, ''));
  }

  async sendCode(phone: string, purpose = 'login'): Promise<{ sent: true }> {
    if (!PHONE_RE.test(phone || '')) throw new BadRequestException('手机号格式不正确');
    const phoneHash = this.phoneHash(phone);

    const recent = await this.otps.findOne({
      where: { phoneHash, createdAt: MoreThan(new Date(Date.now() - RESEND_COOLDOWN_MS)) },
      order: { createdAt: 'DESC' },
    });
    if (recent) throw new HttpException('验证码发送过于频繁，请稍后再试', 429);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.otps.save(this.otps.create({
      phoneHash,
      codeHash: await bcrypt.hash(code, 8),
      purpose,
      attempts: 0,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    }));
    await this.sms.send(phone, code);
    return { sent: true };
  }

  /** 校验并一次性消费；成功返回 true。失败按次数累计，超限或过期即失效。 */
  async verifyCode(phone: string, code: string, purpose = 'login'): Promise<boolean> {
    if (!phone || !code) return false;
    const phoneHash = this.phoneHash(phone);
    const challenge = await this.otps.findOne({
      where: { phoneHash, purpose, consumedAt: null as any, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
    if (!challenge) return false;
    if (challenge.attempts >= MAX_ATTEMPTS) return false;

    const ok = await bcrypt.compare(code, challenge.codeHash);
    if (!ok) {
      await this.otps.update({ id: challenge.id }, { attempts: challenge.attempts + 1 });
      return false;
    }
    await this.otps.update({ id: challenge.id }, { consumedAt: new Date() });
    return true;
  }

  /** 清理过期挑战（可由定时任务调用）。 */
  async purgeExpired(): Promise<void> {
    await this.otps.delete({ expiresAt: LessThan(new Date()) });
  }
}
