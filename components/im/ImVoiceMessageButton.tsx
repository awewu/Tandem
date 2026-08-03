'use client';

/**
 * IM 语音消息按钮 (§Sprint2 Megaplan · 语音消息)
 *
 * 与 ImVoiceComposerButton (语音转文字) 不同: 本按钮发送真正的语音条 (audio 附件)。
 * 流程: MediaRecorder 录音 → presign(upload) → PUT 对象存储 → POST 消息 (kind='audio', durationSec)。
 * 录音中可【发送】或【取消】。fail-soft: 不支持/无对象存储时 toast 提示。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Loader2, Square, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  channelId: string;
  disabled?: boolean;
  className?: string;
  onSent?: () => void;
}

type Phase = 'idle' | 'recording' | 'uploading';

export function ImVoiceMessageButton({ channelId, disabled, className, onSent }: Props) {
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelRef = useRef(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSupported(Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined');
  }, []);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
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
  }, [stopTracks]);

  function getMimeType() {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    ) ?? '';
  }

  const uploadAndSend = useCallback(
    async (blob: Blob, mimeType: string, durationSec: number) => {
      if (!blob.size) {
        toast({ variant: 'destructive', title: '没有录到声音', description: '请重新录音。' });
        setPhase('idle');
        return;
      }
      setPhase('uploading');
      try {
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
        const fileName = `voice-${Date.now()}.${ext}`;
        const presignRes = await fetch(`/api/im/channels/${channelId}/attachments/presign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'upload', fileName, contentType: mimeType }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json().catch(() => ({}));
          throw new Error(err.error ?? `预签名失败 (${presignRes.status})`);
        }
        const { uploadUrl, storageKey } = await presignRes.json();
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mimeType },
          body: blob,
        });
        if (!putRes.ok) throw new Error(`上传失败 (${putRes.status})`);

        const msgRes = await fetch(`/api/im/channels/${channelId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: '[语音]',
            attachments: [
              {
                kind: 'audio',
                name: fileName,
                size: blob.size,
                mimeType,
                refId: storageKey,
                durationSec,
              },
            ],
          }),
        });
        if (!msgRes.ok) {
          const err = await msgRes.json().catch(() => ({}));
          throw new Error(err.error ?? `发送失败 (${msgRes.status})`);
        }
        onSent?.();
      } catch (err) {
        toast({
          variant: 'destructive',
          title: '语音发送失败',
          description: err instanceof Error ? err.message : '未知错误',
        });
      } finally {
        setPhase('idle');
        setElapsed(0);
      }
    },
    [channelId, onSent, toast],
  );

  const startRecording = useCallback(async () => {
    if (disabled || phase !== 'idle') return;
    if (!supported) {
      toast({ variant: 'destructive', title: '当前浏览器不支持录音', description: '请更换浏览器或授予麦克风权限。' });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      cancelRef.current = false;
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const durationSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        chunksRef.current = [];
        recorderRef.current = null;
        stopTracks();
        if (cancelRef.current) {
          setPhase('idle');
          setElapsed(0);
          return;
        }
        void uploadAndSend(blob, type, durationSec);
      };
      recorder.onerror = () => {
        stopTracks();
        setPhase('idle');
        setElapsed(0);
        toast({ variant: 'destructive', title: '录音失败', description: '请重试。' });
      };

      recorder.start();
      setPhase('recording');
      setElapsed(0);
      tickRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      stopTracks();
      setPhase('idle');
      const message = err instanceof Error ? err.message : 'unknown';
      toast({
        variant: 'destructive',
        title: '无法启动录音',
        description: message.includes('Permission') || message.includes('NotAllowed') ? '请先允许麦克风权限。' : message,
      });
    }
  }, [disabled, phase, supported, stopTracks, uploadAndSend, toast]);

  const finishRecording = useCallback(() => {
    if (phase !== 'recording') return;
    cancelRef.current = false;
    try {
      recorderRef.current?.stop();
    } catch {
      stopTracks();
      setPhase('idle');
    }
  }, [phase, stopTracks]);

  const cancelRecording = useCallback(() => {
    if (phase !== 'recording') return;
    cancelRef.current = true;
    try {
      recorderRef.current?.stop();
    } catch {
      stopTracks();
      setPhase('idle');
      setElapsed(0);
    }
  }, [phase, stopTracks]);

  if (phase === 'recording') {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={cancelRecording}
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-3"
          title="取消录音"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="min-w-[36px] text-center text-[12px] tabular-nums text-danger">
          {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
        </span>
        <button
          type="button"
          onClick={finishRecording}
          className={cn('flex h-8 w-8 items-center justify-center rounded-md bg-danger/10 text-danger hover:bg-danger/20', className)}
          title="发送语音"
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || phase === 'uploading'}
      onClick={() => void startRecording()}
      title="录制语音消息"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-secondary transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {phase === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <AudioLines className="h-4 w-4" />}
    </button>
  );
}
