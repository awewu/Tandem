'use client';
import { useEffect, useState } from 'react';
import { NX_COOKIE_NAME } from './index';

/**
 * 全局「返回门户」悬浮按钮 —— 解决"进入某模块后无法回到统一门户 / 模块间无法互跳"。
 *
 * 放在各子应用（设计师工作台、AI 问诊、客户门户、品牌控制台、官网等）的根 layout 中。
 * 门户宿主是 dealer-workbench 的 /hub（本地默认 :4000/hub）。
 *
 * 可见性：仅在已登录（存在 nx_token / localStorage token）时出现，避免官网匿名访客看到。
 * 目标地址：优先 NEXT_PUBLIC_APP_DEALER_URL（生产子域，如 https://dealer.rhautt.com），
 *          否则回退到当前 host 的 :4000（本地开发跨端口共享同源 cookie，免登直达）。
 * 自身检测：比较当前 location.origin 与 dealer 工作台基础 URL，不再硬编码 4000 端口。
 */
function readToken(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${NX_COOKIE_NAME}=([^;]*)`));
  if (m) return decodeURIComponent(m[1]);
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
  } catch {
    return null;
  }
}

function dealerBaseUrl(): string {
  const override =
    typeof process !== 'undefined'
      ? (process.env?.NEXT_PUBLIC_APP_DEALER_URL as string | undefined)
      : undefined;
  if (override) return override.replace(/\/$/, '');
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:4000`;
}

function hubUrl(): string {
  return dealerBaseUrl() + '/hub';
}

export default function HubReturnButton() {
  const [show, setShow] = useState(false);
  const [href, setHref] = useState('#');

  useEffect(() => {
    // 已在门户宿主自身时不显示，避免自跳
    const onHubHost =
      typeof window !== 'undefined' &&
      window.location.origin === dealerBaseUrl();
    if (onHubHost) return;
    if (!readToken()) return;
    setHref(hubUrl());
    setShow(true);
  }, []);

  if (!show) return null;

  return (
    <a
      href={href}
      className="rh-hub-return"
      title="返回统一门户"
      aria-label="返回统一门户"
      style={{
        position: 'fixed',
        left: 20,
        bottom: 20,
        zIndex: 2147483000,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '9px 14px 9px 11px',
        borderRadius: 999,
        textDecoration: 'none',
        fontSize: 13,
        fontWeight: 600,
        color: '#fff',
        background: 'linear-gradient(150deg, #4E9A3D 0%, #2F5E24 100%)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
        letterSpacing: '0.01em',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
        transition: 'transform 150ms cubic-bezier(0.4,0,0.2,1), box-shadow 150ms',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.36)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.28)';
      }}
    >
      {/* 九宫格「应用中心」图标 */}
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.4" fill="#fff" />
        <rect x="9.5" y="1" width="5.5" height="5.5" rx="1.4" fill="#fff" opacity="0.75" />
        <rect x="1" y="9.5" width="5.5" height="5.5" rx="1.4" fill="#fff" opacity="0.75" />
        <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1.4" fill="#fff" opacity="0.5" />
      </svg>
      返回门户
    </a>
  );
}
