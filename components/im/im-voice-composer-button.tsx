'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { isCapacitor } from '@/lib/capacitor/client';

interface ImVoiceComposerButtonProps {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
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

export function ImVoiceComposerButton({
  onText,
  disabled,
  className,
}: ImVoiceComposerButtonProps) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileMode, setMobileMode] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTextRef = useRef('');
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;
    setSupported(Boolean(SR));
    try {
      const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 767px)') : null;
      const ua = window.navigator.userAgent;
      const isMobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      setMobileMode(isCapacitor() || isMobileUa || Boolean(mq?.matches));
    } catch {
      setMobileMode(isCapacitor());
    }
  }, []);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* no-op */
      }
    };
  }, []);

  function stopRecognition(cancel = false) {
    if (!recognitionRef.current) return;
    try {
      if (cancel) recognitionRef.current.abort();
      else recognitionRef.current.stop();
    } catch {
      /* no-op */
    }
  }

  function startRecognition() {
    if (disabled || active) return;

    if (mobileMode) {
      toast({
        variant: 'destructive',
        title: '移动端暂不支持',
        description: '当前只保留桌面浏览器原生语音识别。',
      });
      return;
    }

    const SR =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

    if (!SR) {
      setError('unsupported');
      toast({
        variant: 'destructive',
        title: '当前浏览器不支持',
        description: '请改用支持 SpeechRecognition 的桌面 Chrome 或 Edge。',
      });
      return;
    }

    const recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    finalTextRef.current = '';

    recognition.onresult = (ev) => {
      let final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const text = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += text;
      }
      if (final) finalTextRef.current += final;
    };
    recognition.onerror = (ev) => {
      setError(ev.error);
      setActive(false);
      recognitionRef.current = null;
      toast({
        variant: 'destructive',
        title: '原生语音识别失败',
        description:
          ev.error === 'not-allowed'
            ? '请先允许浏览器访问麦克风。'
            : ev.error === 'network'
            ? '浏览器内置语音服务当前不可用。'
            : `浏览器返回错误: ${ev.error}`,
      });
    };
    recognition.onend = () => {
      setActive(false);
      recognitionRef.current = null;
      const text = finalTextRef.current.trim();
      if (text) onText(text);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setActive(true);
      setError(null);
      toast({
        title: '开始听写',
        description: '再次点击麦克风结束，并把识别结果填回输入框。',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      setError(message);
      setActive(false);
      toast({
        variant: 'destructive',
        title: '无法启动原生语音识别',
        description: message,
      });
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={active ? '结束语音识别' : '开始语音识别'}
      aria-pressed={active}
      title={
        mobileMode
          ? '移动端暂不支持浏览器原生语音识别'
          : error
          ? `语音输入失败: ${error}`
          : active
          ? '点击结束并回填文字'
          : '点击开始浏览器原生语音识别'
      }
      onClick={() => {
        if (active) stopRecognition(false);
        else startRecognition();
      }}
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all',
        active
          ? 'scale-110 bg-[rgb(var(--brand-500))] text-white shadow-soft-lg shadow-[rgb(var(--brand-500))]/30'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-white/75 dark:hover:bg-white/15',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      {active ? <Square className="h-4.5 w-4.5" /> : error ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
    </button>
  );
}
