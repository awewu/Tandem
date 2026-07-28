'use client';

/**
 * BossAiFab · 全局浮动按钮 ("问 Tandem")
 *
 * § 灵魂入口 · 右下角固定 · 全应用可见 · 含 mobile
 * 快捷键: ⌘/Ctrl + J
 */

import { Sparkles } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useBossAi } from './use-boss-ai';

const POSITION_STORAGE_KEY = 'tandem:boss-ai-fab-y';

function verticalBounds(buttonHeight: number) {
  const rootStyles = getComputedStyle(document.documentElement);
  const mobile = window.innerWidth < 768;
  const topInset = Number.parseFloat(rootStyles.getPropertyValue('--capacitor-effective-top-inset')) || 0;
  const bottomInset = Number.parseFloat(rootStyles.getPropertyValue('--capacitor-safe-area-bottom')) || 0;
  const min = mobile ? 56 + topInset : 12;
  const bottomClearance = mobile ? 68 + bottomInset : 12;
  return { min, max: Math.max(min, window.innerHeight - buttonHeight - bottomClearance) };
}

function clampTop(top: number, buttonHeight: number) {
  const { min, max } = verticalBounds(buttonHeight);
  return Math.min(max, Math.max(min, top));
}

export function BossAiFab() {
  const { isOpen, toggle } = useBossAi();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startTop: number;
    currentTop: number;
    buttonHeight: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [top, setTop] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // ⌘/Ctrl + J 唤起
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    function restorePosition() {
      const height = button?.getBoundingClientRect().height ?? 48;
      const savedRatio = Number.parseFloat(window.localStorage.getItem(POSITION_STORAGE_KEY) ?? '');
      if (!Number.isFinite(savedRatio)) return;
      const { min, max } = verticalBounds(height);
      setTop(min + Math.min(1, Math.max(0, savedRatio)) * (max - min));
    }

    function keepInsideViewport() {
      const height = buttonRef.current?.getBoundingClientRect().height ?? 48;
      setTop((current) => current == null ? current : clampTop(current, height));
    }

    restorePosition();
    window.addEventListener('resize', keepInsideViewport);
    return () => window.removeEventListener('resize', keepInsideViewport);
  }, []);

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startTop: rect.top,
      currentTop: rect.top,
      buttonHeight: rect.height,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const delta = e.clientY - drag.startY;
    if (Math.abs(delta) >= 4) drag.moved = true;
    drag.currentTop = clampTop(drag.startTop + delta, drag.buttonHeight);
    setTop(drag.currentTop);
  }

  function finishDrag(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag.moved) {
      suppressClickRef.current = true;
      const { min, max } = verticalBounds(drag.buttonHeight);
      const ratio = max === min ? 0 : (drag.currentTop - min) / (max - min);
      window.localStorage.setItem(POSITION_STORAGE_KEY, String(Math.min(1, Math.max(0, ratio))));
    }
    dragRef.current = null;
    setDragging(false);
  }

  function handleClick(e: ReactMouseEvent<HTMLButtonElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.preventDefault();
      return;
    }
    toggle();
  }

  if (isOpen) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      aria-label="打开 Tandem AI · 中央智囊"
      aria-pressed={false}
      title="Tandem AI (⌘J) · 可上下拖动"
      className={
        // 桌面: 右下 24px · mobile: 右下 80px (避开底部 tab bar 56px + 间距)
        'boss-ai-fab fixed right-5 bottom-5 z-[60] flex items-center gap-2 ' +
        'md:bottom-6 ' +
        // 桌面胶囊形, mobile 也保持胶囊 (但稍小)
        'h-12 rounded-full px-4 ' +
        // 颜色 · 用 brand-500 (企业红) + 在 mobile 上稍微抬高避开 tab bar (pb-[56px] on main, fab 不在 main 内, 是 fixed)
        'bg-[rgb(var(--brand-500))] text-white shadow-soft-lg ' +
        'touch-none select-none cursor-grab hover:bg-[rgb(var(--brand-600))] active:cursor-grabbing active:scale-95 transition-transform duration-fast ' +
        // mobile tab bar 56px + 间距 24px = 80
        'bottom-[80px] md:bottom-6 ' +
        'surface-interactive'
      }
      style={{
        paddingRight: '14px',
        top: top ?? undefined,
        bottom: top == null ? undefined : 'auto',
        transition: dragging ? 'none' : undefined,
      }}
    >
      <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
      <span className="hidden md:inline text-headline font-semibold whitespace-nowrap">问 Tandem</span>
      <span className="hidden md:inline text-footnote font-mono opacity-70 ml-1">⌘J</span>
    </button>
  );
}
