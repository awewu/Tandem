/**
 * Unified Hermes API client.
 *
 * Auto-detects runtime:
 *   - Inside Tauri (desktop) → invoke Rust commands in src-tauri/src/main.rs
 *   - Otherwise (browser / SSR) → fetch the Next.js API routes in app/api/*
 *
 * All callers should import from this file instead of using fetch('/api/...')
 * or invoke('hermes_...') directly.
 */

type Json = unknown;

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
  }
}

export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

async function tauriInvoke<T = Json>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // Lazy import so SSR/Node bundles never resolve @tauri-apps/api.
  const mod = await import('@tauri-apps/api/core').catch(() => null);
  if (!mod || typeof (mod as any).invoke !== 'function') {
    throw new Error('@tauri-apps/api not available — running outside Tauri?');
  }
  return (mod as any).invoke(cmd, args);
}

async function fetchJson<T = Json>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

// ========== health ==========

export async function getHealth() {
  return isTauri()
    ? tauriInvoke('hermes_health')
    : fetchJson('/api/health');
}

/**
 * Test an arbitrary external bridge URL (settings page "Test connection").
 * Always uses fetch — even in Tauri — because the user is typing an arbitrary
 * remote URL, not invoking the local hermes CLI.
 */
export async function testHealth(externalUrl?: string): Promise<boolean> {
  if (!externalUrl) {
    try {
      const r: any = await getHealth();
      return Boolean(r?.ok);
    } catch {
      return false;
    }
  }
  try {
    const target = externalUrl.replace(/\/+$/, '');
    const res = await fetch(`${target}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ========== status ==========

export interface KeyState {
  name: string;
  configured: boolean;
  hint?: string;
}

export interface HermesStatus {
  ok: boolean;
  environment: {
    project?: string;
    python?: string;
    envFile?: string;
    model?: string;
    provider?: string;
  };
  apiKeys: KeyState[];
  authProviders: KeyState[];
  apiKeyProviders: KeyState[];
  terminal?: { backend?: string; sudo?: string };
  messaging: KeyState[];
  gateway?: { status?: string; manager?: string };
  jobs?: { active: number; total: number };
  sessions?: { active: number };
  raw: string;
  error?: string;
}

export async function getStatus(): Promise<HermesStatus> {
  return (isTauri()
    ? tauriInvoke('hermes_status')
    : fetchJson('/api/status')) as Promise<HermesStatus>;
}

// ========== skills ==========

export async function getSkills() {
  return isTauri()
    ? tauriInvoke('hermes_skills')
    : fetchJson('/api/skills');
}

// ========== mcp ==========

export interface MCPServer {
  name: string;
  type?: string;
  endpoint?: string;
  status?: string;
  enabled?: boolean;
}

export interface MCPListResult {
  ok: boolean;
  servers: MCPServer[];
  raw: string;
  error?: string;
}

export async function getMCPServers(): Promise<MCPListResult> {
  return (isTauri()
    ? tauriInvoke('hermes_mcp_list')
    : fetchJson('/api/mcp')) as Promise<MCPListResult>;
}

// ========== memory ==========

export interface MemoryStatus {
  ok: boolean;
  builtIn: { active: boolean; description?: string };
  provider: { name?: string; configured: boolean };
  plugins: { name: string; description: string }[];
  raw: string;
  error?: string;
}

export async function getMemoryStatus(): Promise<MemoryStatus> {
  return (isTauri()
    ? tauriInvoke('hermes_memory_status')
    : fetchJson('/api/memory')) as Promise<MemoryStatus>;
}

// ========== logs ==========

export interface LogLine {
  id: string;
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'UNKNOWN';
  component: string;
  message: string;
  raw: string;
}

export interface LogsParams {
  /** Log file: 'agent' | 'errors' | 'gateway' | 'list' */
  log?: string;
  lines?: number;
  level?: string;
  component?: string;
  since?: string;
}

export interface LogsResult {
  ok: boolean;
  log?: string;
  count: number;
  logs: LogLine[];
  stderr?: string;
  error?: string;
}

export async function getLogs(params: LogsParams = {}): Promise<LogsResult> {
  if (isTauri()) {
    const tauriArgs: Record<string, unknown> = {
      file: params.log && params.log !== 'agent' ? params.log : undefined,
      lines: params.lines,
      level: params.level && params.level !== 'all' ? params.level : undefined,
      component: params.component && params.component !== 'all' ? params.component : undefined,
      since: params.since,
    };
    const r: any = await tauriInvoke('hermes_logs', tauriArgs);
    // Normalize Rust shape (entries) to web shape (logs)
    return {
      ok: !!r.ok,
      log: params.log || 'agent',
      count: r.entries?.length ?? 0,
      logs: r.entries || [],
      error: r.error,
    };
  }
  const usp = new URLSearchParams();
  if (params.log) usp.set('log', params.log);
  if (params.lines != null) usp.set('lines', String(params.lines));
  if (params.level && params.level !== 'all') usp.set('level', params.level);
  if (params.component && params.component !== 'all') usp.set('component', params.component);
  if (params.since) usp.set('since', params.since);
  const qs = usp.toString();
  return fetchJson<LogsResult>(`/api/logs${qs ? `?${qs}` : ''}`);
}

// ========== cron ==========

export async function getCronJobs() {
  return isTauri()
    ? tauriInvoke('hermes_cron_list')
    : fetchJson('/api/cron');
}

export async function runCronAction(
  id: string,
  action: 'run' | 'pause' | 'resume' | 'remove'
) {
  if (isTauri()) {
    return tauriInvoke('hermes_cron_action', { id, action });
  }
  // Web side uses HTTP semantics: DELETE for remove, POST for run, PATCH+body for pause/resume.
  const url = `/api/cron/${encodeURIComponent(id)}`;
  if (action === 'remove') {
    return fetchJson(url, { method: 'DELETE' });
  }
  if (action === 'run') {
    return fetchJson(url, { method: 'POST' });
  }
  return fetchJson(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

export async function createCronJob(args: {
  schedule: string;
  prompt?: string;
  name?: string;
  skills?: string[];
}) {
  if (isTauri()) {
    return tauriInvoke('hermes_cron_create', args as unknown as Record<string, unknown>);
  }
  return fetchJson('/api/cron', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
}

// ========== chat (streaming) ==========
//
// In Tauri: hermes_chat_stream emits 'hermes-stream' events.
// In Web:   POST /api/stream returns SSE.
// Callers should branch on isTauri() since the consumption pattern differs.
//

export interface ChatStreamArgs {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  skills?: string[];
  agentId?: string;
  systemPrompt?: string;
  temperature?: number;
}

/**
 * Start a non-BYOK chat stream backed by the local hermes CLI.
 *
 * Tauri → invoke hermes_chat_stream, returns { mode: 'tauri' };
 *         caller subscribes to the global 'hermes-stream' window event for
 *         { content } / { error } / { done } payloads.
 * Web   → POST /api/stream, returns { mode: 'web', response };
 *         caller reads SSE off response.body itself.
 */
export async function startChatStream(
  args: ChatStreamArgs
): Promise<{ mode: 'tauri' } | { mode: 'web'; response: Response }> {
  if (isTauri()) {
    await tauriInvoke('hermes_chat_stream', {
      messages: args.messages,
      model: args.model,
      skills: args.skills,
    });
    return { mode: 'tauri' };
  }
  const response = await fetch('/api/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { mode: 'web', response };
}

export interface LLMStreamArgs {
  messages: Array<{ role: string; content: string }>;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  provider: { baseURL: string; apiKey?: string; headers?: Record<string, string> };
}

/**
 * BYOK ("bring your own key") chat stream against an OpenAI-compatible upstream.
 *
 * Tauri → invoke hermes_llm_stream (uses reqwest server-side to forward),
 *         returns { mode: 'tauri' }; caller subscribes to 'hermes-stream'.
 * Web   → POST /api/llm-stream, returns { mode: 'web', response }; caller reads SSE.
 */
export async function startLLMStream(
  args: LLMStreamArgs
): Promise<{ mode: 'tauri' } | { mode: 'web'; response: Response }> {
  if (isTauri()) {
    await tauriInvoke('hermes_llm_stream', args as unknown as Record<string, unknown>);
    return { mode: 'tauri' };
  }
  const response = await fetch('/api/llm-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { mode: 'web', response };
}

// ========== workflow run (streaming) ==========

export interface WorkflowRunArgs {
  nodes: unknown[];
  edges: unknown[];
  initialInput?: string;
  model?: string;
}

/**
 * Start a workflow run. In Tauri, returns a runId — caller subscribes to
 * `workflow:<runId>` events. In Web, returns a fetch Response whose body is
 * an SSE stream the caller reads itself.
 */
export async function startWorkflowRun(
  args: WorkflowRunArgs
): Promise<{ runId: string; mode: 'tauri' } | { response: Response; mode: 'web' }> {
  if (isTauri()) {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await tauriInvoke('hermes_workflow_run', {
      ...args,
      initialInput: args.initialInput,
      runId,
    } as unknown as Record<string, unknown>);
    return { runId, mode: 'tauri' };
  }
  const response = await fetch('/api/workflows/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { response, mode: 'web' };
}
