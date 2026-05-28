'use client';

/**
 * VoiceInputButton — 长按 push-to-talk 语音输入.
 *
 * 用 Web Speech API (浏览器原生 SpeechRecognition / webkitSpeechRecognition).
 * 不需要后端 ASR. 失败时静默降级 (按钮不显示, 或灰显提示).
 *
 * 用法:
 *   <VoiceInputButton onText={(text) => setInput((cur) => cur + text)} />
 *
 * 交互:
 *   - 长按 (mousedown/touchstart) 开始录音 + 实时转写
 *   - 松开 (mouseup/touchend) 停止 + 提交最终文本
 *   - 移开按钮区域 = 取消 (不提交)
 *
 * 浏览器支持: Chrome / Edge / Safari (iOS 14.5+). Firefox 不支持.
 * 中文识别: SpeechRecognition.lang='zh-CN'.
 */

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceInputButtonProps {
  onText: (text: string) => void;
  /** 实时转写中, 用于 placeholder 提示等 */
  onPartial?: (partial: string) => void;
  /** 识别语言, 默认 zh-CN */
  lang?: string;
  className?: string;
  disabled?: boolean;
}

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: { results: { isFinal: boolean; 0: { transcript: string } }[]; resultIndex: number }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function VoiceInputButton({
  onText,
  onPartial,
  lang = 'zh-CN',
  className,
  disabled,
}: VoiceInputButtonProps) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const cancelledRef = useRef(false);
  const finalTextRef = useRef('');

  // 检测支持
  useEffect(() => {
    const SR =
      (typeof window !== 'undefined' &&
        ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
            .webkitSpeechRecognition)) ||
      null;
    setSupported(!!SR);
  }, []);

  function start() {
    if (!supported || disabled || active) return;
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    finalTextRef.current = '';
    cancelledRef.current = false;

    r.onresult = (ev) => {
      let interim = '';
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const text = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += text;
        else interim += text;
      }
      if (final) finalTextRef.current += final;
      onPartial?.(finalTextRef.current + interim);
    };
    r.onerror = (ev) => {
      setError(ev.error);
      setActive(false);
    };
    r.onend = () => {
      setActive(false);
      if (!cancelledRef.current && finalTextRef.current.trim()) {
        onText(finalTextRef.current.trim());
      }
    };

    try {
      r.start();
      recognitionRef.current = r;
      setActive(true);
      setError(null);
    } catch (e) {
      setError(String(e));
      setActive(false);
    }
  }

  function stop(cancel = false) {
    cancelledRef.current = cancel;
    if (recognitionRef.current) {
      try {
        if (cancel) recognitionRef.current.abort();
        else recognitionRef.current.stop();
      } catch {
        /* no-op */
      }
    }
  }

  // 不支持时, 不渲染按钮 (静默降级)
  if (!supported) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={active ? '正在录音, 松开发送' : '长按录音'}
      aria-pressed={active}
      title={error ? `语音输入失败: ${error}` : active ? '松开发送 · 移开取消' : '长按 · 中文语音输入'}
      onMouseDown={(e) => { e.preventDefault(); start(); }}
      onMouseUp={() => stop(false)}
      onMouseLeave={() => active && stop(true)}
      onTouchStart={(e) => { e.preventDefault(); start(); }}
      onTouchEnd={() => stop(false)}
      onTouchCancel={() => stop(true)}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-150',
        'touch-none select-none',
        active
          ? 'bg-[rgb(var(--brand-500))] text-white scale-110 shadow-lg shadow-[rgb(var(--brand-500))]/30 animate-pulse'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-white/75 dark:hover:bg-white/15',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {active ? <Mic className="h-4.5 w-4.5" /> : error ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
    </button>
  );
}
