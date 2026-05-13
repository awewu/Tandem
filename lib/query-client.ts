import { QueryClient } from '@tanstack/react-query';

/**
 * Global QueryClient for TanStack Query.
 *
 * Server state ownership:
 *   - React Query owns server-fetched data (caching, dedup, background refetch)
 *   - Zustand owns pure client/UI state (theme, filters, drafts, streaming tokens)
 *
 * Strategy:
 *   - staleTime: 30s  (data considered fresh for 30s)
 *   - gcTime: 5min    (keep inactive data in cache for 5min)
 *   - refetchOnWindowFocus: true (standard for B2B dashboards)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        // Don't retry on 4xx client errors
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
