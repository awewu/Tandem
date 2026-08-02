/**
 * 邮件正文 HTML 清洗 (P0 安全)
 *
 * 邮件正文来自外部, 直接 dangerouslySetInnerHTML 会带来:
 *   1. XSS: <script>, on* 事件, javascript: 链接, <iframe>/<object> 等
 *   2. 隐私: 远程图片/背景 = 追踪像素, 打开即暴露"已读 + IP + UA"
 *
 * 策略 (对齐 Gmail):
 *   - DOMPurify 白名单清洗 (剥离脚本 / 事件 / 危险标签)
 *   - 链接强制 target=_blank rel="noopener noreferrer nofollow"
 *   - 默认拦截远程图片 (blockRemoteImages), 记住原始地址到 data-blocked-src,
 *     用户点"显示外部图片"后再以 blockRemoteImages=false 重新清洗还原
 *
 * 纯客户端使用 (邮件详情是 'use client' 组件), 依赖浏览器 DOMPurify, 无需 jsdom。
 */

import DOMPurify from 'dompurify';

export interface SanitizeMailOptions {
  /** 是否拦截远程图片 (默认 true = 打开邮件不加载外部图, 防追踪像素) */
  blockRemoteImages?: boolean;
}

export interface SanitizeMailResult {
  /** 清洗后的安全 HTML */
  html: string;
  /** 正文是否包含被拦截的远程图片 (用于决定是否显示"显示外部图片"按钮) */
  hasBlockedRemoteImages: boolean;
}

const ALLOWED_TAGS = [
  'a', 'abbr', 'address', 'b', 'blockquote', 'br', 'caption', 'cite', 'code',
  'col', 'colgroup', 'dd', 'del', 'div', 'dl', 'dt', 'em', 'figcaption',
  'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins',
  'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong', 'sub',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'width', 'height', 'align', 'valign',
  'colspan', 'rowspan', 'style', 'target', 'rel', 'border', 'cellpadding',
  'cellspacing', 'bgcolor', 'color', 'data-blocked-src',
];

/** src 是否为"远程"资源 (http/https/协议相对), cid:/data: 视为内联安全 */
function isRemoteUrl(url: string | null): boolean {
  if (!url) return false;
  const v = url.trim().toLowerCase();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('//');
}

let hooksRegistered = false;
let currentBlockRemoteImages = true;
let blockedCount = 0;

function registerHooks(): void {
  if (hooksRegistered) return;
  hooksRegistered = true;

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const el = node as Element;

    // 链接: 强制安全跳转
    if (el.tagName === 'A') {
      if (el.getAttribute('href')) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }

    // 图片: 按需拦截远程源
    if (el.tagName === 'IMG') {
      const src = el.getAttribute('src');
      if (currentBlockRemoteImages && isRemoteUrl(src)) {
        el.setAttribute('data-blocked-src', src as string);
        el.removeAttribute('src');
        blockedCount += 1;
      }
    }

    // style 内联的远程背景图 (background:url(...)) 也会触发追踪 → 拦截时一并剥离
    const style = el.getAttribute('style');
    if (currentBlockRemoteImages && style && /url\((.*?)\)/i.test(style)) {
      const stripped = style.replace(/background(-image)?\s*:[^;]*url\([^)]*\)[^;]*;?/gi, '');
      if (stripped !== style) {
        el.setAttribute('style', stripped);
        blockedCount += 1;
      }
    }
  });
}

/**
 * 清洗邮件正文 HTML。默认拦截远程图片。
 */
export function sanitizeMailHtml(
  rawHtml: string,
  options: SanitizeMailOptions = {},
): SanitizeMailResult {
  if (!rawHtml) return { html: '', hasBlockedRemoteImages: false };

  registerHooks();
  currentBlockRemoteImages = options.blockRemoteImages !== false;
  blockedCount = 0;

  const html = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta', 'base'],
    FORBID_ATTR: ['srcset', 'formaction', 'ping'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['target', 'data-blocked-src'],
  }) as string;

  return { html, hasBlockedRemoteImages: blockedCount > 0 };
}
