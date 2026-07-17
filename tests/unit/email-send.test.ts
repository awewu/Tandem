import { afterEach, describe, expect, it, vi } from 'vitest';

describe('sendEmail', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('does not wait for appending the sent-folder copy after SMTP succeeds', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'message-1' });
    const appendSentMessage = vi.fn(() => new Promise<string>(() => undefined));

    vi.doMock('nodemailer', () => ({
      default: {
        createTransport: vi.fn(() => ({ sendMail })),
      },
    }));
    vi.doMock('@/lib/integrations/email-tier1', () => ({ appendSentMessage }));

    const { sendEmail } = await import('@/lib/infra/email');
    const result = await Promise.race([
      sendEmail({
        to: ['colleague@example.com'],
        subject: '日程通知',
        text: '测试',
        smtp: { host: 'smtp.example.com', port: 465, secure: true, user: 'owner@example.com', pass: 'secret' },
        imap: { host: 'imap.example.com', port: 993, secure: true, user: 'owner@example.com', pass: 'secret' },
      }),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 25)),
    ]);

    expect(result).toMatchObject({ ok: true, messageId: 'message-1' });
    expect(sendMail).toHaveBeenCalledOnce();
    expect(appendSentMessage).toHaveBeenCalledOnce();
  });
});
