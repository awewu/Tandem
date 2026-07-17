import { createAppContext } from '@/lib/repositories/app-context-factory';
import { getStore } from '@/lib/storage/repository';
import { sendEmail } from '@/lib/infra/email';
import { resolveUserEmailSmtp } from '@/lib/email/global-email-config';
import { CalendarService } from '@/lib/services/calendar-service';

export function createCalendarService(senderUserId?: string): CalendarService {
  return new CalendarService(createAppContext(), {
    listUsers: async (tenantId) => {
      const users = await getStore().auth.users.list({ tenantId });
      return users
        .filter((user) => !user.disabled)
        .map((user) => ({ id: user.id, email: user.email, name: user.name }));
    },
    sendEmail: async (message) => {
      const sender = senderUserId ? await getStore().auth.users.findById(senderUserId) : null;
      const resolved = sender
        ? await resolveUserEmailSmtp(sender.id, sender.email, sender.tenantId ?? 'default')
        : null;
      return sendEmail({ ...message, smtp: resolved?.smtp, imap: resolved?.imap });
    },
  });
}
