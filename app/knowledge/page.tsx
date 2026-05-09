'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useKnowledgeStore, type KNode, useChatStore } from '@/lib/store';
import { FileManager, type FMNode } from '@/components/file-manager';
import { parseDocument, SUPPORTED_ACCEPT } from '@/lib/document-parser';
import { Save, Download, ArrowRightLeft } from 'lucide-react';

export default function KnowledgePage() {
  const { nodes, addNode, updateNode, deleteNode, deleteNodes, moveNodes } = useKnowledgeStore();
  const conversations = useChatStore((s) => s.conversations);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  // 把 KNode 适配到 FMNode：modifiedAt 用 createdAt，size 用 content 字节数，ext 从文件名抽
  const fmNodes: FMNode[] = useMemo(
    () =>
      nodes.map((k) => ({
        id: k.id,
        parentId: k.parentId,
        name: k.name,
        type: k.type,
        modifiedAt: k.createdAt,
        size: k.content ? new Blob([k.content]).size : undefined,
        ext: k.type === 'file' ? (k.name.split('.').pop() || '').toLowerCase() : undefined,
        meta: { content: k.content },
      })),
    [nodes]
  );

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
        addNode({
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
  const deployHermesOutput = () => {
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
        updateNode(existing.id, { content });
      } else {
        addNode({
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
      <div className="p-4 space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-medium break-all">{k.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {k.type === 'folder' ? '文件夹' : (n.ext || '文件').toUpperCase()}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
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

        {k.type === 'file' && (
          <>
            <div className="flex gap-1.5 pt-2 border-t">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => handleOpenFile(n)}>
                <Save className="mr-1 h-3 w-3" /> 编辑
              </Button>
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => downloadNode(k)}>
                <Download className="mr-1 h-3 w-3" /> 下载
              </Button>
            </div>
            {k.content && (
              <div className="pt-2 border-t">
                <div className="text-xs font-medium mb-1.5">预览</div>
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
          <div className="font-medium text-sm truncate">{k.name}</div>
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
          className="flex-1 font-mono text-xs resize-none border-0 rounded-none focus-visible:ring-0"
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
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs ml-1"
            onClick={deployHermesOutput}
            title="把所有对话保存为 .md 到「Hermes产出」文件夹"
          >
            <ArrowRightLeft className="mr-1 h-3 w-3" /> 部署对话
          </Button>
        }
        statusBarExtra={uploadStatus ? <span>{uploadStatus}</span> : undefined}
      />
    </div>
  );
}
