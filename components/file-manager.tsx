'use client';

/**
 * 通用 Finder/Explorer 风格文件管理器组件
 *
 * 提供：
 *  - 三栏布局：树侧栏 / 主内容区 / 详情面板（可切换）
 *  - 工具栏：返回/前进/上层 + 面包屑 + 搜索 + 视图切换 + 排序 + 新建/上传/删除
 *  - 多选：单击=单选；Ctrl/Cmd+click=切换；Shift+click=区间
 *  - 右键上下文菜单：打开/重命名/复制/剪切/粘贴/删除/属性/新建文件夹
 *  - 内联重命名：F2 或双击名称
 *  - 键盘：↑↓←→ 导航；Enter 打开；Del 删除；F2 重命名；Ctrl+A 全选；Esc 取消
 *  - 视图：图标网格 / 详情列表（按列排序）
 *  - 拖拽：节点拖到文件夹=移动；OS 文件拖到文件夹=上传
 *  - 状态栏：项目数 / 选中数
 *
 * 使用方在外层提供节点数据 + onRename/onDelete/onMove/onCreateFolder/onUpload 等回调。
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  Search,
  LayoutGrid,
  List as ListIcon,
  Plus,
  Upload as UploadIcon,
  Trash2,
  ArrowUpDown,
  Info,
  Edit2,
  Copy,
  Scissors,
  Clipboard,
  FileSpreadsheet,
  FileCode,
  FileType,
  FileImage,
  FileArchive,
  FileVideo,
  FileAudio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface FMNode {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder' | 'file';
  modifiedAt?: number;
  size?: number;
  ext?: string;
  tags?: string[];
  meta?: Record<string, any>;
}

export interface FileManagerProps {
  nodes: FMNode[];
  rootId: string;
  /** 工具栏主标题 */
  title?: string;
  /** 当前路径变化时回调（id 数组，从 root 到当前文件夹） */
  onPathChange?: (path: string[]) => void;
  /** 双击文件回调；若不提供则只在右侧详情面板渲染 renderDetails */
  onOpenFile?: (node: FMNode) => void;
  /** 右侧详情面板渲染（返回 null 则隐藏面板） */
  renderDetails?: (node: FMNode) => React.ReactNode;
  /** 左侧详情面板渲染（顶部 above tree） */
  renderSidebarTop?: () => React.ReactNode;
  /** Mutations */
  onCreateFolder: (name: string, parentId: string) => void;
  onRename: (id: string, newName: string) => void;
  onDelete: (ids: string[]) => void;
  onMove: (ids: string[], targetParentId: string) => void;
  onUpload?: (files: File[], parentId: string) => void;
  /** 上传按钮的 accept 属性，默认全部 */
  uploadAccept?: string;
  /** 节点列表外右侧 toolbar 额外按钮 */
  toolbarExtra?: React.ReactNode;
  /** 状态栏右侧额外内容 */
  statusBarExtra?: React.ReactNode;
}

type SortKey = 'name' | 'modifiedAt' | 'size' | 'type';
type SortDir = 'asc' | 'desc';
type ViewMode = 'grid' | 'list';

interface ContextMenuState {
  x: number;
  y: number;
  /** 触发右键的目标节点 id；为 null 时是空白处右键（=当前文件夹背景） */
  targetId: string | null;
}

