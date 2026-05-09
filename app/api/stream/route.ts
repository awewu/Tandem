import { spawn } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { messages, model, skills, systemPrompt, temperature } = await req.json().catch(() => ({}));

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      // Build prompt
      let promptText = '';
      // 添加自定义 systemPrompt（如果提供）
      if (systemPrompt && typeof systemPrompt === 'string') {
        promptText += `System: ${systemPrompt}\n`;
      }
      if (Array.isArray(messages)) {
        for (const m of messages) {
          if (m.role === 'system') promptText += `System: ${m.content}\n`;
          else if (m.role === 'user') promptText += `User: ${m.content}\n`;
          else if (m.role === 'assistant') promptText += `Assistant: ${m.content}\n`;
        }
      }
      if (!promptText.trim()) {
        promptText = 'User: hello\n';
      }
      promptText += 'Assistant:';

      const args: string[] = ['-z', promptText];
      if (model) args.push('-m', String(model));
      if (skills && skills.length) {
        const skillsStr = Array.isArray(skills) ? skills.join(',') : String(skills);
        args.push('--skills', skillsStr);
      }

      // Spawn with Windows fixes
      const env = {
        ...process.env,
        FORCE_COLOR: '0',
        NO_COLOR: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      };

      let child;
      try {
        // Windows: shell:false to avoid argument parsing issues with newlines
        // Linux/Mac: shell:false for security
        child = spawn('hermes', args, {
          env,
          windowsHide: true,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: 'Failed to start hermes: ' + (err?.message || String(err)) })}\n\n`)
        );
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
        return;
      }

      let hasOutput = false;
      let stderrBuffer = '';
      let stdoutBuffer = '';
      let flushTimer: NodeJS.Timeout | null = null;
      let timeout: NodeJS.Timeout | null = null;

      const send = (obj: any) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      // Buffer stdout and flush periodically for better performance
      const flushStdout = () => {
        if (stdoutBuffer) {
          send({ content: stdoutBuffer });
          stdoutBuffer = '';
        }
        flushTimer = null;
      };

      const queueStdout = (text: string) => {
        stdoutBuffer += text;
        if (!flushTimer) {
          flushTimer = setTimeout(flushStdout, 50); // Flush every 50ms
        }
      };

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (flushTimer) {
          clearTimeout(flushTimer);
          flushStdout(); // Flush remaining buffer
        }
      };

      const onAbort = () => {
        try { child?.kill(); } catch {}
        cleanup();
        safeClose();
      };
      req.signal.addEventListener('abort', onAbort);

      child.stdout?.on('data', (data: Buffer) => {
        hasOutput = true;
        const text = data.toString('utf-8');
        if (text) queueStdout(text);
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderrBuffer += data.toString('utf-8');
      });

      child.on('close', (code) => {
        cleanup();
        req.signal.removeEventListener('abort', onAbort);
        if (stderrBuffer.trim()) {
          send({ content: '\n[stderr] ' + stderrBuffer.trim() });
        }
        if (!hasOutput) {
          if (code !== 0) {
            send({ error: `hermes exited with code ${code}. Ensure hermes is installed and in PATH.` });
          } else {
            send({ content: '\n(no output)' });
          }
        }
        send({ done: true });
        safeClose();
      });

      child.on('error', (err) => {
        cleanup();
        req.signal.removeEventListener('abort', onAbort);
        send({ error: err.message || String(err) });
        send({ done: true });
        safeClose();
      });

      timeout = setTimeout(() => {
        if (!hasOutput) {
          send({ error: 'hermes timeout after 60s. Check CLI availability.' });
          send({ done: true });
          try { child?.kill(); } catch {}
          safeClose();
        }
      }, 60000);
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
