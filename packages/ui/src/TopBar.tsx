'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';

// ── 路由 → 模块元数据映射 ──────────────────────────────────────────────────
const MODULE_MAP: Record<string, { label: string; group: string }> = {
  '/dashboard':         { label: '总览',     group: '' },
  '/crm':               { label: 'CRM 客户', group: '销售' },
  '/design':            { label: '方案设计', group: '销售' },
  '/design/pro':        { label: '方案设计 Pro', group: '销售' },
  '/design/visualize':  { label: '方案可视化', group: '销售' },
  '/bim':               { label: 'BIM 交付', group: '交付' },
  '/projects':          { label: '项目进度', group: '交付' },
  '/products':          { label: '产品目录', group: '运营' },
  '/comfort':           { label: '品牌官网管理', group: '运营' },
  '/comfort/sites':     { label: '品牌官网管理', group: '运营' },
  '/growth':            { label: '市场营销', group: '运营' },
  '/accounts':          { label: '账号管理', group: '系统' },
  '/hub-console':       { label: 'Hub 控制台', group: '系统' },
  '/analytics':         { label: '经营分析', group: '运营' },
  '/finance':           { label: '财务',     group: '运营' },
  '/aftersales':        { label: '售后',     group: '运营' },
  '/team':              { label: '团队',     group: '运营' },
  '/brand':             { label: '品牌',     group: '运营' },
};

function resolveModule(path: string): { label: string; group: string } {
  // 精确匹配优先，然后前缀匹配
  if (MODULE_MAP[path]) return MODULE_MAP[path];
  const match = Object.keys(MODULE_MAP)
    .filter(k => k !== '/dashboard' && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? MODULE_MAP[match] : { label: '', group: '' };
}

// ── JWT payload 解析（仅客户端，无签名校验） ─────────────────────────────
function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

interface UserInfo {
  name: string;
  initial: string;
  tenantName: string;
}

function useUserInfo(): UserInfo | null {
  const [info, setInfo] = useState<UserInfo | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload = parseJwtPayload(token);
    if (!payload) return;
    const name = String(payload.name ?? payload.username ?? payload.sub ?? '');
    setInfo({
      name,
      initial: name ? name.slice(-1).toUpperCase() : '?',
      tenantName: String(payload.tenantName ?? payload.dealerName ?? ''),
    });
  }, []);
  return info;
}

// ── 面包屑：从路径推断子页面层级 ─────────────────────────────────────────
function Breadcrumb({ path, moduleLabel }: { path: string; moduleLabel: string }) {
  // /bim/abc123 → ['BIM 交付', '项目详情']
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 1) return null;

  // 只有进入详情页时才显示面包屑
  const parentKey = '/' + segments[0];
  const parent = MODULE_MAP[parentKey];
  if (!parent) return null;

  const sub = segments[1];
  // BIM 详情用项目ID缩写，其他用 "详情"
  const subLabel = segments[0] === 'bim' ? `项目 #${sub.slice(0, 8)}` : '详情';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 12, color: 'rgba(255,255,255,0.45)',
    }}>
      <span>{parent.label}</span>
      <ChevronRight size={11} />
      <span style={{ color: 'rgba(255,255,255,0.75)' }}>{subLabel}</span>
    </div>
  );
}

// ── TopBar 主体 ────────────────────────────────────────────────────────────
export default function TopBar() {
  const path = usePathname() ?? '';
  const user = useUserInfo();
  const { label, group } = resolveModule(path);

  // 不在 Shell 页（登录/移动落地页）不渲染
  if (path === '/' || path === '/mobile') return null;

  return (
    <header className="topbar">
      {/* 左：模块名 + 面包屑 */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {group && (
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
              color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
            }}>
              {group}
            </span>
          )}
          {group && label && (
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>/</span>
          )}
          <span style={{
            fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)',
            letterSpacing: '-0.01em', lineHeight: 1,
          }}>
            {label || 'Rysnova'}
          </span>
        </div>
        <Breadcrumb path={path} moduleLabel={label} />
      </div>

      {/* 中：弹性空白 */}
      <div style={{ flex: 1 }} />

      {/* 右：通知 + 用户 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 通知铃 */}
        <button
          aria-label="通知"
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'transparent', display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer',
            color: 'rgba(255,255,255,0.45)',
            transition: 'background 0.1s, color 0.1s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
          }}
        >
          <Bell size={15} />
        </button>

        {/* 用户头像 + 名称 */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
            {user.tenantName && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.tenantName}
              </span>
            )}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--brand)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff',
              flexShrink: 0,
            }}>
              {user.initial}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
