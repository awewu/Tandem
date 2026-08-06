'use client';

import { useCallback, useEffect, useState } from 'react';

type ChannelWithUnread = { unread?: number };

function sumUnread(channels: ChannelWithUnread[]): number {
  return channels.reduce((sum, channel) => sum + Math.max(0, channel.unread ?? 0), 0);
}

export function useImUnreadCount(userId?: string | null): number {
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnread = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/im/channels', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const channels = Array.isArray(data.channels) ? data.channels : [];
      setUnreadCount(sumUnread(channels));
    } catch {
      /* fail-soft */
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    void refreshUnread();

    const refresh = () => void refreshUnread();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('tandem:im-channels-refresh', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const timer = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refreshUnread();
    }, 30_000);

    const es = new EventSource('/api/im/stream');
    es.addEventListener('unread', refresh);
    es.addEventListener('channel', refresh);
    es.onerror = () => {
      es.close();
    };

    return () => {
      clearInterval(timer);
      es.close();
      window.removeEventListener('tandem:im-channels-refresh', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refreshUnread, userId]);

  return unreadCount;
}
