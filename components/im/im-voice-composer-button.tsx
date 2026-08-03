'use client';

import { useEffect, useRef, useState } from 'react';
import { Captions, CaptionsOff, Loader2, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ImVoiceComposerButtonProps {
  onText: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

type VoicePhase = 'idle' | 'recording' | 'transcribing';

export function ImVoiceComposerButton({
  onText,
  disabled,
  className,
}: ImVoiceComposerButtonProps) {
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sttConfigured, setSttConfigured] = useState<boolean | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported(Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined');
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/api/shouchao/transcribe', { credentials: 'include', cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setSttConfigured(Boolean(d.configured));
      })
      .catch(() => {
        if (alive) setSttConfigured(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      stopTracks();
      try {
        if (recorderRef.current?.state !== 'inactive') recorderRef.current?.stop();
      } catch {
        /* no-op */
      }
    };
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function getMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      .find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
  }

  async function transcribeBlob(blob: Blob, mimeType: string) {
    if (!blob.size) {
      setError('empty');
      toast({
        variant: 'destructive',
        title: '没有录到声音',
        description: '请重新录音后再试。',
      });
      return;
    }

    setPhase('transcribing');
    try {
      const fd = new FormData();
      const filename = mimeType.includes('mp4') ? 'im-voice.m4a' : 'im-voice.webm';
      fd.append('file', blob, filename);
      fd.append('language', 'zh');
      const response = await fetch('/api/shouchao/transcribe', { method: 'POST', body: fd });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok || !data.text) throw new Error(data.error ?? '语音转文字失败');
      onText(String(data.text));
      setError(null);
      toast({
        title: '语音已转文字',
        description: '已填入输入框，确认后可发送。',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '语音转文字失败';
      setError(message);
      toast({
        variant: 'destructive',
        title: '语音转文字失败',
        description: message,
      });
    } finally {
      setPhase('idle');
    }
  }

  async function startRecording() {
    if (disabled || phase !== 'idle') return;

    if (!supported) {
      setError('unsupported');
      toast({
        variant: 'destructive',
        title: '当前浏览器不支持',
        description: '请使用支持录音的浏览器，或先授予麦克风权限。',
      });
      return;
    }

    if (sttConfigured === false) {
      setError('stt-not-configured');
      toast({
        variant: 'destructive',
        title: '服务端还没配置语音转写',
        description: '请在 AI 设置中配置 DashScope 千问 ASR 或 Whisper 兼容服务。',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        recorderRef.current = null;
        stopTracks();
        void transcribeBlob(blob, type);
      };
      recorder.onerror = () => {
        setPhase('idle');
        stopTracks();
        setError('recording');
        toast({
          variant: 'destructive',
          title: '录音失败',
          description: '录音过程中发生错误，请重试。',
        });
      };

      recorder.start();
      setPhase('recording');
      setError(null);
      toast({
        title: '开始录音',
        description: '再次点击结束录音并转文字。',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      setError(message);
      setPhase('idle');
      stopTracks();
      toast({
        variant: 'destructive',
        title: '无法启动录音',
        description: message.includes('Permission') || message.includes('NotAllowed')
          ? '请先允许浏览器访问麦克风。'
          : message,
      });
    }
  }

  function stopRecording() {
    if (phase !== 'recording') return;
    try {
      recorderRef.current?.stop();
    } catch {
      setPhase('idle');
      stopTracks();
    }
  }

  const active = phase === 'recording';
  const transcribing = phase === 'transcribing';
  const buttonDisabled = disabled || transcribing;

  return (
    <button
      type="button"
      disabled={buttonDisabled}
      aria-label={active ? '结束录音并转文字' : '开始语音转文字'}
      aria-pressed={active}
      title={
        transcribing
          ? '正在转文字...'
          : sttConfigured === false
          ? '服务端还没配置语音转写'
          : error
          ? `语音输入失败: ${error}`
          : active
          ? '点击结束录音并转文字'
          : '点击开始录音，结束后用千问 STT 转文字'
      }
      onClick={() => {
        if (active) stopRecording();
        else void startRecording();
      }}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all',
        active
          ? 'bg-[rgb(var(--brand-500))] text-white shadow-soft-lg shadow-[rgb(var(--brand-500))]/30'
          : 'bg-surface-3 text-ink-secondary hover:bg-surface-3 dark:bg-white/10 dark:text-white/75 dark:hover:bg-white/15',
        buttonDisabled && 'cursor-not-allowed opacity-50',
        sttConfigured === false && 'text-danger hover:text-danger',
        className,
      )}
    >
      {transcribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <Square className="h-4 w-4" />
      ) : error ? (
        <CaptionsOff className="h-4 w-4" />
      ) : (
        <Captions className="h-4 w-4" />
      )}
    </button>
  );
}
