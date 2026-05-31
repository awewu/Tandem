'use client';

/**
 * CollabTextarea · Yjs 实时协作的轻量 textarea
 *
 * 用法:
 *   <CollabTextarea docId={id} userName="alice" fallback={content} onLocalChange={...} />
 *
 * 工作模式:
 *   - 启动时调 /api/documents/:id/yjs-info, 503 (未配置) → 降级为普通受控 textarea
 *   - 成功 → 连 y-websocket, 共享 Y.Text, 渲染 awareness 在线列表
 */

import { useEffect, useRef, useState } from 'react';
import { Users, Wifi, WifiOff } from 'lucide-react';

interface Props {
  docId: string;
  userName: string;
  /** 服务器初值, 用于 fallback / 首次 seed */
  fallback: string;
  onLocalChange?: (text: string) => void;
}

interface Awareness {
  user: { name: string; color: string };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function CollabTextarea({ docId, userName, fallback, onLocalChange }: Props) {
  const [text, setText] = useState(fallback);
  const [phase, setPhase] = useState<'idle' | 'fallback' | 'connecting' | 'connected'>('idle');
  const [peers, setPeers] = useState<string[]>([]);
  const providerRef = useRef<{ destroy(): void } | null>(null);
  const ytextRef = useRef<{ toString(): string; insert(i: number, s: string): void; delete(i: number, n: number): void; observe(cb: () => void): void; unobserve(cb: () => void): void } | null>(null);
  // 避免每次父组件 re-render 都重连: fallback/onLocalChange 走 ref
  const fallbackRef = useRef(fallback);
  const onChangeRef = useRef(onLocalChange);
  useEffect(() => {
    fallbackRef.current = fallback;
    onChangeRef.current = onLocalChange;
  });

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      setPhase('connecting');
      try {
        const infoRes = await fetch(`/api/documents/${docId}/yjs-info`);
        if (!infoRes.ok) {
          setPhase('fallback');
          return;
        }
        const info = (await infoRes.json()) as { wsUrl: string; room: string };
        const Y = await import('yjs');
        const { WebsocketProvider } = await import('y-websocket');
        const ydoc = new Y.Doc();
        const provider = new WebsocketProvider(info.wsUrl, info.room, ydoc);
        providerRef.current = provider as unknown as { destroy(): void };
        const ytext = ydoc.getText('content');
        ytextRef.current = ytext as unknown as typeof ytextRef.current;

        // 首次同步后, 若空则 seed fallback
        provider.on('sync', (synced: boolean) => {
          if (cancelled) return;
          if (synced) {
            const initial = fallbackRef.current ?? '';
            if (ytext.toString().length === 0 && initial.length > 0) {
              ytext.insert(0, initial);
            }
            setPhase('connected');
          }
        });

        // 远端变化 → 同步到本地 state
        const onUpdate = () => {
          if (cancelled) return;
          const v = ytext.toString();
          setText(v);
          onChangeRef.current?.(v);
        };
        ytext.observe(onUpdate);

        // awareness: 上报本人 + 订阅在线列表
        const color = COLORS[Math.abs(hash(userName)) % COLORS.length];
        provider.awareness.setLocalStateField('user', { name: userName, color });
        const onAware = () => {
          if (cancelled) return;
          const states = Array.from(provider.awareness.getStates().values()) as Awareness[];
          setPeers(states.map((s) => s?.user?.name).filter(Boolean));
        };
        provider.awareness.on('change', onAware);
        onAware();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[collab] connect failed, fallback:', err);
        setPhase('fallback');
      }
    }
    void connect();
    return () => {
      cancelled = true;
      providerRef.current?.destroy?.();
      providerRef.current = null;
      ytextRef.current = null;
    };
  }, [docId, userName]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    const ytext = ytextRef.current;
    if (phase === 'connected' && ytext) {
      // 简化: 全文 diff. 生产应用 textarea selection + minimal patch
      ytext.delete(0, ytext.toString().length);
      ytext.insert(0, next);
    } else {
      setText(next);
      onChangeRef.current?.(next);
    }
  }

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-1 right-2 z-10 flex items-center gap-2 text-[11px] text-slate-500">
        {phase === 'connected' ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Wifi className="h-3 w-3" /> 实时
          </span>
        ) : phase === 'fallback' ? (
          <span className="inline-flex items-center gap-1 text-slate-400" title="未配置 YJS_WS_URL, 走本地编辑">
            <WifiOff className="h-3 w-3" /> 本地
          </span>
        ) : (
          <span className="text-slate-400">…</span>
        )}
        {peers.length > 1 && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {peers.length}
          </span>
        )}
      </div>
      <textarea
        aria-label="文档内容"
        value={text}
        onChange={handleChange}
        className="w-full h-full resize-none outline-none text-body leading-relaxed p-1"
        placeholder="开始写作…"
      />
    </div>
  );
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
