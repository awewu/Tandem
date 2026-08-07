'use client';

import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { hasExternalRole, hasInternalRole } from '@/lib/auth/roles';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import type { ImChannel, ImMembership } from '@/lib/types/im';

export type ImChannelWithUnread = ImChannel & {
  unread?: number;
  membership?: ImMembership;
};

type RefreshOptions = { force?: boolean };
type MessageListener = (event: MessageEvent<string>) => void;

interface ImChannelsContextValue {
  userId: string | null;
  channels: ImChannelWithUnread[];
  unreadCount: number;
  refreshChannels: (options?: RefreshOptions) => Promise<void>;
  subscribeToMessages: (listener: MessageListener) => () => void;
}

interface ImChannelsState {
  userId: string | null;
  channels: ImChannelWithUnread[];
}

const EVENT_REFRESH_COALESCE_MS = 200;
const POLL_INTERVAL_MS = 30_000;
const SSE_FALLBACK_INTERVAL_MS = 10_000;
const EMPTY_CHANNELS: ImChannelWithUnread[] = [];
const noopRefresh = async () => undefined;
const noopSubscribe = () => () => undefined;

const EMPTY_CONTEXT: ImChannelsContextValue = {
  userId: null,
  channels: EMPTY_CHANNELS,
  unreadCount: 0,
  refreshChannels: noopRefresh,
  subscribeToMessages: noopSubscribe,
};

const ImChannelsContext = createContext<ImChannelsContextValue | null>(null);

function sumUnread(channels: ImChannelWithUnread[]): number {
  return channels.reduce((sum, channel) => sum + Math.max(0, channel.unread ?? 0), 0);
}

/**
 * Owns the single app-wide IM channel request, refresh timer and user SSE stream.
 * Consumers only subscribe to this context, so responsive desktop/mobile chrome
 * cannot accidentally duplicate network work when both trees are mounted.
 */
export function ImChannelsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();
  const roles = user?.roles ?? [];
  const pureExternal = hasExternalRole(roles) && !hasInternalRole(roles);
  const userId = !pureExternal ? (user?.id ?? null) : null;

  const [channelsState, setChannelsState] = useState<ImChannelsState>({
    userId: null,
    channels: EMPTY_CHANNELS,
  });
  const channels = channelsState.userId === userId ? channelsState.channels : EMPTY_CHANNELS;
  const inFlightRef = useRef<Promise<void> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const requestGenerationRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const queuedRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPendingRef = useRef(false);
  const refreshPendingForceRef = useRef(false);
  const refreshChannelsRef = useRef<(options?: RefreshOptions) => Promise<void>>(noopRefresh);
  const messageListenersRef = useRef(new Set<MessageListener>());

  useEffect(() => {
    currentUserIdRef.current = userId;
    requestGenerationRef.current += 1;
    inFlightRef.current = null;
    lastRefreshAtRef.current = 0;
    refreshPendingRef.current = false;
    refreshPendingForceRef.current = false;
    setChannelsState({ userId, channels: EMPTY_CHANNELS });
  }, [userId]);

  const refreshChannels = useCallback(async (options: RefreshOptions = {}) => {
    if (!userId) return;

    if (options.force && queuedRefreshRef.current) {
      clearTimeout(queuedRefreshRef.current);
      queuedRefreshRef.current = null;
    }

    if (inFlightRef.current) {
      refreshPendingRef.current = true;
      refreshPendingForceRef.current ||= options.force === true;
      return inFlightRef.current;
    }

    if (!options.force && Date.now() - lastRefreshAtRef.current < EVENT_REFRESH_COALESCE_MS) {
      return;
    }

    const requestUserId = userId;
    const requestGeneration = requestGenerationRef.current;
    const request = (async () => {
      try {
        const res = await fetch('/api/im/channels', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        if (
          currentUserIdRef.current !== requestUserId ||
          requestGenerationRef.current !== requestGeneration
        ) {
          return;
        }
        setChannelsState({
          userId: requestUserId,
          channels: Array.isArray(data.channels) ? data.channels : EMPTY_CHANNELS,
        });
        lastRefreshAtRef.current = Date.now();
      } catch {
        /* fail-soft; the timer and SSE reconnect provide retries */
      }
    })().finally(() => {
      if (inFlightRef.current === request) inFlightRef.current = null;
      if (!refreshPendingRef.current || currentUserIdRef.current !== requestUserId) return;

      const force = refreshPendingForceRef.current;
      refreshPendingRef.current = false;
      refreshPendingForceRef.current = false;
      if (queuedRefreshRef.current) clearTimeout(queuedRefreshRef.current);
      queuedRefreshRef.current = setTimeout(() => {
        queuedRefreshRef.current = null;
        void refreshChannelsRef.current({ force });
      }, EVENT_REFRESH_COALESCE_MS);
    });

    inFlightRef.current = request;
    return request;
  }, [userId]);
  refreshChannelsRef.current = refreshChannels;

  const scheduleRefresh = useCallback(() => {
    if (!userId || queuedRefreshRef.current) return;
    const sinceLastRefresh = Date.now() - lastRefreshAtRef.current;
    const delay = Math.max(0, EVENT_REFRESH_COALESCE_MS - sinceLastRefresh);
    queuedRefreshRef.current = setTimeout(() => {
      queuedRefreshRef.current = null;
      void refreshChannelsRef.current();
    }, delay);
  }, [userId]);

  const subscribeToMessages = useCallback((listener: MessageListener) => {
    messageListenersRef.current.add(listener);
    return () => {
      messageListenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    void refreshChannelsRef.current({ force: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };

    window.addEventListener('tandem:im-channels-refresh', scheduleRefresh);
    window.addEventListener('focus', scheduleRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const pollTimer = setInterval(() => {
      if (document.visibilityState !== 'hidden') scheduleRefresh();
    }, POLL_INTERVAL_MS);

    const es = new EventSource('/api/im/stream');
    let sseHealthy = false;
    es.addEventListener('unread', scheduleRefresh);
    es.addEventListener('channel', scheduleRefresh);
    es.addEventListener('message', (event) => {
      scheduleRefresh();
      messageListenersRef.current.forEach((listener) => {
        listener(event as MessageEvent<string>);
      });
    });
    es.onopen = () => {
      sseHealthy = true;
    };
    es.onerror = () => {
      sseHealthy = false;
    };

    const fallbackTimer = setInterval(() => {
      if (document.visibilityState === 'hidden' || sseHealthy) return;
      scheduleRefresh();
    }, SSE_FALLBACK_INTERVAL_MS);

    return () => {
      clearInterval(pollTimer);
      clearInterval(fallbackTimer);
      es.close();
      window.removeEventListener('tandem:im-channels-refresh', scheduleRefresh);
      window.removeEventListener('focus', scheduleRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (queuedRefreshRef.current) {
        clearTimeout(queuedRefreshRef.current);
        queuedRefreshRef.current = null;
      }
    };
  }, [scheduleRefresh, userId]);

  const value = useMemo<ImChannelsContextValue>(() => ({
    userId,
    channels,
    unreadCount: sumUnread(channels),
    refreshChannels,
    subscribeToMessages,
  }), [channels, refreshChannels, subscribeToMessages, userId]);

  return createElement(ImChannelsContext.Provider, { value }, children);
}

export function useImChannels(userId?: string | null): ImChannelsContextValue {
  const context = useContext(ImChannelsContext);
  if (!context || !userId || context.userId !== userId) return EMPTY_CONTEXT;
  return context;
}

export function useImUnreadCount(userId?: string | null): number {
  return useImChannels(userId).unreadCount;
}
