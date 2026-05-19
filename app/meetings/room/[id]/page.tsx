'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RemotePeer {
  identity: string;
  videoTrack?: MediaStreamTrack;
  audioTrack?: MediaStreamTrack;
}

export default function MeetingRoomPage() {
  const params = useParams<{ id: string }>();
  const roomId = params?.id ?? '';
  const [phase, setPhase] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [peers, setPeers] = useState<RemotePeer[]>([]);
  const roomRef = useRef<unknown>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function join() {
      setPhase('connecting');
      try {
        const tokRes = await fetch('/api/meetings/livekit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName: roomId }),
        });
        if (!tokRes.ok) {
          const body = await tokRes.json().catch(() => ({}));
          throw new Error(body.error ?? `token http ${tokRes.status}`);
        }
        const { token, wsUrl } = (await tokRes.json()) as { token: string; wsUrl: string };

        const { Room, RoomEvent, Track } = await import('livekit-client');
        const room = new Room({ adaptiveStream: true, dynacast: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (cancelled) return;
          setPeers((prev) => {
            const idx = prev.findIndex((p) => p.identity === participant.identity);
            const peer: RemotePeer = idx >= 0 ? { ...prev[idx] } : { identity: participant.identity };
            if (track.kind === Track.Kind.Video) peer.videoTrack = track.mediaStreamTrack;
            if (track.kind === Track.Kind.Audio) peer.audioTrack = track.mediaStreamTrack;
            const next = idx >= 0 ? [...prev] : [...prev, peer];
            if (idx >= 0) next[idx] = peer;
            return next;
          });
        });
        room.on(RoomEvent.ParticipantDisconnected, (p) => {
          setPeers((prev) => prev.filter((x) => x.identity !== p.identity));
        });

        await room.connect(wsUrl, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);

        const camTrack = room.localParticipant
          .getTrackPublications()
          .find((p) => p.track?.kind === Track.Kind.Video)?.track;
        if (camTrack && localVideoRef.current) {
          camTrack.attach(localVideoRef.current);
        }
        if (!cancelled) setPhase('connected');
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
          setPhase('error');
        }
      }
    }
    if (roomId) void join();
    return () => {
      cancelled = true;
      const r = roomRef.current as { disconnect?: () => void } | null;
      r?.disconnect?.();
    };
  }, [roomId]);

  async function toggleMic() {
    const r = roomRef.current as { localParticipant?: { setMicrophoneEnabled: (b: boolean) => Promise<void> } } | null;
    if (!r?.localParticipant) return;
    await r.localParticipant.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  }
  async function toggleCam() {
    const r = roomRef.current as { localParticipant?: { setCameraEnabled: (b: boolean) => Promise<void> } } | null;
    if (!r?.localParticipant) return;
    await r.localParticipant.setCameraEnabled(!camOn);
    setCamOn(!camOn);
  }
  async function toggleScreen() {
    const r = roomRef.current as { localParticipant?: { setScreenShareEnabled: (b: boolean) => Promise<void> } } | null;
    if (!r?.localParticipant) return;
    await r.localParticipant.setScreenShareEnabled(!screenSharing);
    setScreenSharing(!screenSharing);
  }
  function leave() {
    const r = roomRef.current as { disconnect?: () => void } | null;
    r?.disconnect?.();
    window.history.back();
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-white">
      <header className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-400">视频会议</div>
          <div className="font-semibold">{roomId}</div>
        </div>
        <div className="text-xs text-slate-400">
          {phase === 'connecting' && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> 连接中…</span>}
          {phase === 'connected' && <span className="text-emerald-400">● 已连接 · {peers.length + 1} 人</span>}
          {phase === 'error' && (
            <span className="inline-flex items-center gap-1 text-rose-400">
              <AlertCircle className="h-3 w-3" /> {error}
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-2 p-3 overflow-auto">
        <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
          <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 text-xs rounded">我</div>
        </div>
        {peers.map((p) => (
          <PeerTile key={p.identity} peer={p} />
        ))}
        {phase === 'connecting' && (
          <div className="bg-slate-900 rounded-lg aspect-video flex items-center justify-center text-slate-500 text-xs">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 p-4 flex items-center justify-center gap-3">
        <Button
          variant={micOn ? 'default' : 'destructive'}
          size="icon"
          onClick={toggleMic}
          disabled={phase !== 'connected'}
        >
          {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </Button>
        <Button
          variant={camOn ? 'default' : 'destructive'}
          size="icon"
          onClick={toggleCam}
          disabled={phase !== 'connected'}
        >
          {camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </Button>
        <Button
          variant={screenSharing ? 'secondary' : 'outline'}
          size="icon"
          onClick={toggleScreen}
          disabled={phase !== 'connected'}
        >
          <ScreenShare className="h-4 w-4" />
        </Button>
        <Button variant="destructive" size="icon" onClick={leave}>
          <PhoneOff className="h-4 w-4" />
        </Button>
      </footer>
    </div>
  );
}

function PeerTile({ peer }: { peer: RemotePeer }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (peer.videoTrack && videoRef.current) {
      const stream = new MediaStream([peer.videoTrack]);
      videoRef.current.srcObject = stream;
    }
    if (peer.audioTrack && audioRef.current) {
      const stream = new MediaStream([peer.audioTrack]);
      audioRef.current.srcObject = stream;
    }
  }, [peer.videoTrack, peer.audioTrack]);
  return (
    <div className="relative bg-slate-900 rounded-lg overflow-hidden aspect-video">
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      <audio ref={audioRef} autoPlay />
      <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-0.5 text-xs rounded">{peer.identity}</div>
    </div>
  );
}
