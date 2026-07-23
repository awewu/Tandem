const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const AUTH = 'services/api/src/modules/auth';

describe('auth 真 OTP · H1 后门根除 + 短信登录锁定', () => {
  test('OtpService：随机码 + bcrypt 哈希 + 过期 + 尝试上限 + 重发冷却，无 000000', () => {
    const otp = read(`${AUTH}/otp.service.ts`);
    expect(otp).toContain('bcrypt.hash');
    expect(otp).toContain('bcrypt.compare');
    expect(otp).toContain('MAX_ATTEMPTS');
    expect(otp).toContain('RESEND_COOLDOWN_MS');
    expect(otp).toContain('consumedAt');
    expect(otp).not.toContain("=== '000000'");
    expect(otp).not.toContain("smsCode === '000000'");
  });

  test('短信登录走账号锁定（recordFail）且经 OtpService 校验', () => {
    const svc = read(`${AUTH}/auth.service.ts`);
    expect(svc).toContain('loginWithSms');
    expect(svc).toContain('this.otp.verifyCode');
    expect(svc).toContain('recordFail');
    expect(svc).toContain('isLocked');
    expect(svc).not.toContain("=== '000000'");
  });

  test('legacy auth 服务已退役，不存在备用验证码实现', () => {
    expect(fs.existsSync(path.join(ROOT, 'server/modules/auth/auth.service.js'))).toBe(false);
  });

  test('控制器暴露 send-sms / login-sms（@Public 预认证）', () => {
    const ctrl = read(`${AUTH}/auth.controller.ts`);
    expect(ctrl).toContain("@Post('send-sms')");
    expect(ctrl).toContain("@Post('login-sms')");
    expect(ctrl).toContain('sendSmsCode');
    expect(ctrl).toContain('loginWithSms');
  });

  test('DefaultSmsSender 生产 fail-closed（未配置服务商不静默放行）', () => {
    const sender = read(`${AUTH}/sms-sender.ts`);
    expect(sender).toContain("NODE_ENV === 'production'");
    expect(sender).toContain('throw new Error');
    expect(sender).toContain('SMS_PROVIDER');
  });

  test('迁移 019 建 OTP 挑战表（仅存哈希）', () => {
    const m = read('database/postgres/migrations/019_auth_otp_challenges.sql');
    expect(m).toContain('auth_otp_challenges');
    expect(m).toContain('code_hash');
    expect(m).toContain('expires_at');
  });
});
