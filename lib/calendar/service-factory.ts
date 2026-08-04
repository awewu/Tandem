import { createAppContext } from '@/lib/repositories/app-context-factory';
import { getStore } from '@/lib/storage/repository';
import { sendEmail } from '@/lib/infra/email';
import { resolvePersonalUserEmailSmtp } from '@/lib/email/global-email-config';
import { CalendarService } from '@/lib/services/calendar-service';

async function resolveCalendarSender(
  message: { senderUserId?: string; senderEmail?: string },
  fallbackSenderUserId?: string,
) {
  const requestedSenderUserId = message.senderUserId ?? fallbackSenderUserId;
  const sender = requestedSenderUserId ? await getStore().auth.users.findById(requestedSenderUserId) : null;
  const senderEmail = sender?.email ?? message.senderEmail ?? '';
  if (!sender || !senderEmail) {
    return { ok: false as const, error: '未找到日程发起人邮箱，日程已保存但邮件通知未发送。' };
  }
  const resolved = await resolvePersonalUserEmailSmtp(sender.id);
  if (!resolved?.smtp) {
    return {
      ok: false as const,
      error: `发起人 ${senderEmail} 未配置邮箱，日程已保存但邮件通知未发送；请先到「设置 - 邮箱」绑定并验证邮箱。`,
    };
  }
  return { ok: true as const, senderEmail, resolved };
}

export function createCalendarService(senderUserId?: string): CalendarService {
  return new CalendarService(createAppContext(), {
    listUsers: async (tenantId) => {
      const users = await getStore().auth.users.list({ tenantId });
      return users.map((user) => ({ id: user.id, email: user.email, name: user.name, disabled: user.disabled }));
    },
    checkEmailSender: async (message) => resolveCalendarSender(message, senderUserId),
    sendEmail: async (message) => {
      const sender = await resolveCalendarSender(message, senderUserId);
      if (!sender.ok) return { ok: false, error: sender.error };
      const { senderUserId: _senderUserId, senderEmail: _senderEmail, ...mail } = message;
      return sendEmail({ ...mail, from: sender.senderEmail, smtp: sender.resolved.smtp, imap: sender.resolved.imap });
    },
  });
}
