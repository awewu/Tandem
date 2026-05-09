'use client';

import { useState, useMemo } from 'react';
import { useOKRStore } from '@/lib/store';
import { Send, ThumbsUp, Heart, Smile, Trash2, AtSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  scope: 'objective' | 'kr' | 'initiative';
  scopeId: string;
}

const REACTIONS = ['👍', '🎉', '❤️', '🔥', '💡'];

export function OKRComments({ scope, scopeId }: Props) {
  const comments = useOKRStore((s) => s.getComments(scope, scopeId));
  const people = useOKRStore((s) => s.people);
  const currentUserId = useOKRStore((s) => s.currentUserId);
  const addComment = useOKRStore((s) => s.addComment);
  const deleteComment = useOKRStore((s) => s.deleteComment);
  const toggleReaction = useOKRStore((s) => s.toggleReaction);

  const [draft, setDraft] = useState('');
  const [showMentionMenu, setShowMentionMenu] = useState(false);

  const submit = () => {
    if (!draft.trim()) return;
    addComment({ scope, scopeId, authorId: currentUserId, body: draft.trim() });
    setDraft('');
    setShowMentionMenu(false);
  };

  // 把 @人名 高亮
  const renderBody = (body: string) => {
    if (!body) return null;
    const parts: { text: string; isMention: boolean }[] = [];
    let last = 0;
    const regex = /@([^\s,，。！？!?]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(body))) {
      const name = match[1];
      const matchedPerson = people.find((p) => name.startsWith(p.name));
      if (matchedPerson) {
        parts.push({ text: body.slice(last, match.index), isMention: false });
        parts.push({ text: '@' + matchedPerson.name, isMention: true });
        last = match.index + matchedPerson.name.length + 1;
      }
    }
    parts.push({ text: body.slice(last), isMention: false });
    return parts.map((p, i) =>
      p.isMention
        ? <span key={i} className="text-blue-600 bg-blue-50 dark:bg-blue-950/40 rounded px-0.5">{p.text}</span>
        : <span key={i}>{p.text}</span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">
        评论
        {comments.length > 0 && (
          <span className="text-muted-foreground font-normal"> · {comments.length}</span>
        )}
      </div>

      {/* 输入区 */}
      <div className="border rounded">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
            if (e.key === '@') setShowMentionMenu(true);
          }}
          placeholder="说点什么…  · 输入 @ 提及他人 · ⌘/Ctrl+Enter 发送"
          rows={2}
          className="w-full px-2 py-2 text-sm bg-transparent outline-none resize-none"
        />
        <div className="flex items-center justify-between px-2 py-1 border-t bg-muted/30">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMentionMenu(!showMentionMenu)}
              className="text-xs text-muted-foreground hover:text-foreground p-1"
              title="提及他人"
            >
              <AtSign size={14} />
            </button>
            {showMentionMenu && (
              <div className="flex items-center gap-1">
                {people.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setDraft((d) => d + (d.endsWith(' ') || d === '' ? '' : ' ') + '@' + p.name + ' '); setShowMentionMenu(false); }}
                    className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                  >
                    @{p.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1"
          >
            <Send size={12} /> 发送
          </button>
        </div>
      </div>

      {/* 评论列表 */}
      {comments.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
          还没有评论 · 第一个发起讨论吧
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const author = people.find((p) => p.id === c.authorId);
            const reactionCounts = c.reactions.reduce<Record<string, string[]>>((acc, r) => {
              (acc[r.emoji] ||= []).push(r.userId);
              return acc;
            }, {});
            return (
              <div key={c.id} className="group flex gap-2">
                <div className="w-7 h-7 rounded-full bg-muted shrink-0 flex items-center justify-center text-xs font-medium">
                  {author?.name.slice(0, 1) || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{author?.name || '未知'}</span>
                    <span>{new Date(c.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
                    {c.editedAt && <span>(已编辑)</span>}
                    {c.authorId === currentUserId && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-600 ml-auto"
                        title="删除"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words mt-1">{renderBody(c.body)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    {Object.entries(reactionCounts).map(([emoji, userIds]) => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(c.id, emoji, currentUserId)}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded border',
                          userIds.includes(currentUserId) ? 'bg-blue-100 border-blue-300' : 'border-transparent hover:bg-muted',
                        )}
                      >
                        {emoji} {userIds.length}
                      </button>
                    ))}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-1">
                      {REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(c.id, emoji, currentUserId)}
                          className="text-xs hover:bg-muted rounded px-1"
                          title={`点赞 ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
