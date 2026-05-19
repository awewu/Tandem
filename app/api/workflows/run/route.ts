import { spawn } from 'child_process';
import { requireAuth } from '@/lib/auth/require-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NodeType = 'trigger' | 'agent' | 'tool' | 'condition' | 'output';

interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  config?: Record<string, string>;
}

interface FlowEdge {
  from: string;
  to: string;
}

interface RunPayload {
  nodes: FlowNode[];
  edges: FlowEdge[];
  initialInput?: string;
  model?: string;
}

interface ExecutableNode {
  node: FlowNode;
  parents: string[];
}

// Topological sort. Returns ordered IDs or throws on cycle.
function topoSort(nodes: FlowNode[], edges: FlowEdge[]): string[] {
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) {
    inDeg.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!inDeg.has(e.from) || !inDeg.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
  }
  const queue: string[] = [];
  inDeg.forEach((d, id) => {
    if (d === 0) queue.push(id);
  });
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      inDeg.set(next, (inDeg.get(next) || 0) - 1);
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.length) {
    throw new Error('Workflow contains a cycle or disconnected nodes');
  }
  return order;
}

function runHermesStreaming(
  prompt: string,
  model: string | undefined,
  onChunk: (chunk: string) => void,
  abortSignal: AbortSignal
): Promise<{ output: string; code: number; stderr: string }> {
  return new Promise((resolve) => {
    const args = ['-z', prompt];
    if (model) args.push('-m', model);
    const env = {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
    };
    let child;
    try {
      child = spawn('hermes', args, {
        env,
        windowsHide: true,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      resolve({ output: '', code: -1, stderr: String(err?.message || err) });
      return;
    }
    let output = '';
    let stderr = '';
    const onAbort = () => {
      try {
        child?.kill();
      } catch {}
    };
    abortSignal.addEventListener('abort', onAbort);
    child.stdout?.on('data', (d: Buffer) => {
      const text = d.toString('utf-8');
      output += text;
      onChunk(text);
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString('utf-8');
    });
    child.on('error', (err) => {
      abortSignal.removeEventListener('abort', onAbort);
      resolve({ output, code: -1, stderr: stderr + (err.message || String(err)) });
    });
    child.on('close', (code) => {
      abortSignal.removeEventListener('abort', onAbort);
      resolve({ output, code: code ?? 0, stderr });
    });
  });
}

export async function POST(req: Request) {
  const auth = requireAuth(req as any);
  if (auth instanceof NextResponse) return auth;
  let payload: RunPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const { nodes = [], edges = [], initialInput = '', model } = payload;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {}
      };

      let order: string[];
      try {
        order = topoSort(nodes, edges);
      } catch (err: any) {
        send('error', { message: err.message });
        send('done', { ok: false });
        controller.close();
        return;
      }

      send('plan', { order, total: order.length });

      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const incoming = new Map<string, string[]>();
      for (const e of edges) {
        const arr = incoming.get(e.to) || [];
        arr.push(e.from);
        incoming.set(e.to, arr);
      }
      const outputs = new Map<string, string>();

      const buildPromptFor = (id: string): string => {
        const n = nodeMap.get(id)!;
        const parents = incoming.get(id) || [];
        const ctx = parents
          .map((pid) => {
            const pn = nodeMap.get(pid);
            const out = outputs.get(pid);
            if (!pn || !out) return '';
            return `[Previous step "${pn.label}" output]\n${out}\n`;
          })
          .filter(Boolean)
          .join('\n');
        const seed = parents.length === 0 ? initialInput : '';
        const role = n.type === 'agent' ? 'Acting as agent' : n.type === 'tool' ? 'Using tool' : 'Step';
        return [
          ctx,
          seed,
          `${role} "${n.label}". Produce the next step's output.`,
        ]
          .filter(Boolean)
          .join('\n\n');
      };

      for (const id of order) {
        const node = nodeMap.get(id)!;
        if (req.signal.aborted) break;

        // Trigger and condition: pass through (MVP: no real condition eval)
        if (node.type === 'trigger') {
          send('node:start', { id, label: node.label, type: node.type });
          outputs.set(id, initialInput || `[Trigger: ${node.label}]`);
          send('node:done', { id, output: outputs.get(id), skipped: false, code: 0 });
          continue;
        }
        if (node.type === 'condition') {
          send('node:start', { id, label: node.label, type: node.type });
          // Pass through all upstream outputs concatenated
          const passThrough = (incoming.get(id) || [])
            .map((pid) => outputs.get(pid) || '')
            .join('\n\n');
          outputs.set(id, passThrough || `[Condition: ${node.label}]`);
          send('node:done', { id, output: outputs.get(id), skipped: false, code: 0, note: 'condition passed (MVP)' });
          continue;
        }

        // agent | tool | output: invoke hermes -z
        send('node:start', { id, label: node.label, type: node.type });
        const prompt = buildPromptFor(id);
        send('node:prompt', { id, prompt });

        const { output, code, stderr } = await runHermesStreaming(
          prompt,
          model,
          (chunk) => send('node:chunk', { id, chunk }),
          req.signal
        );
        outputs.set(id, output);
        if (code !== 0 && !output) {
          send('node:error', { id, code, stderr });
          send('done', { ok: false, failedAt: id });
          controller.close();
          return;
        }
        send('node:done', { id, output, code, stderr: stderr || undefined });
      }

      const finals = order.filter((id) => {
        const outgoing = edges.some((e) => e.from === id);
        return !outgoing;
      });
      send('done', {
        ok: true,
        finalNodes: finals,
        outputs: Object.fromEntries(
          finals.map((id) => [id, outputs.get(id) || ''])
        ),
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
