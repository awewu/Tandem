'use client';

/**
 * AppShell · 按路由决定是否套企业内部 chrome
 *
 * 两层用户模型 (MANIFESTO):
 *   - 内部路由: 完整三栏 (AppRail + SubSidebar + main) + 移动端顶/底栏 + HubTabs +
 *     命令面板 / 快捷键 / 问老板 (中央 AI) — 企业协作驾驶舱。
 *   - 独立 app 路由 (/shouchao, /hub): 去掉一切内部 chrome, 只渲染纯内容,
 *     呈现"独立产品"体感 (PWA standalone 安装后无浏览器栏, 也无 Tandem 内部导航)。
 *     搭子手抄 = 员工个人资产 / 外部用户旗舰; /hub = 外部用户落地页。
 */

import { usePathname } from 'next/navigation';
import AppRail from '@/components/app-rail';
import SubSidebar from '@/components/sub-sidebar';
import HubTabs from '@/components/hub-tabs';
import { MobileTopBar } from '@/components/mobile-top-bar';
import { MobileTabBar } from '@/components/mobile-tab-bar';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { BossAiMount } from '@/components/boss-ai';
import { ApiHydrator } from '@/components/api-hydrator';
import { ErrorBoundary } from '@/components/error-boundary';
import { PullToRefreshProvider } from '@/components/pull-to-refresh';

/** 这些前缀及其子路由不套内部 chrome, 作为独立 app 全屏呈现 */
const STANDALONE_PREFIXES = ['/shouchao', '/hub'];

/** 鉴权路由 (登录 / 注册) 全屏呈现, 未登录时不应出现任何内部导航 */
const AUTH_PREFIXES = ['/login', '/register'];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isStandalone(pathname: string): boolean {
  return matchesPrefix(pathname, STANDALONE_PREFIXES);
}

function isAuthRoute(pathname: string): boolean {
  return matchesPrefix(pathname, AUTH_PREFIXES);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';

  // 独立 app / 鉴权页: 无内部导航 / 无问老板 / 无命令面板, 全屏纯内容
  if (isStandalone(pathname) || isAuthRoute(pathname)) {
    return (
      <main
        id="tandem-shell-main"
        className="flex h-screen w-screen flex-col overflow-y-auto bg-[rgb(var(--surface-1))]"
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    );
  }

  // 内部协作驾驶舱: 完整 chrome
  return (
    <PullToRefreshProvider>
      <ApiHydrator />
      {/*
        Responsive shell:
        - md+ : 桌面三栏 (AppRail + SubSidebar + main)
        - <md : 顶栏 + 全屏 main + 底部 tab bar (Kimi/GPT 移动端风格)
               AppRail / SubSidebar 在 mobile 视口下隐藏.
      */}
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-[rgb(var(--surface-2))] md:flex-row">
        {/* Desktop only */}
        <div className="hidden md:contents">
          <AppRail />
          <SubSidebar />
        </div>

        {/* Mobile only top bar */}
        <MobileTopBar />

        <main
          id="tandem-shell-main"
          className="flex flex-1 flex-col overflow-y-auto bg-[rgb(var(--surface-1))] pb-[56px] md:overflow-hidden md:pb-0"
        >
          <HubTabs />
          <div className="min-h-0 flex-1 md:overflow-y-auto">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>

        {/* Mobile only bottom tab bar */}
        <MobileTabBar />
      </div>
      <CommandPalette />
      <KeyboardShortcuts />
      {/* §灵魂入口 · Tandem AI = 老板的搭子 · 全应用浮动问老板 · ⌘J */}
      <BossAiMount />
    </PullToRefreshProvider>
  );
}
