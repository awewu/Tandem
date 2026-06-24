'use client';

/**
 * 移动端下拉刷新 (PWA standalone 下没有浏览器原生下拉刷新, 这是关键肌肉记忆补齐)
 *
 * 架构:
 *   - 移动端真正滚动的是 AppShell 的 <main id="tandem-shell-main" overflow-y-auto>;
 *     MobilePullToRefresh 监听它的触摸, 在「已滚到顶 + 继续下拉」时显示指示器, 松手过阈值触发刷新.
 *   - 页面通过 usePullToRefreshAction(fn) 注册自己的 reload (如 mail 的 loadEmails);
 *     未注册时回退 router.refresh() (刷新 Server Components).
 *   - 全局 overscroll-behavior-y:none 已抑制原生橡皮筋, 故无需 preventDefault, 手势干净.
 *   - 仅手机视口生效 (matchMedia max-width:767px), 桌面完全 inert.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ArrowDown } from 'lucide-react';

type RefreshFn = () => void | Promise<void>;

const PullToRefreshContext = createContext<{
  register: (fn: RefreshFn | null) => void;
} | null>(null);

export function PullToRefreshProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<RefreshFn | null>(null);
  const register = useCallback((fn: RefreshFn | null) => {
    handlerRef.current = fn;
  }, []);
  return (
    <PullToRefreshContext.Provider value={{ register }}>
      {children}
      <MobilePullToRefresh handlerRef={handlerRef} />
    </PullToRefreshContext.Provider>
  );
}

/** 页面注册自己的刷新逻辑 (会在卸载时自动清除). */
export function usePullToRefreshAction(fn: RefreshFn): void {
  const ctx = useContext(PullToRefreshContext);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (!ctx) return;
    ctx.register(() => fnRef.current());
    return () => ctx.register(null);
  }, [ctx]);
}

const THRESHOLD = 70;
const MAX_PULL = 110;

function MobilePullToRefresh({ handlerRef }: { handlerRef: React.MutableRefObject<RefreshFn | null> }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    if (!mq.matches) return; // 仅手机视口

    const el = document.getElementById('tandem-shell-main');
    if (!el) return;

    let startY = 0;
    let pulling = false;

    const setPullValue = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };

    // 找触摸起点到 main 之间「最近的可滚动祖先」. 若不是 main 本身 (即手势落在
    // 内层滚动容器, 如 IM 消息线程), 则不接管下拉刷新, 避免误触发.
    const scrollableAncestor = (node: Element | null): Element => {
      let n: Element | null = node;
      while (n && n !== el) {
        const oy = getComputedStyle(n).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
        n = n.parentElement;
      }
      return el;
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current) return;
      if (scrollableAncestor(e.target as Element) !== el) {
        pulling = false;
        return;
      }
      if (el.scrollTop > 0) {
        pulling = false;
        return;
      }
      startY = e.touches[0]?.clientY ?? 0;
      pulling = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling || refreshingRef.current) return;
      const y = e.touches[0]?.clientY ?? startY;
      const dy = y - startY;
      if (dy <= 0 || el.scrollTop > 0) {
        if (pullRef.current !== 0) setPullValue(0);
        return;
      }
      // 阻尼: 越拉越沉
      setPullValue(Math.min(dy * 0.5, MAX_PULL));
    };

    const onEnd = async () => {
      if (!pulling) return;
      pulling = false;
      if (pullRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullValue(THRESHOLD);
        try {
          const fn = handlerRef.current;
          if (fn) await fn();
          else router.refresh();
        } catch {
          /* ignore */
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullValue(0);
        }
      } else {
        setPullValue(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [handlerRef, router]);

  if (pull <= 0 && !refreshing) return null;

  const progress = Math.min(pull / THRESHOLD, 1);
  const ready = pull >= THRESHOLD;

  return (
    <div
      aria-hidden
      className="md:hidden fixed inset-x-0 z-[45] flex justify-center pointer-events-none"
      style={{ top: `calc(env(safe-area-inset-top, 0px) + ${Math.max(pull - 28, 8)}px)` }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 shadow-soft-lg">
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
        ) : (
          <ArrowDown
            className={`h-4 w-4 text-ink-secondary transition-transform ${ready ? 'rotate-180 text-brand-600' : ''}`}
            style={{ opacity: 0.4 + progress * 0.6 }}
          />
        )}
      </div>
    </div>
  );
}
