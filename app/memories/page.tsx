'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMemoryStore, type Memory } from '@/lib/store';
import { FileManager, type FMNode } from '@/components/file-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TandemMemoryDigest } from '@/components/memories/tandem-memory-digest';
import { parseDocument, SUPPORTED_ACCEPT, SUPPORTED_LIST } from '@/lib/document-parser';
import { getMemoryStatus, type MemoryStatus } from '@/lib/hermes-api';
import { cn } from '@/lib/utils';
import {
  Save, Download, Upload, Eye, EyeOff, Tag, AlertCircle, FileText, CheckCircle2,
  Lightbulb, Database, Cloud,
} from 'lucide-react';

const CATEGORY_LABELS: Record<Memory['category'], { label: string; icon: React.ElementType; color: string }> = {
  requirement: { label: '需求', icon: AlertCircle, color: 'bg-blue-500' },
  consensus: { label: '共识', icon: CheckCircle2, color: 'bg-green-500' },
  standard: { label: '标准', icon: FileText, color: 'bg-purple-500' },
  context: { label: '上下文', icon: Lightbulb, color: 'bg-yellow-500' },
};

const PRIORITY_COLORS: Record<Memory['priority'], string> = {
  low: 'bg-slate-400',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  critical: 'bg-red-600',
};