// 文件扩展名 → 图标映射
function getFileIcon(node: FMNode, className = '') {
  if (node.type === 'folder') {
    return <FolderIcon className={cn('text-blue-500', className)} />;
  }
  const ext = (node.ext || node.name.split('.').pop() || '').toLowerCase();
  const iconClass = cn('shrink-0', className);
  if (['xlsx', 'xls', 'csv', 'ods'].includes(ext))
    return <FileSpreadsheet className={cn('text-green-600', iconClass)} />;
  if (['docx', 'doc', 'odt', 'rtf'].includes(ext))
    return <FileText className={cn('text-blue-600', iconClass)} />;
  if (['pptx', 'ppt', 'odp'].includes(ext))
    return <FileType className={cn('text-orange-500', iconClass)} />;
  if (['pdf'].includes(ext))
    return <FileText className={cn('text-red-600', iconClass)} />;
  if (['md', 'markdown', 'txt', 'log', 'json', 'yaml', 'yml', 'xml', 'html'].includes(ext))
    return <FileText className={cn('text-slate-500', iconClass)} />;
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'sql'].includes(ext))
    return <FileCode className={cn('text-purple-600', iconClass)} />;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext))
    return <FileImage className={cn('text-pink-500', iconClass)} />;
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext))
    return <FileArchive className={cn('text-amber-600', iconClass)} />;
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext))
    return <FileVideo className={cn('text-fuchsia-500', iconClass)} />;
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext))
    return <FileAudio className={cn('text-cyan-500', iconClass)} />;
  return <FileText className={cn('text-muted-foreground', iconClass)} />;
}

