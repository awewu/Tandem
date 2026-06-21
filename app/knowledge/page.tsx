'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { type KNode, useChatStore } from '@/lib/store';
import { FileManager, type FMNode } from '@/components/file-manager';
import { parseDocument, SUPPORTED_ACCEPT } from '@/lib/document-parser';
import { Save, Download, ArrowRightLeft, Building2, Users, User, Lock } from 'lucide-react';

/**
 * Q1 (2026-05-10) Memory ownership 4 级 — 给文档分级 (公司/部门/团队/个人).
 * 与 /memories (curated Memory entries) 同一套语义.
 *
 * KNode.ownership 字段 (lib/store.ts) 已扩展, 向后兼容 (undefined = 未分级).
 * Surgical add — 不重写已有 file-manager 流程.
 */
type OwnershipFilter = 'all' | 'company' | 'department' | 'team' | 'personal' | 'unset';
type OwnershipLevel = NonNullable<KNode['ownership']>;

const OWNERSHIP_META: Record<OwnershipLevel | 'unset', { label: string; icon: React.ElementType; tone: string }> = {
  company:    { label: '公司',   icon: Building2, tone: 'bg-orange-100 text-orange-700' },
  department: { label: '部门',   icon: Users,     tone: 'bg-info/10 text-info' },
  team:       { label: '团队',   icon: Users,     tone: 'bg-cyan-100 text-cyan-700' },
  personal:   { label: '个人',   icon: Lock,      tone: 'bg-slate-100 text-slate-700' },
  unset:      { label: '未分级', icon: User,      tone: 'bg-muted text-muted-foreground' },
};