export default function MemoriesPage() {
  const {
    memories, folders, addMemory, updateMemory, toggleActive,
    deleteMemoryNodes, moveMemoryNodes, addFolder, renameFolder,
    exportMemories, importMemories,
  } = useMemoryStore();

  const [hermesMemory, setHermesMemory] = useState<MemoryStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    getMemoryStatus().then((d) => { if (!cancelled) setHermesMemory(d as MemoryStatus); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 编辑/新建模式
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [draft, setDraft] = useState<Partial<Memory>>({});

  const [toast, setToast] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null);
  const showToast = (kind: 'success' | 'error' | 'info', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 4500);
  };

  // === 把 memories + folders 适配为 FMNode[] ===
  const fmNodes: FMNode[] = useMemo(() => {
    const folderNodes: FMNode[] = folders.map((f) => ({
      id: f.id,
      parentId: f.parentId,
      name: f.name,
      type: 'folder',
      modifiedAt: f.createdAt,
    }));
    const memoryNodes: FMNode[] = memories.map((m) => ({
      id: m.id,
      parentId: m.parentId || `cat-${m.category}`,
      name: m.title || '(未命名)',
      type: 'file',
      ext: m.category,
      modifiedAt: m.updatedAt,
      size: new Blob([m.content || '']).size,
      tags: m.tags,
      meta: { memory: m },
    }));
    return [...folderNodes, ...memoryNodes];
  }, [folders, memories]);

  // === 上传资料 → 解析后建为 memory 文件 ===
  const handleUpload = async (files: File[], parentId: string) => {
    showToast('info', `正在解析 ${files.length} 个文件…`);
    let added = 0;
    const failures: string[] = [];
    for (const file of files) {
      try {
        const result = await parseDocument(file);
        if (!result.text) { failures.push(`${file.name}（空）`); continue; }
        // 推断 category：用文件夹来推断或者按文件名匹配
        const folder = folders.find((f) => f.id === parentId);
        const folderHint = folder?.id || '';
        const category: Memory['category'] =
          folderHint === 'cat-requirement' ? 'requirement'
          : folderHint === 'cat-consensus' ? 'consensus'
          : folderHint === 'cat-standard' ? 'standard'
          : folderHint === 'cat-context' ? 'context'
          : /standard|规范|规则/i.test(file.name) ? 'standard'
          : /requirement|需求/i.test(file.name) ? 'requirement'
          : /consensus|共识/i.test(file.name) ? 'consensus'
          : 'context';
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const meta = [
          result.format,
          result.pages != null ? `${result.pages}页` : null,
          result.sheets != null ? `${result.sheets}表` : null,
          `${(result.bytes / 1024).toFixed(1)}KB`,
        ].filter(Boolean).join(' · ');
        addMemory({
          title: file.name.replace(/\.[^.]+$/, ''),
          content: `<!-- 来源：${file.name} (${meta}) -->\n\n${result.text}`,
          category,
          parentId,
          tags: [ext, result.format, 'uploaded'],
          priority: 'medium',
          isActive: true,
        } as Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'version'>);
        added++;
      } catch (err: any) {
        failures.push(`${file.name}（${err?.message || '解析失败'}）`);
      }
    }
    if (failures.length === 0) showToast('success', `成功添加 ${added} 条 memory`);
    else if (added > 0) showToast('info', `成功 ${added}，失败 ${failures.length}：${failures[0]}`);
    else showToast('error', `全部失败：${failures[0] || '未知错误'}`);
  };

  // === 文件夹/memory 重命名（统一入口） ===
  const handleRename = (id: string, newName: string) => {
    if (folders.some((f) => f.id === id)) renameFolder(id, newName);
    else updateMemory(id, { title: newName });
  };

  const handleCreateFolder = (name: string, parentId: string) => addFolder(name, parentId);
  const handleDelete = (ids: string[]) => deleteMemoryNodes(ids);
  const handleMove = (ids: string[], target: string) => moveMemoryNodes(ids, target);

  // === 双击 memory 文件 → 进入编辑 ===
  const handleOpenFile = (node: FMNode) => {
    const m = memories.find((x) => x.id === node.id);
    if (m) {
      setEditingId(m.id);
      setCreatingNew(false);
      setDraft({ ...m });
    }
  };

  const startNewMemory = (parentId: string) => {
    setEditingId(null);
    setCreatingNew(true);
    const folder = folders.find((f) => f.id === parentId);
    const cat: Memory['category'] =
      folder?.id === 'cat-requirement' ? 'requirement'
      : folder?.id === 'cat-consensus' ? 'consensus'
      : folder?.id === 'cat-standard' ? 'standard'
      : folder?.id === 'cat-context' ? 'context'
      : 'context';
    setDraft({
      title: '',
      content: '',
      category: cat,
      parentId,
      tags: [],
      priority: 'medium',
      isActive: true,
    });
  };

  const saveDraft = () => {
    if (!draft.title?.trim() || !draft.content?.trim()) {
      showToast('error', '标题和内容均不能为空');
      return;
    }
    if (creatingNew) {
      addMemory(draft as Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'version'>);
    } else if (editingId) {
      updateMemory(editingId, draft);
    }
    setEditingId(null);
    setCreatingNew(false);
    setDraft({});
  };

  const cancelEdit = () => {
    setEditingId(null);
    setCreatingNew(false);
    setDraft({});
  };

  // === 导入/导出 JSON 备份 ===
  const handleExport = () => {
    const data = exportMemories();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('JSON 顶层必须是 memory 数组');
        importMemories(text);
        showToast('success', `已恢复 ${parsed.length} 条 memory`);
      } catch (err: any) {
        showToast('error', `导入失败：${err?.message || '不是有效的 memory JSON 备份'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // === 详情面板 ===
  const renderDetails = (node: FMNode) => {
    const memory = memories.find((m) => m.id === node.id);
    const folder = folders.find((f) => f.id === node.id);

    if (folder) {
      const childCount = memories.filter((m) => m.parentId === folder.id).length
        + folders.filter((f) => f.parentId === folder.id).length;
      return (
        <div className="p-4 space-y-2 text-sm">
          <div className="font-medium">{folder.name}</div>
          <div className="text-xs text-muted-foreground">文件夹 · 包含 {childCount} 项</div>
          <Button
            size="sm"
            className="w-full mt-3"
            onClick={() => startNewMemory(folder.id)}
          >
            + 在此新建 Memory
          </Button>
        </div>
      );
    }

    if (!memory) return null;
    const cat = CATEGORY_LABELS[memory.category];
    return (
      <div className="p-4 space-y-3 text-sm">
        <div>
          <div className="font-medium break-words">{memory.title}</div>
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            <Badge variant="outline" className="text-[10px] gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', cat.color)} />
              {cat.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] gap-1">
              <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_COLORS[memory.priority])} />
              {memory.priority}
            </Badge>
            {memory.isActive ? (
              <Badge variant="outline" className="text-[10px] text-green-700 dark:text-green-400">
                <Eye className="h-2.5 w-2.5 mr-0.5" /> active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                <EyeOff className="h-2.5 w-2.5 mr-0.5" /> inactive
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">版本</span>
            <span>v{memory.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">创建</span>
            <span>{new Date(memory.createdAt).toLocaleDateString('zh-CN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">更新</span>
            <span>{new Date(memory.updatedAt).toLocaleDateString('zh-CN')}</span>
          </div>
        </div>

        {memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t">
            {memory.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">
                <Tag className="h-2.5 w-2.5 mr-0.5" />{t}
              </Badge>
            ))}
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="text-xs font-medium mb-1">内容预览</div>
          <pre className="text-[10px] font-mono whitespace-pre-wrap break-words bg-muted/40 p-2 rounded max-h-48 overflow-auto leading-relaxed">
            {memory.content.slice(0, 800)}{memory.content.length > 800 && '\n…'}
          </pre>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-2 border-t">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleOpenFile(node)}>
            编辑
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggleActive(memory.id)}>
            {memory.isActive ? '停用' : '激活'}
          </Button>
        </div>
      </div>
    );
  };

  // === 侧栏顶部：Hermes Memory 状态 ===
  const renderSidebarTop = () => {
    if (!hermesMemory) return null;
    return (
      <div className="text-[11px] space-y-1">
        <div className="flex items-center gap-1 font-medium text-muted-foreground">
          <Database className="h-3 w-3" /> Hermes Memory
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Built-in</span>
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Provider</span>
          {hermesMemory.provider.configured ? (
            <span className="flex items-center gap-1">
              <Cloud className="h-3 w-3 text-blue-500" />
              {hermesMemory.provider.name}
            </span>
          ) : (
            <span className="text-muted-foreground">none</span>
          )}
        </div>
      </div>
    );
  };

  // === 编辑/新建模式：覆盖 FileManager ===
  if (editingId || creatingNew) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 h-11 border-b">
          <div className="font-medium text-sm">
            {creatingNew ? '新建 Memory' : '编辑 Memory'}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancelEdit}>取消</Button>
            <Button size="sm" onClick={saveDraft}><Save className="mr-1 h-3 w-3" /> 保存</Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">标题</label>
            <Input
              value={draft.title || ''}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="例：项目编码规范"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">分类</label>
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft({ ...draft, category: v as Memory['category'] })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="requirement">需求</SelectItem>
                  <SelectItem value="consensus">共识</SelectItem>
                  <SelectItem value="standard">标准</SelectItem>
                  <SelectItem value="context">上下文</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">优先级</label>
              <Select
                value={draft.priority}
                onValueChange={(v) => setDraft({ ...draft, priority: v as Memory['priority'] })}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">低</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="critical">关键</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">标签（逗号分隔）</label>
            <Input
              value={(draft.tags || []).join(', ')}
              onChange={(e) =>
                setDraft({ ...draft, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })
              }
              placeholder="例：tech-stack, frontend"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">内容</label>
            <Textarea
              value={draft.content || ''}
              onChange={(e) => setDraft({ ...draft, content: e.target.value })}
              rows={20}
              placeholder="详细描述..."
              className="mt-1 font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
              id="active-cb"
            />
            <label htmlFor="active-cb" className="text-xs text-muted-foreground">
              激活（参与 baseline system prompt 注入）
            </label>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="company" className="flex flex-col h-full">
      <div className="px-4 pt-3 border-b">
        <TabsList>
          <TabsTrigger value="company">公司 Memory</TabsTrigger>
          <TabsTrigger value="personal">我的记事本</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="company" className="flex-1 overflow-auto p-4 space-y-4 m-0">
        <TandemMemoryDigest />
      </TabsContent>
      <TabsContent value="personal" className="flex-1 m-0 relative overflow-hidden">
      <FileManager
        nodes={fmNodes}
        rootId="mem-root"
        title="记忆库"
        onCreateFolder={handleCreateFolder}
        onRename={handleRename}
        onDelete={handleDelete}
        onMove={handleMove}
        onUpload={handleUpload}
        uploadAccept={SUPPORTED_ACCEPT}
        onOpenFile={handleOpenFile}
        renderDetails={renderDetails}
        renderSidebarTop={renderSidebarTop}
        toolbarExtra={
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs ml-1"
              onClick={() => startNewMemory('cat-context')}
              title="新建一条 memory"
            >
              + Memory
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleExport} title="导出 JSON 备份">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <label title="导入 JSON 备份">
              <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                <span><Upload className="h-3.5 w-3.5" /></span>
              </Button>
            </label>
          </>
        }
        statusBarExtra={
          <span className="text-[10px]">支持 {SUPPORTED_LIST}</span>
        }
      />
      {toast && (
        <div
          className={cn(
            'absolute bottom-10 right-4 max-w-md text-xs px-3 py-2 rounded border shadow-md',
            toast.kind === 'success' && 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200',
            toast.kind === 'error' && 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200',
            toast.kind === 'info' && 'bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200',
          )}
        >
          {toast.text}
        </div>
      )}
      </TabsContent>
    </Tabs>
  );
}
