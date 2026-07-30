'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut, UserCog, UserRound } from 'lucide-react';
import { clearToken } from '@rhautt/shared-auth';
import { WORKBENCH_NAV, canSeeNavItem, navItemForPath } from '../lib/workbench-navigation';
import type { WorkbenchChild } from '../lib/workbench-navigation';
import { adminUsers, auth, brandSites } from '../lib/api';

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
  id?: string;
  userId?: string;
  tenantId?: string;
  name?: string;
  email?: string;
  phone?: string;
  identifier?: string;
  identifierMasked?: string;
  identifierKind?: 'email' | 'phone' | 'unknown';
  role?: string;
  roles?: string[];
  permissions?: string[];
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

function cleanAccountValue(value?: string | null) {
  const text = String(value || '').trim();
  if (!text || text === '***') return '';
  return text;
}

function isRoleLikeAccountName(value?: string | null) {
  const text = cleanAccountValue(value);
  if (!text) return false;
  const normalized = text.replace(/\s+/g, '').toLowerCase();
  const roleNames = new Set([
    ...Object.keys(ROLE_LABEL).map((role) => role.toLowerCase()),
    ...Object.values(ROLE_LABEL).map((role) => role.replace(/\s+/g, '').toLowerCase()),
    '超级管理员',
    '平台超级管理员',
    '系统管理员',
  ]);
  return roleNames.has(normalized);
}

function mergeProfile(base: AccountProfile | null, next: AccountProfile): AccountProfile {
  const nextName = cleanAccountValue(next.name);
  const baseName = cleanAccountValue(base?.name);
  return {
    ...(base || {}),
    ...next,
    name: (!isRoleLikeAccountName(nextName) && nextName) || (!isRoleLikeAccountName(baseName) && baseName) || undefined,
    email: cleanAccountValue(next.email) || cleanAccountValue(base?.email) || undefined,
    phone: cleanAccountValue(next.phone) || cleanAccountValue(base?.phone) || undefined,
    identifier: cleanAccountValue(next.identifier) || cleanAccountValue(base?.identifier) || undefined,
    identifierMasked: cleanAccountValue(next.identifierMasked) || cleanAccountValue(base?.identifierMasked) || undefined,
  };
}

function accountInitials(profile: AccountProfile | null) {
  const source =
    cleanAccountValue(profile?.name) ||
    cleanAccountValue(profile?.identifierMasked) ||
    cleanAccountValue(profile?.phone) ||
    cleanAccountValue(profile?.email) ||
    cleanAccountValue(profile?.identifier);
  if (!source) return '账';
  if (/^\d+$/.test(source)) return source.slice(-1);
  const compact = source.includes('@') ? source.split('@')[0] : source;
  return compact.slice(0, 1).toUpperCase();
}

function canReadAccountDirectory(profile: AccountProfile) {
  const permissions = profile.permissions || [];
  return profile.role === 'platform_admin' || profile.role === 'hq_admin' || permissions.includes('*') || permissions.includes('admin.users.read');
}

async function enrichProfileFromAccountDirectory(profile: AccountProfile): Promise<AccountProfile> {
  if (cleanAccountValue(profile.name) && !isRoleLikeAccountName(profile.name)) return profile;
  if (!canReadAccountDirectory(profile)) return profile;
  const currentId = cleanAccountValue(profile.id || profile.userId);
  if (!currentId) return profile;

  const result = await adminUsers.list();
  const users = Array.isArray(result?.users) ? result.users : [];
  const currentUser = users.find((user: AccountProfile) => cleanAccountValue(user.id || user.userId) === currentId);
  if (!currentUser) return profile;

  return mergeProfile(profile, {
    id: currentUser.id,
    userId: currentUser.userId,
    name: currentUser.name,
    role: currentUser.role || profile.role,
    identifierMasked: currentUser.identifierMasked || profile.identifierMasked,
    identifierKind: currentUser.identifierKind || profile.identifierKind,
  });
}

