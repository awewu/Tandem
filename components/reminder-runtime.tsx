'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ToastAction } from '@/components/ui/toast';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { getReminderToastDurationMs } from '@/lib/reminders/toast-duration';

interface PollResponse {
  unreadCount?: number;
  delivered?: Array<{
    notificationId?: string;
    title: string;
    body?: string | null;
    url?: string | null;
  }>;
}

const POLL_INTERVAL_MS = 30_000;

export function ReminderRuntime() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useCurrentUser();
  const shownRef = useRef<Set<string>>(new Set());
  const sinceRef = useRef<string>(new Date(Date.now() - POLL_INTERVAL_MS).toISOString());

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const pollStartedAt = new Date().toISOString();
        const response = await fetch(`/api/reminders/poll?since=${encodeURIComponent(sinceRef.current)}`, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json().catch(() => ({})) as PollResponse;
        if (cancelled) return;
        sinceRef.current = pollStartedAt;
        for (const item of data.delivered ?? []) {
          const key = item.notificationId ?? `${item.title}:${item.body ?? ''}`;
          if (shownRef.current.has(key)) continue;
          shownRef.current.add(key);
          toast({
            title: item.title,
            description: item.body ?? '',
            duration: getReminderToastDurationMs(item.body),
            action: item.url ? (
              <ToastAction
                altText="查看"
                onClick={() => {
                  void markNotificationRead(item.notificationId);
                  router.push(item.url ?? '/notifications');
                }}
              >
                查看
              </ToastAction>
            ) : undefined,
          });
        }
        if (typeof data.unreadCount === 'number') {
          window.dispatchEvent(new CustomEvent('tandem:notifications:unread', { detail: { unreadCount: data.unreadCount } }));
        }
      } catch {
        /* fail-soft: reminders will be retried by next poll/background worker */
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [router, toast, user?.id]);

  return null;
}

async function markNotificationRead(notificationId?: string) {
  if (!notificationId) return;
  try {
    await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });
    const response = await fetch('/api/notifications/badge', { credentials: 'include', cache: 'no-store' });
    const data = await response.json().catch(() => ({})) as { unreadCount?: number };
    if (typeof data.unreadCount === 'number') {
      window.dispatchEvent(new CustomEvent('tandem:notifications:unread', { detail: { unreadCount: data.unreadCount } }));
    }
  } catch {
    /* fail-soft: viewing still navigates even when ack sync fails */
  }
}
