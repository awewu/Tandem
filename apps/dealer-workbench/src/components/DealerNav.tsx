'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight, Package, Megaphone, UsersRound } from 'lucide-react';
import { WORKBENCH_NAV, navItemForPath } from '../lib/workbench-navigation';
import { brandSites } from '../lib/api';

const MOBILE = [
  { href: '/products', label: '产品', icon: Package },
  { href: '/brand', label: '品牌', icon: Megaphone },
  { href: '/accounts', label: '账号', icon: UsersRound },
];

type BrandSiteNavItem = {
  id: string;
  code: string;
  nameCn: string;
  nameEn: string;
  sortOrder: number;
  status: string;
  deletedAt: string | null;
};

export default function DealerNav() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [siteNavItems, setSiteNavItems] = useState<BrandSiteNavItem[]>([]);
  const activeItem = navItemForPath(path);
  const currentHref = `${path || ''}${search}`;

  useEffect(() => {
    const stored = localStorage.getItem('rhautt-subnav-collapsed');
    if (stored) setCollapsed(stored === 'true');
    setSearch(window.location.search);
  }, []);

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

  if (path === '/' || path === '/mobile' || path === '/hub') return null;

  function toggleSubnav() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem('rhautt-subnav-collapsed', String(next));
      return next;
    });
  }

  function isChildSelected(href: string) {
    const childPath = href.split('?')[0];
    if (href === '/products?module=catalog' && path === '/products' && !search) return true;
    return href.includes('?') ? currentHref === href : path === childPath;
  }

  const activeChildren =
    activeItem.key === 'brand-sites'
      ? [
          activeItem.children[0],
          ...siteNavItems.map((site) => ({
            key: `site-${site.code}`,
            label: `${site.nameCn || site.nameEn} ${site.nameEn || ''}`.trim(),
            href: `/comfort/sites/${encodeURIComponent(site.code)}`,
            icon: activeItem.children[0].icon,
          })),
          activeItem.children[activeItem.children.length - 1],
        ]
      : activeItem.children;

  const items: React.ReactNode[] = [];
  let lastGroup = -1;
  WORKBENCH_NAV.forEach(n => {
    if (n.group !== lastGroup && lastGroup !== -1) {
      items.push(
        <div key={`sep-${n.group}`} style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '6px 12px' }} />
      );
    }
    lastGroup = n.group;
    const active = n.key === activeItem.key;
    const Icon = n.icon;
    items.push(
      <Link key={n.href} href={n.href} title={n.label} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, borderRadius: 10, margin: '2px auto',
        color: active ? 'var(--brand)' : 'rgba(255,255,255,0.45)',
        background: active ? 'rgba(78,154,61,0.15)' : 'transparent',
        transition: 'all 0.12s',
        textDecoration: 'none', flexShrink: 0,
        position: 'relative',
      }}>
        {/* Active indicator: left edge dot */}
        {active && (
          <span style={{
            position: 'absolute', left: -8, top: '50%', transform: 'translateY(-50%)',
            width: 3, height: 18, borderRadius: 2,
            background: 'var(--brand)',
          }} />
        )}
        <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      </Link>
    );
  });

  return (
    <>
      <aside className="sidebar" style={{ alignItems: 'center' }}>
        {/* 品牌红线 */}
        <div style={{ height: 3, width: '100%', background: 'var(--brand)', flexShrink: 0 }} />

        {/* Rysnova Logo */}
        <div style={{ margin: '12px auto 10px', width: 44, height: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img
            src="/images/rysnova-logo.jpg"
            alt="Rysnova"
            style={{ width: 44, height: 'auto', objectFit: 'contain', filter: 'brightness(1.15) contrast(1.05)' }}
          />
        </div>

        <div style={{ height: 1, width: 32, background: 'rgba(255,255,255,0.08)', margin: '0 auto 8px' }} />

        {/* Nav icons */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', width: '100%', padding: '4px 0' }}>
          {items}
        </nav>

        {/* Version dot */}
        <div style={{ padding: '12px 0', fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
          v2
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
              <p>运营</p>
              <h2>{activeItem.shortLabel}</h2>
              <span>{activeItem.desc}</span>
            </div>
            <nav className="workbench-subnav-list" aria-label={`${activeItem.label}二级菜单`}>
              {activeChildren.map((child) => {
                const ChildIcon = child.icon;
                const selected = isChildSelected(child.href);
                return (
                  <Link
                    key={child.key}
                    href={child.href}
                    title={child.label}
                    className={selected ? 'is-active' : undefined}
                  >
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
                <Link
                  key={child.key}
                  href={child.href}
                  title={child.label}
                  aria-label={child.label}
                  className={selected ? 'is-active' : undefined}
                >
                  <ChildIcon size={17} strokeWidth={selected ? 2.4 : 1.8} />
                </Link>
              );
            })}
          </nav>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <nav style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--border)', padding: '6px 0',
        gridTemplateColumns: 'repeat(5,1fr)',
      }} className="mobile-nav">
        {MOBILE.map(n => {
          const active = path === n.href || (n.href === '/brand' ? path?.startsWith('/comfort') || path?.startsWith('/brand') : path?.startsWith(n.href));
          const Icon = n.icon;
          return (
            <Link key={n.href} href={n.href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '4px 0', fontSize: 10, fontWeight: active ? 700 : 500,
              color: active ? 'var(--brand)' : 'var(--t-tertiary)', textDecoration: 'none',
            }}>
              <Icon size={18} />
              {n.label}
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
      `}</style>
    </>
  );
}
