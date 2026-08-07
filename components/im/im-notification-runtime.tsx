'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { notifyDesktop } from '@/lib/desktop/client';
import { displayImChannelName } from '@/lib/im/channel-name';
import { extractPreview, type ImChannel } from '@/lib/types/im';

type StreamMessage = {
  channelId?: string;
  message?: {
    id?: string;
    senderId?: string;
    body?: string;
    attachments?: unknown[];
  };
};

export function ImNotificationRuntime() {
  const { user } = useCurrentUser();
  const meId = user?.id ?? '';
  const channelsRef = useRef<Map<string, ImChannel>>(new Map());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  const refreshChannels = useCallback(async () => {
    if (!meId) {
      channelsRef.current = new Map();
      return;
    }
    try {
      const res = await fetch('/api/im/channels', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const next = new Map<string, ImChannel>();
      for (const channel of Array.isArray(data.channels) ? data.channels : []) {
        if (channel && typeof channel.id === 'string') {
          next.set(channel.id, channel as ImChannel);
        }
      }
      channelsRef.current = next;
    } catch {
      /* fail-soft */
    }
  }, [meId]);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    if (!meId) return;

    let payload: StreamMessage;
    try {
      payload = JSON.parse(event.data) as StreamMessage;
    } catch {
      return;
    }

    const channelId = payload.channelId;
    const message = payload.message;
    if (!channelId || !message?.id || message.senderId === meId) return;
    if (seenMessageIdsRef.current.has(message.id)) return;
    seenMessageIdsRef.current.add(message.id);
    if (seenMessageIdsRef.current.size > 100) {
      seenMessageIdsRef.current = new Set(Array.from(seenMessageIdsRef.current).slice(-50));
    }

    const channel = channelsRef.current.get(channelId);
    const resolvedChannelName = channel ? displayImChannelName(channel).trim() : '';
    const channelName = resolvedChannelName || 'IM 消息';
    const preview =
      extractPreview(message.body ?? '') ||
      (message.attachments?.length ? `[附件] ${message.attachments.length} 个文件` : '发来一条新消息');
    const title = `新 IM 消息 · ${channelName}`;
    const body = preview;

    const visible = typeof document !== 'undefined' && document.visibilityState === 'visible';
    const onSameImChannel =
      visible &&
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/im') &&
      new URLSearchParams(window.location.search).get('ch') === channelId;

    if (!onSameImChannel) {
      toast({ title, description: body });
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      const shown = await notifyDesktop(title, body);
      if (!shown && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body,
          tag: `im-${message.id}`,
        });
        notification.onclick = () => {
          window.focus();
          window.location.href = `/im?ch=${encodeURIComponent(channelId)}`;
          notification.close();
        };
      }
    }
  }, [meId]);

  useEffect(() => {
    if (!meId) {
      channelsRef.current = new Map();
      return;
    }

    let cancelled = false;
    const refresh = () => {
      if (cancelled) return;
      void refreshChannels();
    };

    void refreshChannels();

    window.addEventListener('tandem:im-channels-refresh', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    const es = new EventSource('/api/im/stream');
    es.addEventListener('channel', refresh);
    es.addEventListener('message', (event) => {
      refresh();
      void handleMessage(event as MessageEvent);
    });
    es.onerror = () => {
      es.close();
    };

    return () => {
      cancelled = true;
      es.close();
      window.removeEventListener('tandem:im-channels-refresh', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [handleMessage, meId, refreshChannels]);

  return null;
}
