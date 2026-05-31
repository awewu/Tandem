'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send } from 'lucide-react';

export interface DeliberationComment {
  id: string;
  userId: string;
  userName?: string;
  comment: string;
  timestamp: string;
  isAi?: boolean;
}

export function DeliberationFeed({
  comments,
  onSubmit,
  currentUserId,
  disabled = false,
}: {
  comments: DeliberationComment[];
  onSubmit: (comment: string) => Promise<void>;
  currentUserId: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [comments.length]);

  async function send() {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await onSubmit(draft.trim());
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-body flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          审议讨论 ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="max-h-80 space-y-2 overflow-y-auto rounded border p-2"
        >
          {comments.length === 0 ? (
            <div className="p-4 text-center text-caption text-muted-foreground">
              暂无讨论, 第一个发言吧
            </div>
          ) : (
            comments.map((c) => (
              <CommentItem key={c.id} comment={c} isOwn={c.userId === currentUserId} />
            ))
          )}
        </div>

        <div className="flex gap-2">
          <textarea
            className="flex-1 rounded border p-2 text-caption"
            rows={2}
            placeholder="发表意见..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={disabled || sending}
          />
          <Button onClick={send} disabled={disabled || sending || !draft.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-footnote text-muted-foreground">⌘/Ctrl + Enter 快速发送</p>
      </CardContent>
    </Card>
  );
}

function CommentItem({ comment, isOwn }: { comment: DeliberationComment; isOwn: boolean }) {
  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
      <div
        className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-footnote font-semibold ${
          comment.isAi ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-700'
        }`}
      >
        {comment.isAi ? 'AI' : (comment.userName ?? comment.userId).slice(0, 1)}
      </div>
      <div className={`max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
        <div className="text-footnote text-muted-foreground">
          {comment.userName ?? comment.userId}
          {comment.isAi && <span className="ml-1 text-purple-600">· AI</span>}
          <span className="ml-2">{formatTime(comment.timestamp)}</span>
        </div>
        <div
          className={`mt-1 rounded-lg px-3 py-2 text-caption ${
            isOwn ? 'bg-blue-100 text-blue-900' : 'bg-slate-100'
          }`}
        >
          {comment.comment}
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
