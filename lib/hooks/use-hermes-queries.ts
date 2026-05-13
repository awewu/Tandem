'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHealth,
  getStatus,
  getSkills,
  getCronJobs,
  getLogs,
  getMemoryStatus,
  getMCPServers,
  runCronAction,
  createCronJob,
  type LogsParams,
  type LogsResult,
} from '@/lib/hermes-api';

// ─── Query Keys ─────────────────────────────────────────────────────────────
// Centralized keys enable precise cache invalidation across the app.

export const hk = {
  health: ['hermes', 'health'] as const,
  status: ['hermes', 'status'] as const,
  skills: ['hermes', 'skills'] as const,
  cron: ['hermes', 'cron'] as const,
  logs: (params: LogsParams) => ['hermes', 'logs', params] as const,
  memory: ['hermes', 'memory'] as const,
  mcp: ['hermes', 'mcp'] as const,
};

// ─── Health ─────────────────────────────────────────────────────────────────

export function useHealth(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: hk.health,
    queryFn: getHealth,
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 10_000,
    ...options,
  });
}

// ─── Status ─────────────────────────────────────────────────────────────────

export function useStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: hk.status,
    queryFn: getStatus,
    refetchInterval: options?.refetchInterval ?? 30_000,
    staleTime: 10_000,
    ...options,
  });
}

// ─── Skills ─────────────────────────────────────────────────────────────────

export function useSkills(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: hk.skills,
    queryFn: getSkills,
    staleTime: 60_000,
    ...options,
  });
}

// ─── Cron ───────────────────────────────────────────────────────────────────

export function useCronJobs(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: hk.cron,
    queryFn: getCronJobs,
    staleTime: 10_000,
    ...options,
  });
}

export function useCronAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'run' | 'pause' | 'resume' | 'remove' }) =>
      runCronAction(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hk.cron });
    },
  });
}

export function useCreateCronJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCronJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hk.cron });
    },
  });
}

// ─── Logs ───────────────────────────────────────────────────────────────────

export function useLogs(params: LogsParams, options?: { enabled?: boolean }) {
  return useQuery<LogsResult, Error>({
    queryKey: hk.logs(params),
    queryFn: () => getLogs(params),
    staleTime: 5_000,
    ...options,
  });
}

// ─── Memory ─────────────────────────────────────────────────────────────────

export function useMemoryStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: hk.memory,
    queryFn: getMemoryStatus,
    staleTime: 30_000,
    ...options,
  });
}

// ─── MCP ────────────────────────────────────────────────────────────────────

export function useMCPServers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: hk.mcp,
    queryFn: getMCPServers,
    staleTime: 30_000,
    ...options,
  });
}
