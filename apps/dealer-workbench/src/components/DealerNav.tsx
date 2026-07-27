'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut, UserRound } from 'lucide-react';
import { clearToken } from '@rhautt/shared-auth';
import { WORKBENCH_NAV, navItemForPath } from '../lib/workbench-navigation';
import type { WorkbenchChild } from '../lib/workbench-navigation';
import { auth, brandSites } from '../lib/api';

type BrandSiteNavItem = {
  id: string;
  code: string;
  nameCn: string;
  nameEn: string;
  sortOrder: number;
  status: string;
  deletedAt: string | null;
};

type AccountProfile = {
  name?: string;
  email?: string;
  phone?: string;
  identifier?: string;
  role?: string;
};

const ROLE_LABEL: Record<string, string> = {
  brand_admin: '品牌管理员',
  platform_admin: '平台超管',
  hq_admin: '总部管理员',
  regional_manager: '区域经理',
  dealer_admin: '经销商管理员',
  store_manager: '门店经理',
  designer: '设计师',
  sales: '销售',
  engineer: '工程师',
  installer: '安装工',
  customer: '客户',
};

function readCachedProfile(): AccountProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem('user');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

export default function DealerNav() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [siteNavItems, setSiteNavItems] = useState<BrandSiteNavItem[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const activeItem = navItemForPath(path);
  const currentHref = `${path || ''}${search}`;

  useEffect(() => {
    const stored = localStorage.getItem('rhautt-subnav-collapsed');
    if (stored) setCollapsed(stored === 'true');
    setSearch(window.location.search);
  }, [path]);

  useEffect(() => {
    const cached = readCachedProfile();
    if (cached) setProfile(cached);

    let cancelled = false;
    auth.me()
      .then((me) => {
        if (cancelled) return;
        setProfile(me);
        localStorage.setItem('user', JSON.stringify(me));
      })
      .catch(() => {
        if (!cancelled && !cached) setProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as Element | null)?.closest('.account-menu-wrap')) setAccountOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [accountOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadBrandSiteNav() {
      try {
        const result = await brandSites.list();
        if (cancelled) return;
        const items = ((result.items || []) as BrandSiteNavItem[])
          .filter((site) => site.status === 'active' && !site.deletedAt)
          .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
        setSiteNavItems(items);
      } catch {
        if (!cancelled) setSiteNavItems([]);
      }
    }

    if (activeItem.key !== 'brand-sites') {
      setSiteNavItems([]);
      return;
    }

    loadBrandSiteNav();
    window.addEventListener('rhautt-brand-sites-updated', loadBrandSiteNav);
    return () => {
      cancelled = true;
      window.removeEventListener('rhautt-brand-sites-updated', loadBrandSiteNav);
    };
  }, [activeItem.key]);

  if (path === '/') return null;

  const activeChildren: WorkbenchChild[] =
    activeItem.key === 'brand-sites'
      ? [
          activeItem.children[0],
          ...(siteNavItems.length
            ? siteNavItems.map((site) => ({
                key: `site-${site.code}`,
                label: `${site.nameCn || site.nameEn} ${site.nameEn || ''}`.trim(),
                href: `/comfort/sites/${encodeURIComponent(site.code)}`,
                icon: activeItem.children[0].icon,
              }))
            : activeItem.children.slice(1, 4)),
          ...activeItem.children.slice(4),
        ]
      : activeItem.children;

  function toggleSubnav() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem('rhautt-subnav-collapsed', String(next));
      return next;
    });
  }

  function isChildSelected(href: string) {
    const childPath = href.split('?')[0];
    if (childPath === '/products' && path === '/products') {
      const childModule = new URLSearchParams(href.split('?')[1] || '').get('module') || 'catalog';
      return (new URLSearchParams(search).get('module') || 'catalog') === childModule;
    }
    if (href.includes('?')) return currentHref === href;
    if (path === childPath) return true;
    if (!path?.startsWith(`${childPath}/`)) return false;
    return !activeChildren.some((child) => {
      const candidatePath = child.href.split('?')[0];
      return candidatePath !== childPath && (path === candidatePath || path.startsWith(`${candidatePath}/`));
    });
  }

  function rememberChildSearch(href: string) {
    if (typeof window === 'undefined') return;
    setSearch(new URL(href, window.location.href).search);
  }

  async function logout() {
    await auth.logout().catch(() => {});
    await fetch('/api/session/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    clearToken();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  }

  const accountName = profile?.name || '未命名账户';
  const accountContact = profile?.email || profile?.phone || profile?.identifier || '未绑定联系方式';
  const roleLabel = (profile?.role && ROLE_LABEL[profile.role]) || profile?.role || '未分配角色';
  const initials = accountName.trim().slice(0, 1).toUpperCase() || 'U';

  return (
    <>
      <aside className="sidebar" style={{ alignItems: 'center' }}>
        <div style={{ height: 3, width: '100%', background: 'var(--brand)', flexShrink: 0 }} />
        <div style={{ margin: '12px auto 10px', width: 44, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/images/rysnova-logo.jpg" alt="Rysnova" style={{ width: 44, height: 'auto', objectFit: 'contain', filter: 'brightness(1.15) contrast(1.05)' }} />
        </div>
        <div style={{ height: 1, width: 32, background: 'rgba(255,255,255,0.08)', margin: '0 auto 8px' }} />

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '4px 0' }} aria-label="营销控制台主导航">
          {WORKBENCH_NAV.map((item, index) => {
            const active = item.key === activeItem.key;
            const Icon = item.icon;
            const previous = WORKBENCH_NAV[index - 1];
            return (
              <div key={item.key}>
                {previous && previous.group !== item.group && <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 12px' }} />}
                <Link
                  href={item.href}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 3,
                    width: 56,
                    minHeight: 52,
                    borderRadius: 8,
                    margin: '2px auto',
                    color: active ? '#fff' : 'rgba(255,255,255,0.52)',
                    background: active ? 'rgba(228,0,43,0.22)' : 'transparent',
                    transition: 'all 0.12s',
                    textDecoration: 'none',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {active && <span style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 3, height: 20, borderRadius: 2, background: 'var(--brand)' }} />}
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                  <span style={{ maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, lineHeight: 1.1, fontWeight: active ? 700 : 500 }}>
                    {item.shortLabel}
                  </span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="account-menu-wrap">
          {accountOpen && (
            <div className="account-menu" role="menu" aria-label="账户菜单">
              <div className="account-menu-profile">
                <div className="account-menu-name">{accountName}</div>
                <div className="account-menu-contact">{accountContact}</div>
                <div className="account-menu-role">{roleLabel}</div>
              </div>
              <div className="account-menu-actions">
                <button type="button" role="menuitem" onClick={logout}>
                  <LogOut size={15} />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="account-trigger"
            aria-label="展开账户菜单"
            aria-expanded={accountOpen}
            onClick={(event) => {
              event.stopPropagation();
              setAccountOpen((open) => !open);
            }}
          >
            {profile ? initials : <UserRound size={17} />}
          </button>
          <div className="account-version">v2</div>
        </div>
      </aside>

      <aside className={`workbench-subnav${collapsed ? ' is-collapsed' : ''}`}>
        <button
          type="button"
          aria-label={collapsed ? '展开二级菜单' : '折叠二级菜单'}
          title={collapsed ? '展开二级菜单' : '折叠二级菜单'}
          className="workbench-subnav-toggle"
          onClick={toggleSubnav}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        {!collapsed && (
          <>
            <div className="workbench-subnav-head">
              <p>Marketing</p>
              <h2>{activeItem.shortLabel}</h2>
              <span>{activeItem.desc}</span>
            </div>
            <nav className="workbench-subnav-list" aria-label={`${activeItem.label}二级菜单`}>
              {activeChildren.map((child) => {
                const ChildIcon = child.icon;
                const selected = isChildSelected(child.href);
                return (
                  <Link key={child.key} href={child.href} title={child.label} className={selected ? 'is-active' : undefined} onClick={() => rememberChildSearch(child.href)}>
                    <ChildIcon size={16} strokeWidth={selected ? 2.3 : 1.8} />
                    <span>{child.label}</span>
                    {selected && <ChevronRight size={14} />}
                  </Link>
                );
              })}
            </nav>
          </>
        )}

        {collapsed && (
          <nav className="workbench-subnav-icon-list" aria-label={`${activeItem.label}折叠菜单`}>
            {activeChildren.map((child) => {
              const ChildIcon = child.icon;
              const selected = isChildSelected(child.href);
              return (
                <Link key={child.key} href={child.href} title={child.label} aria-label={child.label} className={selected ? 'is-active' : undefined} onClick={() => rememberChildSearch(child.href)}>
                  <ChildIcon size={17} strokeWidth={selected ? 2.4 : 1.8} />
                </Link>
              );
            })}
          </nav>
        )}
      </aside>

      <nav className="mobile-nav" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', padding: '6px 0', gridTemplateColumns: `repeat(${WORKBENCH_NAV.length}, minmax(58px, 1fr))`, overflowX: 'auto' }} aria-label="移动端营销导航">
        {WORKBENCH_NAV.map((item) => {
          const active = item.key === activeItem.key;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0', fontSize: 10, fontWeight: active ? 700 : 500, color: active ? 'var(--brand)' : 'var(--t-tertiary)', textDecoration: 'none' }}>
              <Icon size={18} />
              {item.shortLabel}
            </Link>
          );
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { display: none !important; }
          .workbench-subnav { display: none !important; }
          .mobile-nav { display: grid !important; }
        }
        .sidebar nav a:hover {
          background: rgba(255,255,255,0.08) !important;
          color: rgba(255,255,255,0.85) !important;
        }
        .sidebar nav a[aria-current="page"]:hover {
          background: rgba(228,0,43,0.26) !important;
          color: #fff !important;
        }
      `}</style>
    </>
  );
}
