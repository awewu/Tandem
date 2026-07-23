'use client';

/**
 * /admin/intranet — Intranet 内容管理 (P3-10)
 *
 * 4 类内容: announcement / policy / event / benefit
 * 功能: 列表 + 草稿/发布/归档 + 强制已读勾选 + 已读统计
 *
 * 角色门: owner / admin / steward / champion / intranet_editor (后端 requireRole 守卫)
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
  Megaphone, Plus, RefreshCw, AlertCircle,
  CheckCircle2, Archive, Eye, Send, Search, X, ChevronLeft, ChevronRight,
  ImagePlus, Trash2, UploadCloud, FileImage, FileText, ArrowUp, ArrowDown, Loader2,
} from 'lucide-react';
import type { IntranetAttachment, IntranetPost, IntranetPostType } from '@/lib/types/intranet-post';
import { INTRANET_POST_TYPE_LABELS } from '@/lib/types/intranet-post';

const TYPE_COLOR: Record<IntranetPostType, string> = {
  announcement: 'bg-warning/5 text-warning border-warning/20',
  policy: 'bg-danger/5 text-danger border-danger/30',
  event: 'bg-info/10 text-info border-info/30',
  benefit: 'bg-success/10 text-success border-success/30',
};

export default function IntranetAdminPage() {
  const [posts, setPosts] = useState<IntranetPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<IntranetPost | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | IntranetPostType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [page, setPage] = useState(1);

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

  const counts = useMemo(() => ({
    total: posts.length,
    published: posts.filter((p) => p.publishedAt && !p.archivedAt).length,
    draft: posts.filter((p) => !p.publishedAt && !p.archivedAt).length,
    archived: posts.filter((p) => !!p.archivedAt).length,
  }), [posts]);

  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('zh-CN');
    return posts.filter((post) => {
      if (typeFilter !== 'all' && post.type !== typeFilter) return false;
      if (statusFilter === 'published' && (!post.publishedAt || post.archivedAt)) return false;
      if (statusFilter === 'draft' && (post.publishedAt || post.archivedAt)) return false;
      if (statusFilter === 'archived' && !post.archivedAt) return false;
      if (!needle) return true;
      return [post.title, post.summary, post.body, ...(post.tags ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('zh-CN').includes(needle));
    });
  }, [posts, query, typeFilter, statusFilter]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visiblePosts = filteredPosts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function clearFilters() {
    setQuery('');
    setTypeFilter('all');
    setStatusFilter('all');
    setPage(1);
  }

  return (
    <div className="page-container py-8 space-y-6 md:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-title-3 font-semibold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            内网内容管理
          </h1>
          <p className="text-caption text-muted-foreground mt-1">
            集中维护公告、政策、大事记和福利内容
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
        <Card className="border-danger/30 bg-danger/5">
          <CardContent className="py-3 text-caption text-danger flex items-center gap-2">
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

      <section className="overflow-hidden rounded-lg border bg-background">
        <div className="grid grid-cols-2 border-b md:grid-cols-4">
          {([
            ['全部内容', counts.total],
            ['已发布', counts.published],
            ['草稿', counts.draft],
            ['已归档', counts.archived],
          ] as const).map(([label, value], index) => (
            <div key={label} className={`px-4 py-3 ${index > 0 ? 'border-l' : ''} ${index > 1 ? 'border-t md:border-t-0' : ''}`}>
              <div className="text-footnote text-muted-foreground">{label}</div>
              <div className="mt-0.5 text-title-3 font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              className="pl-9 pr-9"
              placeholder="搜索标题、摘要、正文或标签"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); setPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground" aria-label="清除搜索">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={typeFilter} onValueChange={(value) => { setTypeFilter(value as typeof typeFilter); setPage(1); }}>
            <SelectTrigger className="w-full lg:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部分类</SelectItem>
              {(['announcement', 'policy', 'event', 'benefit'] as IntranetPostType[]).map((type) => (
                <SelectItem key={type} value={type}>{INTRANET_POST_TYPE_LABELS[type]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as typeof statusFilter); setPage(1); }}>
            <SelectTrigger className="w-full lg:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="published">已发布</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="archived">已归档</SelectItem>
            </SelectContent>
          </Select>
          <div className="shrink-0 text-footnote text-muted-foreground">找到 {filteredPosts.length} 条</div>
        </div>

        <div className="overflow-x-auto">
          {visiblePosts.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-caption font-medium">没有找到匹配的内容</p>
              <Button variant="link" size="sm" onClick={clearFilters}>清除筛选条件</Button>
            </div>
          ) : (
            <table className="w-full min-w-[860px] text-caption">
              <thead className="border-b bg-muted/40 text-footnote text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">内容</th>
                  <th className="px-4 py-2.5 text-left font-medium">分类</th>
                  <th className="px-4 py-2.5 text-left font-medium">状态</th>
                  <th className="px-4 py-2.5 text-left font-medium">阅读 / 确认</th>
                  <th className="px-4 py-2.5 text-left font-medium">发布时间</th>
                  <th className="px-4 py-2.5 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {visiblePosts.map((post) => (
                  <PostRow key={post.id} post={post} onEdit={() => { setEditing(post); setShowNew(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} onChanged={load} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-footnote text-muted-foreground">第 {currentPage} / {totalPages} 页</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="上一页"><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="下一页"><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function PostRow({ post, onEdit, onChanged }: { post: IntranetPost; onEdit: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const response = await fetch(`/api/intranet/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      onChanged();
    } catch (error) {
      alert(error instanceof Error ? `操作失败：${error.message}` : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  const isDraft = !post.publishedAt;
  const isArchived = !!post.archivedAt;
  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded border bg-muted text-muted-foreground">
            {post.coverImage ? <img src={post.coverImage} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="max-w-sm truncate font-medium">{post.title}</div>
            {post.summary && <div className="mt-0.5 max-w-sm truncate text-footnote text-muted-foreground">{post.summary}</div>}
            {post.mandatoryRead && (
              <Badge variant="outline" className="mt-0.5 border-danger/30 bg-danger/5 text-[9px] text-danger">强制已读</Badge>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <Badge variant="outline" className={`text-[10px] ${TYPE_COLOR[post.type]}`}>
          {INTRANET_POST_TYPE_LABELS[post.type]}
        </Badge>
      </td>
      <td className="px-4 py-2.5">
        {isArchived ? (
          <Badge variant="outline" className="bg-surface-1 text-ink-secondary text-[10px]">已归档</Badge>
        ) : isDraft ? (
          <Badge variant="outline" className="bg-warning/5 text-warning text-[10px]">草稿</Badge>
        ) : (
          <Badge variant="outline" className="bg-success/10 text-success text-[10px]">已发布</Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-footnote text-muted-foreground tabular-nums">
        {post.mandatoryRead
          ? `${(post.viewedBy ?? []).length} 阅读 · ${post.readBy.length} 确认`
          : `${(post.viewedBy ?? []).length} 人`}
      </td>
      <td className="px-4 py-2.5 text-footnote text-muted-foreground">
        {post.publishedAt ? new Date(post.publishedAt).toLocaleString('zh-CN') : '—'}
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-footnote" onClick={onEdit} disabled={busy}>
            <Eye className="h-3 w-3 mr-0.5" />编辑
          </Button>
          {isDraft && !isArchived && (
            <Button size="sm" variant="ghost" className="h-7 text-footnote text-success"
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
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? '');
  const [attachments, setAttachments] = useState<IntranetAttachment[]>(
    (initial?.attachments ?? []).filter((item): item is IntranetAttachment => typeof item !== 'string'),
  );
  const [uploading, setUploading] = useState(false);
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
            title, body, summary: summary || undefined, coverImage, attachments, mandatoryRead, tags: tagArr,
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
            type, title, body, summary: summary || undefined, coverImage, attachments, mandatoryRead, tags: tagArr,
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

  async function uploadAttachments(files: FileList | null) {
    if (!files?.length || uploading) return;
    setUploading(true);
    setErr(null);
    try {
      const uploaded: IntranetAttachment[] = [];
      for (const file of Array.from(files)) {
        const contentType = inferAttachmentMime(file);
        if (!contentType) {
          throw new Error(`${file.name}：仅支持 PDF、JPG、PNG、WebP`);
        }
        if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}：不能超过 25 MB`);
        const prepare = await fetch('/api/intranet/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fileName: file.name, contentType, size: file.size }),
        });
        const prepared = await prepare.json().catch(() => ({}));
        if (!prepare.ok) throw new Error(prepared.error ?? `${file.name} 上传准备失败`);
        const upload = await fetch(prepared.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          credentials: 'include',
          body: file,
        });
        if (!upload.ok) throw new Error(`${file.name} 上传失败`);
        uploaded.push(prepared.attachment as IntranetAttachment);
      }
      setAttachments((current) => [...current, ...uploaded].slice(0, 20));
    } catch (error) {
      setErr(error instanceof Error ? error.message : '附件上传失败');
    } finally {
      setUploading(false);
    }
  }

  function moveAttachment(index: number, offset: -1 | 1) {
    setAttachments((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
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
          <div className="flex items-center justify-between">
            <Label className="text-footnote">封面图 (建议 16:9)</Label>
            {coverImage && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-footnote text-danger" onClick={() => setCoverImage('')}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />移除封面
              </Button>
            )}
          </div>
          <div className="mt-1 grid gap-3 md:grid-cols-[240px_1fr]">
            <label className="group relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-md border border-dashed bg-muted/40 hover:border-primary/60">
              {coverImage ? (
                <img src={coverImage} alt="封面预览" className="h-full w-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-1.5 text-footnote text-muted-foreground">
                  <ImagePlus className="h-6 w-6" />点击上传图片
                </span>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  void compressCoverImage(file).then(setCoverImage).catch((error: unknown) => {
                    setErr(error instanceof Error ? error.message : '封面处理失败');
                  });
                }}
              />
            </label>
            <div className="space-y-2">
              <div>
                <Label className="text-footnote text-muted-foreground">或填写图片地址</Label>
                <Input value={coverImage.startsWith('data:') ? '' : coverImage} onChange={(event) => setCoverImage(event.target.value)} className="mt-1" placeholder="https://... 或 /images/..." />
              </div>
              <p className="text-footnote text-muted-foreground">上传时自动裁剪为 16:9 并压缩，支持 JPG、PNG、WebP，原图不超过 10 MB。</p>
            </div>
          </div>
        </div>
        <div>
          <Label className="text-footnote">正文 (Markdown)</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="mt-1 text-caption font-mono"
            placeholder="支持 Markdown 语法；也可以留空，直接上传下方 PDF 或图片"
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-footnote">正文文件</Label>
              <p className="mt-0.5 text-footnote text-muted-foreground">图片和 PDF 将按下列顺序直接展示在文章详情中，单个文件不超过 25 MB。</p>
            </div>
            <label className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-footnote font-medium ${uploading ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-muted'}`}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
              {uploading ? '上传中' : '上传文件'}
              <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { void uploadAttachments(event.target.files); event.target.value = ''; }} />
            </label>
          </div>
          {attachments.length > 0 ? (
            <div className="mt-2 divide-y overflow-hidden rounded-md border">
              {attachments.map((attachment, index) => {
                const AttachmentIcon = attachment.mimeType === 'application/pdf' ? FileText : FileImage;
                return (
                  <div key={attachment.id} className="flex items-center gap-3 px-3 py-2">
                    <AttachmentIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-caption font-medium">{attachment.name}</div>
                      <div className="text-footnote text-muted-foreground">{attachment.mimeType === 'application/pdf' ? 'PDF' : '图片'} · {formatFileSize(attachment.size)}</div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === 0} onClick={() => moveAttachment(index, -1)} aria-label="向上移动"><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={index === attachments.length - 1} onClick={() => moveAttachment(index, 1)} aria-label="向下移动"><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-danger" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label="移除文件"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-2 flex h-20 items-center justify-center rounded-md border border-dashed text-footnote text-muted-foreground">尚未上传正文文件</div>
          )}
        </div>
        <div>
          <Label className="text-footnote">标签 (逗号分隔)</Label>
          <Input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1" placeholder="Q4-2026, 工程部" />
        </div>

        {err && (
          <div className="text-footnote text-danger bg-danger/5 border border-danger/30 rounded px-3 py-2 flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5" />{err}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>取消</Button>
          <Button variant="outline" size="sm" onClick={() => void save(true)} disabled={busy || uploading || !title || (!body.trim() && attachments.length === 0)}>
            存为草稿
          </Button>
          <Button size="sm" onClick={() => void save(false)} disabled={busy || uploading || !title || (!body.trim() && attachments.length === 0)}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {initial && initial.publishedAt ? '保存' : '发布'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function compressCoverImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('请选择 JPG、PNG 或 WebP 图片'));
  }
  if (file.size > 10 * 1024 * 1024) {
    return Promise.reject(new Error('原图不能超过 10 MB'));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 900;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('浏览器无法处理该图片'));
        return;
      }
      const sourceRatio = image.naturalWidth / image.naturalHeight;
      const targetRatio = canvas.width / canvas.height;
      const sourceWidth = sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
      const sourceHeight = sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
      const sourceX = (image.naturalWidth - sourceWidth) / 2;
      const sourceY = (image.naturalHeight - sourceHeight) / 2;
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
      const encoded = canvas.toDataURL('image/webp', 0.82);
      if (encoded.length > 2_000_000) {
        reject(new Error('压缩后的封面仍然过大，请换一张图片'));
        return;
      }
      resolve(encoded);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('无法读取该图片'));
    };
    image.src = objectUrl;
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function inferAttachmentMime(file: File): IntranetAttachment['mimeType'] | null {
  if (['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return file.type as IntranetAttachment['mimeType'];
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}