function formatBytes(b?: number): string {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatTime(ts?: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

export function FileManager({
  nodes,
  rootId,
  title,
  onPathChange,
  onOpenFile,
  renderDetails,
  renderSidebarTop,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
  onUpload,
  uploadAccept,
  toolbarExtra,
  statusBarExtra,
}: FileManagerProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string>(rootId);
  const [history, setHistory] = useState<string[]>([rootId]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [showDetails, setShowDetails] = useState(true);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootId]));
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [clipboard, setClipboard] = useState<{ ids: string[]; mode: 'copy' | 'cut' } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // 可见路径（面包屑）
  const breadcrumbs = useMemo(() => {
    const path: FMNode[] = [];
    let cur = nodes.find((n) => n.id === currentFolderId) || null;
    while (cur) {
      path.unshift(cur);
      cur = cur.parentId ? nodes.find((n) => n.id === cur!.parentId) || null : null;
    }
    return path;
  }, [nodes, currentFolderId]);

  useEffect(() => {
    onPathChange?.(breadcrumbs.map((n) => n.id));
  }, [breadcrumbs, onPathChange]);

  // 当前文件夹下的子节点（应用搜索 + 排序）
  const visibleChildren = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = nodes.filter((n) => {
      if (q) {
        // 搜索：递归搜索整个 root 子树（不限于当前文件夹）
        return (
          n.id !== rootId &&
          (n.name.toLowerCase().includes(q) ||
            (n.tags || []).some((t) => t.toLowerCase().includes(q)))
        );
      }
      return n.parentId === currentFolderId;
    });

    return list.sort((a, b) => {
      // 文件夹始终在前
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'zh');
          break;
        case 'modifiedAt':
          cmp = (a.modifiedAt || 0) - (b.modifiedAt || 0);
          break;
        case 'size':
          cmp = (a.size || 0) - (b.size || 0);
          break;
        case 'type':
          cmp = (a.ext || '').localeCompare(b.ext || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [nodes, currentFolderId, searchQuery, sortKey, sortDir, rootId]);

  // 总数（用于状态栏）
  const totalUnderRoot = useMemo(
    () => nodes.filter((n) => n.id !== rootId).length,
    [nodes, rootId]
  );

  // === 历史导航 ===
  const navigateTo = useCallback(
    (id: string) => {
      if (id === currentFolderId) return;
      setCurrentFolderId(id);
      setSelectedIds(new Set());
      setHistory((prev) => {
        const next = prev.slice(0, historyIdx + 1);
        next.push(id);
        return next;
      });
      setHistoryIdx((i) => i + 1);
      setExpanded((prev) => new Set([...Array.from(prev), id]));
    },
    [currentFolderId, historyIdx]
  );

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    setCurrentFolderId(history[newIdx]);
    setSelectedIds(new Set());
  }, [historyIdx, history]);

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    setCurrentFolderId(history[newIdx]);
    setSelectedIds(new Set());
  }, [historyIdx, history]);

  const goUp = useCallback(() => {
    const cur = nodes.find((n) => n.id === currentFolderId);
    if (cur?.parentId) navigateTo(cur.parentId);
  }, [nodes, currentFolderId, navigateTo]);

  // === 选择 ===
  const handleNodeClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastClickedId) {
      // 区间选择
      const idxA = visibleChildren.findIndex((n) => n.id === lastClickedId);
      const idxB = visibleChildren.findIndex((n) => n.id === id);
      if (idxA !== -1 && idxB !== -1) {
        const [from, to] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
        const range = visibleChildren.slice(from, to + 1).map((n) => n.id);
        setSelectedIds(new Set(range));
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([id]));
    }
    setLastClickedId(id);
  };

  const handleNodeDoubleClick = (node: FMNode) => {
    if (node.type === 'folder') {
      navigateTo(node.id);
    } else {
      onOpenFile?.(node);
    }
  };

  // === 重命名 ===
  const startRename = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setRenamingId(id);
    setRenameDraft(node.name);
    setTimeout(() => renameInputRef.current?.select(), 30);
  };

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) {
      onRename(renamingId, renameDraft.trim());
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  // === 删除 ===
  const handleDelete = (ids: string[]) => {
    if (ids.length === 0) return;
    if (window.confirm(`确定删除选中的 ${ids.length} 项？此操作不可撤销。`)) {
      onDelete(ids);
      setSelectedIds(new Set());
    }
  };

  // === 剪贴板 ===
  const handleCopy = (ids: string[]) => setClipboard({ ids, mode: 'copy' });
  const handleCut = (ids: string[]) => setClipboard({ ids, mode: 'cut' });
  const handlePaste = () => {
    if (!clipboard || clipboard.ids.length === 0) return;
    onMove(clipboard.ids, currentFolderId);
    if (clipboard.mode === 'cut') setClipboard(null);
  };

  // === 键盘 ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (renamingId !== null) return;
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          handleDelete(Array.from(selectedIds));
        }
      } else if (e.key === 'F2') {
        if (selectedIds.size === 1) {
          e.preventDefault();
          startRename(Array.from(selectedIds)[0]);
        }
      } else if (e.key === 'Enter') {
        if (selectedIds.size === 1) {
          const node = nodes.find((n) => n.id === Array.from(selectedIds)[0]);
          if (node) {
            e.preventDefault();
            handleNodeDoubleClick(node);
          }
        }
      } else if (e.key === 'Escape') {
        setSelectedIds(new Set());
        setCtxMenu(null);
      } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setSelectedIds(new Set(visibleChildren.map((n) => n.id)));
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        if (selectedIds.size > 0) handleCopy(Array.from(selectedIds));
      } else if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
        if (selectedIds.size > 0) handleCut(Array.from(selectedIds));
      } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        handlePaste();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        if (visibleChildren.length === 0) return;
        e.preventDefault();
        const curIdx = lastClickedId
          ? visibleChildren.findIndex((n) => n.id === lastClickedId)
          : -1;
        const nextIdx = e.key === 'ArrowDown'
          ? Math.min(visibleChildren.length - 1, curIdx + 1)
          : Math.max(0, curIdx - 1);
        const target = visibleChildren[nextIdx];
        if (target) {
          setSelectedIds(new Set([target.id]));
          setLastClickedId(target.id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, visibleChildren, renamingId, lastClickedId, clipboard, currentFolderId]);

  // === 上下文菜单关闭 ===
  useEffect(() => {
    const close = () => setCtxMenu(null);
    if (ctxMenu) {
      window.addEventListener('click', close);
      window.addEventListener('scroll', close, true);
      return () => {
        window.removeEventListener('click', close);
        window.removeEventListener('scroll', close, true);
      };
    }
  }, [ctxMenu]);

  // === 拖拽：节点之间 + OS 文件 ===
  const handleNodeDragStart = (e: React.DragEvent, id: string) => {
    const ids = selectedIds.has(id) ? Array.from(selectedIds) : [id];
    e.dataTransfer.setData('application/x-fm-ids', JSON.stringify(ids));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFolderDrop = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);

    const fmIds = e.dataTransfer.getData('application/x-fm-ids');
    if (fmIds) {
      try {
        const ids: string[] = JSON.parse(fmIds);
        // 不允许移到自己或自己的子孙
        const safeIds = ids.filter((id) => id !== folderId && !isDescendant(id, folderId));
        if (safeIds.length > 0) onMove(safeIds, folderId);
      } catch {}
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUpload) {
      onUpload(Array.from(e.dataTransfer.files), folderId);
    }
  };

  const isDescendant = (ancestor: string, candidate: string): boolean => {
    let cur = nodes.find((n) => n.id === candidate);
    while (cur?.parentId) {
      if (cur.parentId === ancestor) return true;
      cur = nodes.find((n) => n.id === cur!.parentId);
    }
    return false;
  };

  // === 子组件：树侧栏 ===
  const renderTree = (parentId: string | null): React.ReactNode => {
    const children = nodes
      .filter((n) => n.parentId === parentId && n.type === 'folder')
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
    return children.map((node) => {
      const hasChildren = nodes.some((n) => n.parentId === node.id && n.type === 'folder');
      const isExpanded = expanded.has(node.id);
      const isCurrent = node.id === currentFolderId;
      const isDropTarget = dropTargetId === node.id;
      return (
        <div key={node.id}>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded select-none',
              isCurrent ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted',
              isDropTarget && 'ring-2 ring-primary/50 bg-primary/5'
            )}
            onClick={() => navigateTo(node.id)}
            onDoubleClick={() => {
              if (hasChildren) {
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                });
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropTargetId(node.id);
            }}
            onDragLeave={() => setDropTargetId(null)}
            onDrop={(e) => handleFolderDrop(e, node.id)}
          >
            {hasChildren ? (
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(node.id)) next.delete(node.id);
                    else next.add(node.id);
                    return next;
                  });
                }}
              >
                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            ) : (
              <span className="w-3" />
            )}
            {isExpanded ? <FolderOpen className="h-3.5 w-3.5 text-blue-500" /> : <FolderIcon className="h-3.5 w-3.5 text-blue-500" />}
            <span className="truncate">{node.name}</span>
          </div>
          {isExpanded && hasChildren && (
            <div className="ml-3 border-l pl-1">{renderTree(node.id)}</div>
          )}
        </div>
      );
    });
  };

  // === 上下文菜单 ===
  const renderContextMenu = () => {
    if (!ctxMenu) return null;
    const targetIds = ctxMenu.targetId
      ? selectedIds.has(ctxMenu.targetId)
        ? Array.from(selectedIds)
        : [ctxMenu.targetId]
      : Array.from(selectedIds);
    const isOnNode = !!ctxMenu.targetId;

    return (
      <div
        className="fixed z-50 min-w-[180px] py-1 bg-popover border rounded-md shadow-lg text-sm"
        style={{ left: ctxMenu.x, top: ctxMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {isOnNode && (
          <>
            <MenuItem
              icon={<FolderOpen className="h-3.5 w-3.5" />}
              label="打开"
              onClick={() => {
                const n = nodes.find((x) => x.id === ctxMenu.targetId);
                if (n) handleNodeDoubleClick(n);
                setCtxMenu(null);
              }}
            />
            <MenuItem
              icon={<Edit2 className="h-3.5 w-3.5" />}
              label="重命名"
              shortcut="F2"
              disabled={targetIds.length !== 1}
              onClick={() => {
                if (targetIds.length === 1) startRename(targetIds[0]);
                setCtxMenu(null);
              }}
            />
            <div className="h-px bg-border my-1" />
            <MenuItem
              icon={<Copy className="h-3.5 w-3.5" />}
              label="复制"
              shortcut="Ctrl+C"
              onClick={() => { handleCopy(targetIds); setCtxMenu(null); }}
            />
            <MenuItem
              icon={<Scissors className="h-3.5 w-3.5" />}
              label="剪切"
              shortcut="Ctrl+X"
              onClick={() => { handleCut(targetIds); setCtxMenu(null); }}
            />
          </>
        )}
        <MenuItem
          icon={<Clipboard className="h-3.5 w-3.5" />}
          label="粘贴"
          shortcut="Ctrl+V"
          disabled={!clipboard || clipboard.ids.length === 0}
          onClick={() => { handlePaste(); setCtxMenu(null); }}
        />
        {!isOnNode && (
          <>
            <div className="h-px bg-border my-1" />
            <MenuItem
              icon={<Plus className="h-3.5 w-3.5" />}
              label="新建文件夹"
              onClick={() => { setCreatingFolder(true); setCtxMenu(null); }}
            />
          </>
        )}
        {isOnNode && (
          <>
            <div className="h-px bg-border my-1" />
            <MenuItem
              icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />}
              label="删除"
              shortcut="Del"
              onClick={() => { handleDelete(targetIds); setCtxMenu(null); }}
            />
          </>
        )}
      </div>
    );
  };

  // === 主渲染 ===
  const selectedSingleNode =
    selectedIds.size === 1
      ? nodes.find((n) => n.id === Array.from(selectedIds)[0]) || null
      : null;

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 h-11 border-b shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={historyIdx <= 0}
          onClick={goBack}
          title="后退 (Alt+←)"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={historyIdx >= history.length - 1}
          onClick={goForward}
          title="前进 (Alt+→)"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          disabled={!nodes.find((n) => n.id === currentFolderId)?.parentId}
          onClick={goUp}
          title="上层"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>

        {/* 面包屑 */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 px-2 py-1 text-xs bg-muted/50 rounded border overflow-x-auto">
          {breadcrumbs.map((n, i) => (
            <React.Fragment key={n.id}>
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
              <button
                className={cn(
                  'px-1.5 py-0.5 rounded hover:bg-background whitespace-nowrap',
                  i === breadcrumbs.length - 1 && 'font-semibold'
                )}
                onClick={() => navigateTo(n.id)}
              >
                {n.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* 搜索 */}
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="搜索全部..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>

        {/* 视图切换 */}
        <div className="flex border rounded">
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 rounded-r-none"
            onClick={() => setViewMode('list')}
            title="详情视图"
          >
            <ListIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 rounded-l-none"
            onClick={() => setViewMode('grid')}
            title="图标视图"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* 详情面板切换 */}
        <Button
          variant={showDetails ? 'default' : 'ghost'}
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => setShowDetails((v) => !v)}
          title="详情面板"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>

        {toolbarExtra}
      </div>

      {/* 主内容三栏 */}
      <div className="flex flex-1 min-h-0">
        {/* 左：树 */}
        <div className="w-56 border-r flex flex-col bg-muted/20 shrink-0">
          {renderSidebarTop && <div className="border-b p-2">{renderSidebarTop()}</div>}
          <div className="px-2 py-2 flex gap-1 border-b">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => setCreatingFolder(true)}
            >
              <Plus className="h-3 w-3 mr-1" /> 新建
            </Button>
            {onUpload && (
              <label className="flex-1">
                <input
                  type="file"
                  multiple
                  accept={uploadAccept}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onUpload(Array.from(e.target.files), currentFolderId);
                      e.target.value = '';
                    }
                  }}
                />
                <Button variant="ghost" size="sm" className="w-full h-7 text-xs" asChild>
                  <span><UploadIcon className="h-3 w-3 mr-1" /> 上传</span>
                </Button>
              </label>
            )}
          </div>
          {creatingFolder && (
            <div className="px-2 py-1.5 border-b bg-background">
              <div className="flex gap-1">
                <Input
                  autoFocus
                  className="h-7 text-xs"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (newFolderName.trim()) {
                        onCreateFolder(newFolderName.trim(), currentFolderId);
                      }
                      setCreatingFolder(false);
                      setNewFolderName('');
                    } else if (e.key === 'Escape') {
                      setCreatingFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  placeholder="文件夹名"
                />
              </div>
            </div>
          )}
          <ScrollArea className="flex-1">
            <div className="p-1">
              {/* 根节点 */}
              {(() => {
                const root = nodes.find((n) => n.id === rootId);
                if (!root) return null;
                return (
                  <div
                    className={cn(
                      'flex items-center gap-1 px-2 py-1 text-xs cursor-pointer rounded',
                      currentFolderId === rootId
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => navigateTo(rootId)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTargetId(rootId);
                    }}
                    onDragLeave={() => setDropTargetId(null)}
                    onDrop={(e) => handleFolderDrop(e, rootId)}
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
                    <span className="font-medium">{title || root.name}</span>
                  </div>
                );
              })()}
              {renderTree(rootId)}
            </div>
          </ScrollArea>
        </div>

        {/* 中：内容区 */}
        <div
          className="flex-1 flex flex-col min-w-0"
          onClick={() => setSelectedIds(new Set())}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu({ x: e.clientX, y: e.clientY, targetId: null });
          }}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('Files')) {
              e.preventDefault();
              setDropTargetId(currentFolderId);
            }
          }}
          onDragLeave={() => setDropTargetId(null)}
          onDrop={(e) => handleFolderDrop(e, currentFolderId)}
        >
          {viewMode === 'list' ? (
            <div className="flex-1 overflow-auto">
              {/* 表头 */}
              <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-muted-foreground border-b sticky top-0 bg-background z-10">
                <div className="flex-[3] flex items-center gap-1">
                  <SortHeader label="名称" k="name" sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); }} />
                </div>
                <div className="w-32 hidden md:block">
                  <SortHeader label="修改时间" k="modifiedAt" sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); }} />
                </div>
                <div className="w-20 hidden lg:block">
                  <SortHeader label="类型" k="type" sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); }} />
                </div>
                <div className="w-20 hidden lg:block text-right">
                  <SortHeader label="大小" k="size" sortKey={sortKey} sortDir={sortDir} onSort={(k, d) => { setSortKey(k); setSortDir(d); }} />
                </div>
              </div>
              {/* 行 */}
              {visibleChildren.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-1 text-sm">
                  <FolderOpen className="h-8 w-8 opacity-30" />
                  {searchQuery ? '没有找到匹配项' : '此文件夹为空'}
                </div>
              ) : (
                visibleChildren.map((node) => {
                  const isSelected = selectedIds.has(node.id);
                  const isCut = clipboard?.mode === 'cut' && clipboard.ids.includes(node.id);
                  return (
                    <div
                      key={node.id}
                      draggable
                      onDragStart={(e) => handleNodeDragStart(e, node.id)}
                      onDragOver={(e) => {
                        if (node.type === 'folder') {
                          e.preventDefault();
                          setDropTargetId(node.id);
                        }
                      }}
                      onDragLeave={() => setDropTargetId(null)}
                      onDrop={(e) => node.type === 'folder' && handleFolderDrop(e, node.id)}
                      onClick={(e) => handleNodeClick(node.id, e)}
                      onDoubleClick={() => handleNodeDoubleClick(node)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!selectedIds.has(node.id)) setSelectedIds(new Set([node.id]));
                        setCtxMenu({ x: e.clientX, y: e.clientY, targetId: node.id });
                      }}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 text-sm cursor-default border-b border-transparent select-none',
                        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                        isCut && 'opacity-50',
                        dropTargetId === node.id && node.type === 'folder' && 'ring-2 ring-primary/50 ring-inset'
                      )}
                    >
                      <div className="flex-[3] flex items-center gap-2 min-w-0">
                        {getFileIcon(node, 'h-4 w-4')}
                        {renamingId === node.id ? (
                          <Input
                            ref={renameInputRef}
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') {
                                setRenamingId(null);
                                setRenameDraft('');
                              }
                            }}
                            className="h-6 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="truncate">{node.name}</span>
                        )}
                      </div>
                      <div className="w-32 hidden md:block text-xs text-muted-foreground">
                        {formatTime(node.modifiedAt)}
                      </div>
                      <div className="w-20 hidden lg:block text-xs text-muted-foreground uppercase">
                        {node.type === 'folder' ? '文件夹' : (node.ext || '文件')}
                      </div>
                      <div className="w-20 hidden lg:block text-xs text-muted-foreground text-right">
                        {node.type === 'folder' ? '—' : formatBytes(node.size)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            // Grid View
            <ScrollArea className="flex-1">
              {visibleChildren.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-1 text-sm">
                  <FolderOpen className="h-8 w-8 opacity-30" />
                  {searchQuery ? '没有找到匹配项' : '此文件夹为空'}
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 p-3">
                  {visibleChildren.map((node) => {
                    const isSelected = selectedIds.has(node.id);
                    const isCut = clipboard?.mode === 'cut' && clipboard.ids.includes(node.id);
                    return (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={(e) => handleNodeDragStart(e, node.id)}
                        onDragOver={(e) => {
                          if (node.type === 'folder') {
                            e.preventDefault();
                            setDropTargetId(node.id);
                          }
                        }}
                        onDragLeave={() => setDropTargetId(null)}
                        onDrop={(e) => node.type === 'folder' && handleFolderDrop(e, node.id)}
                        onClick={(e) => handleNodeClick(node.id, e)}
                        onDoubleClick={() => handleNodeDoubleClick(node)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!selectedIds.has(node.id)) setSelectedIds(new Set([node.id]));
                          setCtxMenu({ x: e.clientX, y: e.clientY, targetId: node.id });
                        }}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-2 rounded cursor-default select-none transition-colors',
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                          isCut && 'opacity-50',
                          dropTargetId === node.id && node.type === 'folder' && 'ring-2 ring-primary/50'
                        )}
                      >
                        <div className="h-12 w-12 flex items-center justify-center">
                          {getFileIcon(node, 'h-10 w-10')}
                        </div>
                        {renamingId === node.id ? (
                          <Input
                            ref={renameInputRef}
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename();
                              if (e.key === 'Escape') {
                                setRenamingId(null);
                                setRenameDraft('');
                              }
                            }}
                            className="h-6 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <div className="text-xs text-center break-all line-clamp-2 leading-tight">
                            {node.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* 右：详情 */}
        {showDetails && renderDetails && (
          <div className="w-72 border-l bg-muted/10 shrink-0 overflow-auto">
            {selectedSingleNode ? (
              renderDetails(selectedSingleNode)
            ) : selectedIds.size > 1 ? (
              <div className="p-4 text-sm text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">已选 {selectedIds.size} 项</div>
                <div className="text-xs">使用右键菜单或快捷键批量操作</div>
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground space-y-1">
                <div>选中一项查看详情</div>
                <div className="text-xs mt-2 space-y-0.5">
                  <div>↑↓ 导航 · Enter 打开</div>
                  <div>F2 重命名 · Del 删除</div>
                  <div>Ctrl+A 全选 · Esc 取消</div>
                  <div>Ctrl+C/X/V 复制剪切粘贴</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div className="flex items-center justify-between px-3 h-7 border-t text-[11px] text-muted-foreground bg-muted/30 shrink-0">
        <div>
          {visibleChildren.length} 项
          {selectedIds.size > 0 && ` · 选中 ${selectedIds.size}`}
          {searchQuery && ` · 搜索 "${searchQuery}"（全库 ${totalUnderRoot}）`}
        </div>
        <div className="flex items-center gap-3">
          {clipboard && (
            <span>
              剪贴板：{clipboard.ids.length} 项（{clipboard.mode === 'cut' ? '剪切' : '复制'}）
            </span>
          )}
          {statusBarExtra}
        </div>
      </div>

      {/* 上下文菜单 */}
      {renderContextMenu()}
    </div>
  );
}

// =============================================================
// Helpers
// =============================================================

function MenuItem({
  icon,
  label,
  shortcut,
  disabled,
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1 text-left hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-xs'
      )}
      onClick={onClick}
    >
      <span className="w-4 flex justify-center">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-[10px] text-muted-foreground">{shortcut}</span>}
    </button>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey, dir: SortDir) => void;
}) {
  const isActive = sortKey === k;
  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 hover:text-foreground',
        isActive && 'text-foreground font-semibold'
      )}
      onClick={() => onSort(k, isActive && sortDir === 'asc' ? 'desc' : 'asc')}
    >
      {label}
      {isActive && (
        <span className="text-[9px]">
          {sortDir === 'asc' ? '▲' : '▼'}
        </span>
      )}
      {!isActive && <ArrowUpDown className="h-2.5 w-2.5 opacity-40" />}
    </button>
  );
}