export default function KnowledgePage() {
  // ── 后端持久化 (替代原 zustand-persist/localStorage): 数据落库, 跨设备不丢 ──
  const [nodes, setNodes] = useState<KNode[]>([]);
  const conversations = useChatStore((s) => s.conversations);

  const mapApiNode = (n: any): KNode => ({
    id: n.id,
    name: n.name,
    type: n.type,
    parentId: n.parentId ?? 'root',
    content: n.content,
    ownership: n.ownership,
    createdAt: typeof n.createdAt === 'string' ? new Date(n.createdAt).getTime() : (n.createdAt ?? Date.now()),
  });

  const fetchNodes = useCallback(async (): Promise<KNode[]> => {
    const r = await fetch('/api/knowledge', { cache: 'no-store', credentials: 'include' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    return (Array.isArray(j.nodes) ? j.nodes : []).map(mapApiNode);
  }, []);

  const reload = useCallback(async () => {
    try {
      let mapped = await fetchNodes();
      // 首次为空 → 播种默认文件夹 (兼容"部署对话"等既有功能, 需要「Hermes产出」存在)
      if (mapped.length === 0) {
        await Promise.all(
          ['文档', 'Hermes产出', '设计资源'].map((name) =>
            fetch('/api/knowledge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ name, type: 'folder', parentId: 'root' }),
            }),
          ),
        );
        mapped = await fetchNodes();
      }
      setNodes(mapped);
    } catch (err) {
      console.warn('[knowledge] reload failed:', (err as Error).message);
    }
  }, [fetchNodes]);

  useEffect(() => { void reload(); }, [reload]);

  // ── API CRUD wrappers (保持原 store 调用签名, 内部走 /api/knowledge) ──
  const addNode = useCallback(
    async (n: Partial<KNode> & { name: string; type: 'folder' | 'file'; parentId: string }) => {
      await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: n.name,
          type: n.type,
          parentId: n.parentId,
          content: n.content,
          ownership: n.ownership,
        }),
      });
      await reload();
    },
    [reload],
  );

  const updateNode = useCallback(
    async (id: string, patch: Partial<KNode>) => {
      const body: Record<string, unknown> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.content !== undefined) body.content = patch.content;
      if ('ownership' in patch) body.ownership = patch.ownership ?? null;
      await fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      await reload();
    },
    [reload],
  );

  const deleteNode = useCallback(
    async (id: string) => {
      await fetch(`/api/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      await reload();
    },
    [reload],
  );

  const deleteNodes = useCallback(
    async (ids: string[]) => {
      await Promise.allSettled(
        ids.map((id) => fetch(`/api/knowledge/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' })),
      );
      await reload();
    },
    [reload],
  );

  const moveNodes = useCallback(
    async (ids: string[], target: string) => {
      await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ parentId: target }),
          }),
        ),
      );
      await reload();
    },
    [reload],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  /** Q1 ownership 筛选 (默认 all) */
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>('all');

  /** 哪些 node 应被 ownership 筛选过滤掉 */
  const isVisibleByOwnership = (k: KNode): boolean => {
    if (ownershipFilter === 'all') return true;
    if (ownershipFilter === 'unset') return !k.ownership;
    return k.ownership === ownershipFilter;
  };

  // 把 KNode 适配到 FMNode：modifiedAt 用 createdAt，size 用 content 字节数，ext 从文件名抽
  const fmNodes: FMNode[] = useMemo(
    () =>
      nodes.filter(isVisibleByOwnership).map((k) => ({
        id: k.id,
        parentId: k.parentId,
        name: k.name,
        type: k.type,
        modifiedAt: k.createdAt,
        size: k.content ? new Blob([k.content]).size : undefined,
        ext: k.type === 'file' ? (k.name.split('.').pop() || '').toLowerCase() : undefined,
        meta: { content: k.content, ownership: k.ownership },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodes, ownershipFilter]
  );

  /** Ownership 计数 (用于 toolbar 徽章) */
  const ownershipCounts = useMemo(() => {
    const c = { all: nodes.length, company: 0, department: 0, team: 0, personal: 0, unset: 0 };
    for (const n of nodes) {
      if (!n.ownership) c.unset++;
      else c[n.ownership]++;
    }
    return c;
  }, [nodes]);

  const handleCreateFolder = (name: string, parentId: string) => {
    addNode({
      id: crypto.randomUUID(),
      name,
      type: 'folder',
      parentId,
      createdAt: Date.now(),
    });
  };

  const handleRename = (id: string, newName: string) => {
    updateNode(id, { name: newName });
  };

  const handleDelete = (ids: string[]) => {
    if (ids.length === 1) deleteNode(ids[0]);
    else deleteNodes(ids);
    if (ids.includes(editingId || '')) setEditingId(null);
  };

  const handleMove = (ids: string[], target: string) => moveNodes(ids, target);

  const handleUpload = async (files: File[], parentId: string) => {
    setUploadStatus(`解析 ${files.length} 个文件…`);
    let added = 0;
    const failures: string[] = [];
    for (const file of files) {
      try {
        const result = await parseDocument(file);
        const meta = [
          result.format,
          result.pages != null ? `${result.pages}页` : null,
          result.sheets != null ? `${result.sheets}表` : null,
        ].filter(Boolean).join(' · ');
        await addNode({
          id: crypto.randomUUID(),
          name: file.name,
          type: 'file',
          parentId,
          content: meta ? `<!-- ${meta} -->\n\n${result.text}` : result.text,
          createdAt: Date.now(),
        });
        added++;
      } catch (err: any) {
        failures.push(`${file.name}（${err?.message || '解析失败'}）`);
      }
    }
    if (failures.length === 0) setUploadStatus(`✅ 上传 ${added} 个文件成功`);
    else if (added > 0) setUploadStatus(`⚠️ 成功 ${added}，失败 ${failures.length}：${failures[0]}`);
    else setUploadStatus(`❌ 全部失败：${failures[0] || '未知错误'}`);
    window.setTimeout(() => setUploadStatus(''), 5000);
  };

  // 双击文件 → 进入编辑模式
  const handleOpenFile = (node: FMNode) => {
    const k = nodes.find((n) => n.id === node.id);
    if (k && k.type === 'file') {
      setEditingId(k.id);
      setEditContent(k.content || '');
    }
  };

  const saveEdit = () => {
    if (editingId) updateNode(editingId, { content: editContent });
    setEditingId(null);
  };

  const downloadNode = (node: KNode) => {
    const blob = new Blob([node.content || ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = node.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 把当前对话同步到「Hermes产出」文件夹
  const deployHermesOutput = async () => {
    const targetFolder = nodes.find((n) => n.name === 'Hermes产出' && n.type === 'folder');
    if (!targetFolder) return;
    let count = 0;
    for (const conv of conversations) {
      const content = conv.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
      const fileName = `${conv.title || 'Untitled'}.md`;
      const existing = nodes.find(
        (n) => n.name === fileName && n.parentId === targetFolder.id
      );
      if (existing) {
        await updateNode(existing.id, { content });
      } else {
        await addNode({
          id: crypto.randomUUID(),
          name: fileName,
          type: 'file',
          parentId: targetFolder.id,
          content,
          createdAt: Date.now(),
        });
      }
      count++;
    }
    setUploadStatus(`✅ 已部署 ${count} 段对话到 Hermes产出`);
    window.setTimeout(() => setUploadStatus(''), 4000);
  };

  // 详情面板：右侧
  const renderDetails = (n: FMNode) => {
    const k = nodes.find((x) => x.id === n.id);
    if (!k) return null;
    return (
      <div className="p-4 space-y-3 text-caption md:px-8">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium break-all">{k.name}</div>
            <div className="text-footnote text-muted-foreground mt-0.5">
              {k.type === 'folder' ? '文件夹' : (n.ext || '文件').toUpperCase()}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-footnote">
          <div className="flex justify-between">
            <span className="text-muted-foreground">创建时间</span>
            <span>{new Date(k.createdAt).toLocaleString('zh-CN')}</span>
          </div>
          {n.size != null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">大小</span>
              <span>{(n.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">位置</span>
            <span className="font-mono text-[10px] truncate ml-2">
              {k.parentId === 'root' ? '/' : `…/${nodes.find((x) => x.id === k.parentId)?.name || '?'}`}
            </span>
          </div>
        </div>

        {/* Q1 ownership 选择器 */}
        <div className="pt-2 border-t space-y-1.5">
          <div className="text-footnote font-medium">知识归属 (Memory ownership)</div>
          <div className="flex flex-wrap gap-1">
            {(['unset', 'company', 'department', 'team', 'personal'] as const).map((lvl) => {
              const meta = OWNERSHIP_META[lvl];
              const Icon = meta.icon;
              const current = (k.ownership ?? 'unset') === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() =>
                    updateNode(k.id, {
                      ownership: lvl === 'unset' ? undefined : (lvl as KNode['ownership']),
                    })
                  }
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] transition-colors ${
                    current ? meta.tone + ' ring-1 ring-current' : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            企业/部门/团队/个人 4 级 · 与 /memories 同语义 · 影响 Persona 调用时的可见性
          </p>
        </div>

        {k.type === 'file' && (
          <>
            <div className="flex gap-1.5 pt-2 border-t">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-footnote" onClick={() => handleOpenFile(n)}>
                <Save className="mr-1 h-3 w-3" /> 编辑
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-footnote" onClick={() => downloadNode(k)}>
                <Download className="mr-1 h-3 w-3" /> 下载
              </Button>
            </div>
            {k.content && (
              <div className="pt-2 border-t">
                <div className="text-footnote font-medium mb-1.5">预览</div>
                <pre className="text-[10px] font-mono whitespace-pre-wrap break-words bg-muted/40 p-2 rounded max-h-64 overflow-auto leading-relaxed">
                  {k.content.slice(0, 1500)}
                  {k.content.length > 1500 && '\n…'}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // 编辑模式：全屏覆盖 FileManager
  if (editingId) {
    const k = nodes.find((n) => n.id === editingId);
    if (!k) {
      setEditingId(null);
      return null;
    }
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 h-11 border-b">
          <div className="font-medium text-caption truncate">{k.name}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>取消</Button>
            <Button size="sm" onClick={saveEdit}>
              <Save className="mr-1 h-3 w-3" /> 保存
            </Button>
          </div>
        </div>
        <Textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          className="flex-1 font-mono text-footnote resize-none border-0 rounded-none focus-visible:ring-0"
          placeholder="文件内容..."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <FileManager
        nodes={fmNodes}
        rootId="root"
        title="知识库"
        onCreateFolder={handleCreateFolder}
        onRename={handleRename}
        onDelete={handleDelete}
        onMove={handleMove}
        onUpload={handleUpload}
        uploadAccept={SUPPORTED_ACCEPT}
        onOpenFile={handleOpenFile}
        renderDetails={renderDetails}
        toolbarExtra={
          <>
            {/* Q1 Ownership 筛选 */}
            <div className="flex items-center gap-0.5 ml-1 border-l pl-1.5">
              {(['all', 'company', 'department', 'team', 'personal', 'unset'] as const).map((f) => {
                const isAll = f === 'all';
                const meta = isAll ? null : OWNERSHIP_META[f];
                const count = ownershipCounts[f as keyof typeof ownershipCounts];
                const active = ownershipFilter === f;
                const Icon = meta?.icon;
                return (
                  <button
                    key={f}
                    onClick={() => setOwnershipFilter(f)}
                    title={isAll ? '全部' : meta!.label}
                    className={`inline-flex items-center gap-0.5 rounded px-1.5 h-7 text-[11px] transition-colors ${
                      active
                        ? (meta?.tone ?? 'bg-foreground text-background') + ' ring-1 ring-current'
                        : 'hover:bg-accent text-muted-foreground'
                    }`}
                  >
                    {Icon && <Icon className="h-2.5 w-2.5" />}
                    <span>{isAll ? '全部' : meta!.label}</span>
                    <span className="opacity-70 tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-footnote ml-1"
              onClick={deployHermesOutput}
              title="把所有对话保存为 .md 到「Hermes产出」文件夹"
            >
              <ArrowRightLeft className="mr-1 h-3 w-3" /> 部署对话
            </Button>
          </>
        }
        statusBarExtra={uploadStatus ? <span>{uploadStatus}</span> : undefined}
      />
    </div>
  );
}
