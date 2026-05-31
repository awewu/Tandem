'use client';

/**
 * /admin/intranet — Intranet 内容管理 (P3-10)
 *
 * 4 类内容: announcement / policy / event / benefit
 * 功能: 列表 + 草稿/发布/归档 + 强制已读勾选 + 已读统计
 *
 * 角色门: admin / champion / hr (后端 requireRole 守卫)
 */

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Megaphone, FileText, Calendar, Gift, Plus, RefreshCw, AlertCircle,
  CheckCircle2, Archive, Eye, Trash2, Send,
} from 'lucide-react';
import type { IntranetPost, IntranetPostType } from '@/lib/types/intranet-post';
import { INTRANET_POST_TYPE_LABELS } from '@/lib/types/intranet-post';

const TYPE_ICON: Record<IntranetPostType, React.ElementType> = {
  announcement: Megaphone,
  policy: FileText,
  event: Calendar,
  benefit: Gift,
};

const TYPE_COLOR: Record<IntranetPostType, string> = {
  announcement: 'bg-warning/5 text-warning border-warning/20',
  policy: 'bg-rose-50 text-rose-700 border-rose-200',
  event: 'bg-blue-50 text-blue-700 border-blue-200',
  benefit: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function IntranetAdminPage() {
  const [posts, setPosts] = useState<IntranetPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<IntranetPost | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/intranet/posts?includeArchived=1&includeDrafts=1', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setPosts((j.posts ?? []) as IntranetPost[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo(() => {
    const m: Record<IntranetPostType, IntranetPost[]> = {
      announcement: [],
      policy: [],
      event: [],
      benefit: [],
    };
    for (const p of posts) m[p.type].push(p);
    return m;
  }, [posts]);

  return (
    <div className="page-container py-8 space-y-6 md:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            Intranet 内容管理
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            公告 · 政策 · 大事记 · 福利 · 数据来源: <span className="font-mono text-footnote">/api/intranet/posts</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setShowNew(true); }}>
            <Plus className="h-4 w-4 mr-1" />
            新建
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-3 text-caption text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {(showNew || editing) && (
        <PostEditor
          initial={editing}
          onCancel={() => { setShowNew(false); setEditing(null); }}
          onSaved={() => { setShowNew(false); setEditing(null); void load(); }}
        />
      )}

      {(['announcement', 'policy', 'event', 'benefit'] as IntranetPostType[]).map((t) => {
        const list = grouped[t];
        const Icon = TYPE_ICON[t];
        return (
          <Card key={t}>
            <CardHeader className="pb-2">
              <CardTitle className="text-body flex items-center gap-2">
                <Icon className="h-4 w-4" />
                {INTRANET_POST_TYPE_LABELS[t]}
                <Badge variant="outline" className={`text-[10px] ${TYPE_COLOR[t]}`}>
                  {list.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {list.length === 0 ? (
                <div className="px-4 py-6 text-center text-footnote text-muted-foreground">
                  暂无{INTRANET_POST_TYPE_LABELS[t]}
                </div>
              ) : (
                <table className="w-full text-caption">
                  <thead className="border-b bg-muted/40 text-footnote uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">标题</th>
                      <th className="px-4 py-2 text-left font-medium">状态</th>
                      <th className="px-4 py-2 text-left font-medium">已读</th>
                      <th className="px-4 py-2 text-left font-medium">发布时间</th>
                      <th className="px-4 py-2 text-left font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((p) => (
                      <PostRow
                        key={p.id}
                        post={p}
                        onEdit={() => { setEditing(p); setShowNew(false); }}
                        onChanged={load}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PostRow({ post, onEdit, onChanged }: { post: IntranetPost; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/intranet/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const isDraft = !post.publishedAt;
  const isArchived = !!post.archivedAt;
  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-2.5">
        <div className="font-medium truncate max-w-md">{post.title}</div>
        {post.mandatoryRead && (
          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[9px] mt-0.5">
            强制已读
          </Badge>
        )}
      </td>
      <td className="px-4 py-2.5">
        {isArchived ? (
          <Badge variant="outline" className="bg-surface-1 text-ink-secondary text-[10px]">已归档</Badge>
        ) : isDraft ? (
          <Badge variant="outline" className="bg-warning/5 text-warning text-[10px]">草稿</Badge>
        ) : (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px]">已发布</Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-footnote text-muted-foreground tabular-nums">
        {post.mandatoryRead ? `${post.readBy.length} 人` : '—'}
      </td>
      <td className="px-4 py-2.5 text-footnote text-muted-foreground">
        {post.publishedAt ? new Date(post.publishedAt).toLocaleString('zh-CN') : '—'}
      </td>
      <td className="px-4 py-2.5">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-footnote" onClick={onEdit} disabled={busy}>
            <Eye className="h-3 w-3 mr-0.5" />编辑
          </Button>
          {isDraft && !isArchived && (
            <Button size="sm" variant="ghost" className="h-7 text-footnote text-emerald-700"
              onClick={() => void patch({ publish: true })} disabled={busy}>
              <Send className="h-3 w-3 mr-0.5" />发布
            </Button>
          )}
          {!isDraft && !isArchived && (
            <Button size="sm" variant="ghost" className="h-7 text-footnote"
              onClick={() => void patch({ unpublish: true })} disabled={busy}>
              收回
            </Button>
          )}
          {!isArchived ? (
            <Button size="sm" variant="ghost" className="h-7 text-footnote text-ink-secondary"
              onClick={() => { if (confirm(`确认归档 "${post.title}"?`)) void patch({ archive: true }); }} disabled={busy}>
              <Archive className="h-3 w-3 mr-0.5" />归档
            </Button>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-footnote"
              onClick={() => void patch({ unarchive: true })} disabled={busy}>
              恢复
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function PostEditor({
  initial, onCancel, onSaved,
}: {
  initial: IntranetPost | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<IntranetPostType>(initial?.type ?? 'announcement');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [mandatoryRead, setMandatoryRead] = useState(initial?.mandatoryRead ?? false);
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(asDraft: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const tagArr = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (initial) {
        const r = await fetch(`/api/intranet/posts/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            title, body, summary: summary || undefined, mandatoryRead, tags: tagArr,
            ...(asDraft ? { unpublish: true } : (initial.publishedAt ? {} : { publish: true })),
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } else {
        const r = await fetch('/api/intranet/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            type, title, body, summary: summary || undefined, mandatoryRead, tags: tagArr,
            draft: asDraft,
          }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-body flex items-center gap-2">
          {initial ? '编辑' : '新建'}内容
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-footnote">类型</Label>
            <Select value={type} onValueChange={(v) => setType(v as IntranetPostType)} disabled={!!initial}>
              <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(['announcement', 'policy', 'event', 'benefit'] as IntranetPostType[]).map((t) => (
                  <SelectItem key={t} value={t}>{INTRANET_POST_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-footnote cursor-pointer">
              <input
                type="checkbox"
                checked={mandatoryRead}
                onChange={(e) => setMandatoryRead(e.target.checked)}
                className="h-3.5 w-3.5 accent-rose-600"
              />
              强制已读 (政策类常用; 用户首次访问需点&ldquo;我已知晓&rdquo;)
            </label>
          </div>
        </div>
        <div>
          <Label className="text-footnote">标题</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="一句话总结" />
        </div>
        <div>
          <Label className="text-footnote">摘要 (可选, ≤280 字)</Label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value.slice(0, 280))}
            rows={2}
            className="mt-1 text-caption"
            placeholder="列表页展示用; 留空则不显示摘要"
          />
        </div>
        <div>
          <Label className="text-footnote">正文 (Markdown)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="mt-1 text-caption font-mono"
            placeholder="支持 Markdown 语法"
          />
        </div>
        <div>
          <Label className="text-footnote">标签 (逗号分隔)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1" placeholder="Q4-2026, 工程部" />
        </div>

        {err && (
          <div className="text-footnote text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />{err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>取消</Button>
          <Button variant="outline" size="sm" onClick={() => void save(true)} disabled={busy || !title || !body}>
            存为草稿
          </Button>
          <Button size="sm" onClick={() => void save(false)} disabled={busy || !title || !body}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {initial && initial.publishedAt ? '保存' : '发布'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// silenced unused import for clarity
void Trash2;

