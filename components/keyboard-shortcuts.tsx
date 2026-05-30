'use client';

/**
 * KeyboardShortcuts — `?` 全局快捷键速查表 (Linear-class)
 *
 * 触发: `?` (Shift+/) 任意页面 (text input 内不触发, 避免与正常打字冲突).
 * 关闭: Esc 或点遮罩.
 *
 * 与 CommandPalette 解耦:
 *   - CommandPalette 拥有 Cmd/Ctrl+K (跳页 + 动词)
 *   - 本组件拥有 `?` (展示已定义快捷键 + 操作发现)
 *
 * 后续接入 (V2):
 *   - g h → /  (go home)
 *   - g o → /okr
 *   - g i → /im
 *   - 等 sequence shortcuts (Linear "g + 字母" 双键序列)
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Keyboard, Command, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  items: Array<{
    keys: string[];
    label: string;
    /** 是否未实装 (用 muted 样式 + "soon" 标记) */
    upcoming?: boolean;
  }>;
}

const GROUPS: ShortcutGroup[] = [
  {
    title: '导航',
    items: [
      { keys: ['⌘', 'K'], label: '打开命令面板 (跨页跳转 + 动作)' },
      { keys: ['?'], label: '打开本快捷键速查表' },
      { keys: ['Esc'], label: '关闭弹窗 / 退出当前面板' },
      { keys: ['g', 'h'], label: '跳到首页', upcoming: true },
      { keys: ['g', 'o'], label: '跳到 OKR', upcoming: true },
      { keys: ['g', 'i'], label: '跳到 IM', upcoming: true },
      { keys: ['g', 't'], label: '跳到 Tandem 工作台', upcoming: true },
      { keys: ['g', 'm'], label: '跳到 Memories', upcoming: true },
    ],
  },
  {
    title: '命令面板内',
    items: [
      { keys: ['↑', '↓'], label: '上下移动选择项' },
      { keys: ['↵'], label: '执行选中项' },
      { keys: ['Esc'], label: '关闭面板' },
    ],
  },
  {
    title: '议事 / 决议',
    items: [
      { keys: ['n'], label: '在议事列表新建议事', upcoming: true },
      { keys: ['s'], label: '在议事页签字 (我作为签字人)', upcoming: true },
      { keys: ['1', '2', '3', '4'], label: '在 3+1 选项页选 A/B/C/D 选项', upcoming: true },
    ],
  },
  {
    title: 'IM / 文档',
    items: [
      { keys: ['j', 'k'], label: '消息列表上下浏览', upcoming: true },
      { keys: ['r'], label: '回复当前消息', upcoming: true },
      { keys: ['⌘', 'S'], label: '文档保存 (覆盖默认浏览器存储)', upcoming: true },
    ],
  },
  {
    title: '辅助',
    items: [
      { keys: ['/', ' '], label: '聚焦页面搜索框 (若有)', upcoming: true },
      { keys: ['⌘', '/'], label: '折叠 / 展开侧边栏', upcoming: true },
    ],
  },
];

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded-md bg-surface-2 border border-border text-ink-primary text-footnote font-mono shadow-soft-xs">
      {children}
    </kbd>
  );
}

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ? 触发: Shift + / (US layout). 排除 input/textarea/contenteditable.
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="flex items-center gap-2 text-title-3">
          <Keyboard className="h-5 w-5 text-[rgb(var(--brand-500))]" />
          键盘快捷键
        </DialogTitle>
        <DialogDescription className="text-caption text-ink-tertiary">
          按 <Key>?</Key> 随时打开本表 · 标 <span className="text-ink-tertiary italic">soon</span> 的为后续 PR 接入
        </DialogDescription>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 mt-2 max-h-[60vh] overflow-y-auto pr-2">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-caption font-semibold text-ink-secondary uppercase tracking-wider mb-2">
                {g.title}
              </div>
              <ul className="space-y-1.5">
                {g.items.map((it, idx) => (
                  <li
                    key={idx}
                    className={`flex items-center justify-between gap-3 py-1 ${
                      it.upcoming ? 'opacity-60' : ''
                    }`}
                  >
                    <span className="text-caption text-ink-primary truncate">
                      {it.label}
                      {it.upcoming && (
                        <span className="ml-2 text-[10px] text-ink-tertiary italic">
                          soon
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      {it.keys.map((k, i) => (
                        <Key key={i}>{renderKey(k)}</Key>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border text-caption text-ink-tertiary flex items-center justify-between">
          <span>设计参考: Linear / Raycast · 后续按 PR 节奏点亮 soon 项</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1 text-ink-secondary hover:text-ink-primary"
          >
            关闭 <kbd className="ml-0.5 text-[10px]">Esc</kbd>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** ⌘ / ↑ / ↓ / ↵ 等符号渲染. 字母直接大写显示. */
function renderKey(k: string): React.ReactNode {
  if (k === '⌘') return <Command className="h-3 w-3" aria-label="Command" />;
  if (k === '↑') return <ArrowUp className="h-3 w-3" aria-label="ArrowUp" />;
  if (k === '↓') return <ArrowDown className="h-3 w-3" aria-label="ArrowDown" />;
  if (k === '↵') return <CornerDownLeft className="h-3 w-3" aria-label="Enter" />;
  if (k === 'Esc') return <span className="text-[10px]">Esc</span>;
  if (k === 'Tab') return <span className="text-[10px]">Tab</span>;
  if (k === ' ') return <span className="text-[10px]">Space</span>;
  // 字母 / 数字 / 标点 单字符
  return <span className="text-[11px]">{k}</span>;
}

