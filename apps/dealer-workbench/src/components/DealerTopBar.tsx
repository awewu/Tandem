'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell } from 'lucide-react';
import { WORKBENCH_NAV, navItemForPath } from '../lib/workbench-navigation';
import { brandSites } from '../lib/api';

type BrandSiteTopBarItem = {
  code: string;
  nameCn: string;
  nameEn: string;
  sortOrder: number;
  status: string;
  deletedAt: string | null;
};

function brandSiteLabel(site: BrandSiteTopBarItem): string {
  return `${site.nameCn || site.nameEn} ${site.nameEn || ''}`.trim();
}

function selectedChildLabel(path: string, search: string, brandSiteLabels: Record<string, string>): string {
  const activeItem = navItemForPath(path);
  const currentHref = `${path}${search}`;
  const queryModule = new URLSearchParams(search).get('module') || 'catalog';

  if (path === '/products') {
    return activeItem.children.find((child) => {
      const module = new URLSearchParams(child.href.split('?')[1] || '').get('module') || 'catalog';
      return module === queryModule;
    })?.label || activeItem.children[0]?.label || activeItem.desc;
  }

  if (activeItem.key === 'brand-sites' && path.startsWith('/comfort/sites/')) {
    const code = decodeURIComponent(path.split('/').filter(Boolean)[2] || '');
    if (brandSiteLabels[code]) return brandSiteLabels[code];
    const fallback = WORKBENCH_NAV[0].children.find((child) => child.href.endsWith(`/${code}`));
    return fallback?.label || code || activeItem.children[0]?.label || activeItem.desc;
  }

  const exactChild = activeItem.children.find((child) => child.href === currentHref || child.href === path);
  if (exactChild) return exactChild.label;

  const nestedChild = activeItem.children.find((child) => {
    const childPath = child.href.split('?')[0];
    return childPath !== activeItem.href && path.startsWith(`${childPath}/`);
  });
  if (nestedChild) return nestedChild.label;

  return activeItem.children[0]?.label || activeItem.desc;
}

function primaryTitle(key: string, fallback: string): string {
  if (key === 'growth') return '市场营销';
  return fallback;
}

export default function DealerTopBar() {
  const path = usePathname() || '';
  const [search, setSearch] = useState('');
  const [brandSiteLabels, setBrandSiteLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    setSearch(window.location.search);
  }, [path]);

  useEffect(() => {
    let cancelled = false;

    async function loadBrandSiteLabels() {
      try {
        const result = await brandSites.list();
        if (cancelled) return;
        const labels = Object.fromEntries(
          ((result.items || []) as BrandSiteTopBarItem[])
            .filter((site) => site.status === 'active' && !site.deletedAt)
            .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
            .map((site) => [site.code, brandSiteLabel(site)])
        );
        setBrandSiteLabels(labels);
      } catch {
        if (!cancelled) setBrandSiteLabels({});
      }
    }

    if (!path.startsWith('/comfort/sites/')) {
      setBrandSiteLabels({});
      return;
    }

    loadBrandSiteLabels();
    window.addEventListener('rhautt-brand-sites-updated', loadBrandSiteLabels);
    return () => {
      cancelled = true;
      window.removeEventListener('rhautt-brand-sites-updated', loadBrandSiteLabels);
    };
  }, [path]);

  if (path === '/') return null;

  const activeItem = navItemForPath(path);
  const title = primaryTitle(activeItem.key, activeItem.label);
  const childLabel = selectedChildLabel(path, search, brandSiteLabels);

  return (
    <header className="topbar dealer-topbar">
      <div className="dealer-topbar-title">
        <h1>{title}</h1>
        <p>{childLabel}</p>
      </div>
      <div style={{ flex: 1 }} />
      <button type="button" className="dealer-topbar-icon" aria-label="通知">
        <Bell size={15} />
      </button>
    </header>
  );
}
