'use client';

import { useEffect, useState } from 'react';

export function useNotificationBadge(userId: string) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const fetchBadge = async () => {
      try {
        const r = await fetch(`/api/notifications/badge?userId=${userId}`);
        const d = await r.json();
        setUnreadCount(d.unreadCount ?? 0);
      } catch {
        // silent fail
      }
    };
    fetchBadge();
    const id = setInterval(fetchBadge, 15000);
    return () => clearInterval(id);
  }, [userId]);

  return unreadCount;
}