export default function DealerNav() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [siteNavItems, setSiteNavItems] = useState<BrandSiteNavItem[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const activeItem = navItemForPath(path);
  const visibleNav = WORKBENCH_NAV.filter((item) => canSeeNavItem(item, profile?.permissions || [], profile?.role));
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
      .then(async (me) => {
        if (cancelled) return;
        const fromMe = mergeProfile(cached, me);
        const enriched = await enrichProfileFromAccountDirectory(fromMe).catch(() => fromMe);
        if (cancelled) return;
        setProfile((current) => {
          const merged = mergeProfile(current || cached, enriched);
          localStorage.setItem('user', JSON.stringify(merged));
          return merged;
        });
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
    if (childPath === '/accounts' && path === '/accounts') {
      const childModule = new URLSearchParams(href.split('?')[1] || '').get('module') || 'users';
      return (new URLSearchParams(search).get('module') || 'users') === childModule;
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

  const loginIdentifier =
    cleanAccountValue(profile?.identifierMasked) ||
    cleanAccountValue(profile?.email) ||
    cleanAccountValue(profile?.phone) ||
    cleanAccountValue(profile?.identifier);
  const profileName = cleanAccountValue(profile?.name);
  const displayAccountName = profileName || (loginIdentifier ? `账号 ${loginIdentifier}` : '账号信息待完善');
  const displayAccountContact = loginIdentifier ? `登录账号：${loginIdentifier}` : '登录账号：未绑定手机号/邮箱';
  const displayContactStatus = loginIdentifier
    ? `联系方式：${profile?.identifierKind === 'email' ? '邮箱已绑定' : profile?.identifierKind === 'phone' ? '手机号已绑定' : '已绑定'}`
    : '联系方式：待绑定';
  const displayRoleLabel = (profile?.role && ROLE_LABEL[profile.role]) || profile?.role || '未分配角色';
  const displayInitials = accountInitials(profile);

  return (
    <>
      <aside className="sidebar" style={{ alignItems: 'center' }}>
        <div style={{ height: 3, width: '100%', background: 'var(--brand)', flexShrink: 0 }} />
        <div style={{ margin: '12px auto 10px', width: 44, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src="/images/rysnova-logo.jpg" alt="Rysnova" style={{ width: 44, height: 'auto', objectFit: 'contain', filter: 'brightness(1.15) contrast(1.05)' }} />
        </div>
        <div style={{ height: 1, width: 32, background: 'rgba(255,255,255,0.08)', margin: '0 auto 8px' }} />

        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '4px 0' }} aria-label="营销控制台主导航">
          {visibleNav.map((item, index) => {
            const active = item.key === activeItem.key;
            const Icon = item.icon;
            const previous = visibleNav[index - 1];
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
                <div className="account-menu-name">{displayAccountName}</div>
                <div className="account-menu-contact">{displayAccountContact}</div>
                <div className="account-menu-contact">{displayContactStatus}</div>
                <div className="account-menu-role">当前角色：{displayRoleLabel}</div>
              </div>
              <div className="account-menu-actions">
                <Link href="/accounts" role="menuitem" onClick={() => setAccountOpen(false)}>
                  <UserCog size={15} />
                  <span>账号管理</span>
                </Link>
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
            {profile ? displayInitials : <UserRound size={17} />}
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

        <div className="workbench-subnav-expanded" aria-hidden={collapsed}>
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
                <Link key={child.key} href={child.href} title={child.label} className={selected ? 'is-active' : undefined} tabIndex={collapsed ? -1 : undefined} onClick={() => rememberChildSearch(child.href)}>
                  <ChildIcon size={16} strokeWidth={selected ? 2.3 : 1.8} />
                  <span>{child.label}</span>
                  {selected && <ChevronRight size={14} />}
                </Link>
              );
            })}
          </nav>
        </div>

        <nav className="workbench-subnav-icon-list" aria-label={`${activeItem.label}折叠菜单`} aria-hidden={!collapsed}>
          {activeChildren.map((child) => {
            const ChildIcon = child.icon;
            const selected = isChildSelected(child.href);
            return (
              <Link key={child.key} href={child.href} title={child.label} aria-label={child.label} className={selected ? 'is-active' : undefined} tabIndex={!collapsed ? -1 : undefined} onClick={() => rememberChildSearch(child.href)}>
                <ChildIcon size={17} strokeWidth={selected ? 2.4 : 1.8} />
              </Link>
            );
          })}
        </nav>
      </aside>

      <nav className="mobile-nav" style={{ display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', padding: '6px 0', gridTemplateColumns: `repeat(${Math.max(visibleNav.length, 1)}, minmax(58px, 1fr))`, overflowX: 'auto' }} aria-label="移动端营销导航">
        {visibleNav.map((item) => {
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
