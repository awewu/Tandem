"use client";

/**
 * D-01: 文档 @ 引用选择器
 *
 * 用法:
 *   <DocumentMentionPicker
 *     open={open}
 *     query={query}
 *     onSelect={(doc) => insertAtCursor(`[[doc:${doc.id}|${doc.title}]]`)}
 *     onClose={() => setOpen(false)}
 *   />
 *
 * 触发: 输入框检测 "@" 后 (或 Cmd+K) 打开 picker, query 跟随后续输入.
 * 选中: 插入 `[[doc:<id>|<title>]]` mention token, 后端 resolveDocumentMentions 会展开.
 */

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

interface DocLite {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
}

interface Props {
  open: boolean;
  query: string;
  onSelect: (doc: DocLite) => void;
  onClose: () => void;
  /** 锚点位置 (input 上沿对应的 x/y), 默认贴左上 */
  anchor?: { x: number; y: number };
}

export function DocumentMentionPicker({ open, query, onSelect, onClose, anchor }: Props) {
  const [docs, setDocs] = useState<DocLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    const url = `/api/documents?limit=8${query ? `&q=${encodeURIComponent(query)}` : ""}`;
    fetch(url, { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        setDocs(data.documents ?? []);
        setActiveIdx(0);
      })
      .catch(() => {
        /* aborted or network — leave previous list */
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, docs.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (docs[activeIdx]) {
          e.preventDefault();
          onSelect(docs[activeIdx]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, docs, activeIdx, onSelect, onClose]);

  if (!open) return null;

  const pos = anchor
    ? { left: anchor.x, top: anchor.y + 4 }
    : { left: 16, bottom: 16 };

  return (
    <div
      className="fixed z-50 w-80 max-h-72 overflow-auto rounded-lg border border-hairline bg-surface-2 shadow-soft-lg"
      style={pos}
      role="listbox"
      aria-label="文档引用选择"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-hairline text-caption text-ink-tertiary">
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <FileText size={12} />
        )}
        <span>
          引用文档 {query ? <span className="font-medium text-ink-secondary">· {query}</span> : null}
        </span>
        <span className="ml-auto text-footnote">↑↓ 选择 · ⏎ 插入 · Esc 关</span>
      </div>
      {docs.length === 0 && !loading && (
        <div className="px-3 py-4 text-caption text-ink-tertiary text-center">
          无匹配文档
        </div>
      )}
      <ul>
        {docs.map((d, i) => (
          <li key={d.id}>
            <button
              type="button"
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => onSelect(d)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-caption transition-colors ${
                i === activeIdx
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-secondary hover:bg-surface-3"
              }`}
            >
              <FileText size={14} className="shrink-0" />
              <span className="flex-1 truncate">{d.title}</span>
              <span className="text-footnote text-ink-tertiary">
                {new Date(d.updatedAt).toLocaleDateString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 输入框 @ 触发器 hook.
 *
 * 用法 (在某个 textarea / input 父组件里):
 *   const { open, query, anchor, onChange, onKeyDown, insertMention } = useMentionTrigger({
 *     value, setValue, inputRef,
 *   });
 *   <textarea value={value} onChange={onChange} onKeyDown={onKeyDown} ref={inputRef} />
 *   <DocumentMentionPicker open={open} query={query} anchor={anchor}
 *     onSelect={insertMention} onClose={() => setOpen(false)} />
 */
export function useMentionTrigger(opts: {
  value: string;
  setValue: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
}) {
  const { value, setValue, inputRef } = opts;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [triggerStart, setTriggerStart] = useState(-1);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | undefined>();

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const next = e.target.value;
    setValue(next);
    const caret = e.target.selectionStart ?? next.length;
    // 倒查从 caret 往回找 @, 直到遇到空白或开头
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(next[i])) {
      if (next[i] === "@") {
        const q = next.slice(i + 1, caret);
        // 限制: @后只允许字母/数字/中文/连字符, 否则视为已结束
        // ASCII + 中日韩区 + 常见符号; 避免 /u 标志兼容旧 target
        if (/^[A-Za-z0-9_\-\.\u4e00-\u9fff\u3040-\u30ff]*$/.test(q)) {
          setTriggerStart(i);
          setQuery(q);
          setOpen(true);
          // 锚点估计 (input bounding rect 左下)
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          setAnchor({ x: rect.left + 8, y: rect.top + rect.height });
          return;
        }
      }
      i--;
    }
    if (open) setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    // picker 内的 ↑↓⏎Esc 都由 picker 自己 window 监听, 这里只防默认
    if (["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(e.key)) {
      // 阻断 textarea 默认行为, 让 picker 接管 (picker 已 preventDefault)
    }
  };

  const insertMention = (doc: DocLite) => {
    if (triggerStart < 0) return setOpen(false);
    const caret = inputRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, triggerStart);
    const after = value.slice(caret);
    const token = `[[doc:${doc.id}|${doc.title}]] `;
    setValue(before + token + after);
    setOpen(false);
    setQuery("");
    setTriggerStart(-1);
    // 把 caret 移到插入末尾
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = before.length + token.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  };

  return { open, query, anchor, onChange, onKeyDown, insertMention, setOpen };
}

/**
 * 通用 textarea + 文档 @ 引用. 三个调用点共用 (IM / 议事 Option D / 1on1 议程).
 *
 * 不强加样式; 默认 `mt-1 w-full rounded border p-2 text-footnote`. 调用方可用 className 覆盖.
 */
export function MentionTextarea(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
}) {
  const { value, onChange, placeholder, rows = 3, disabled, className } = props;
  const ref = useRef<HTMLTextAreaElement>(null);
  const mention = useMentionTrigger({ value, setValue: onChange, inputRef: ref });
  return (
    <>
      <textarea
        ref={ref}
        className={
          className ??
          "mt-1 w-full rounded border p-2 text-footnote focus:outline-none focus:ring-1 focus:ring-brand-300"
        }
        rows={rows}
        value={value}
        onChange={mention.onChange}
        onKeyDown={(e) => {
          if (mention.open && ["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(e.key)) {
            if (e.key === "Enter" || e.key === "Tab") e.preventDefault();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />
      <DocumentMentionPicker
        open={mention.open}
        query={mention.query}
        anchor={mention.anchor}
        onSelect={mention.insertMention}
        onClose={() => mention.setOpen(false)}
      />
    </>
  );
}
