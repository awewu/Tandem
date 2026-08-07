'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { notifyDesktop } from '@/lib/desktop/client';
import { displayImChannelName } from '@/lib/im/channel-name';
import { extractPreview, type ImChannel } from '@/lib/types/im';
import { useImChannels } from '@/components/im/use-im-unread-count';

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
  const { channels, subscribeToMessages } = useImChannels(meId);
  const channelsRef = useRef<Map<string, ImChannel>>(new Map());
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    channelsRef.current = new Map(channels.map((channel) => [channel.id, channel]));
  }, [channels]);

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
    return subscribeToMessages((event) => {
      void handleMessage(event);
    });
  }, [handleMessage, meId, subscribeToMessages]);

  return null;
}
