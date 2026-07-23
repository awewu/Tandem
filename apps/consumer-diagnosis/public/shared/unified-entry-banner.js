/**
 * 统一系统配置入口横幅 - 自动注入到历史页面顶部
 * 使用: <script src="/shared/unified-entry-banner.js" defer></script>
 * 目的: 将历史页面用户带回 /pain-diagnosis.html，避免继续进入旧原型入口
 */
(function () {
  if (window.__uebInjected) return;
  window.__uebInjected = true;

  function inject() {
    // 当前页面就是生产配置入口，不需要注入
    if (location.pathname.endsWith('/pain-diagnosis.html')) return;

    const banner = document.createElement('div');
    banner.id = 'unified-entry-banner';
    banner.innerHTML = `
      <div class="ueb-inner">
        <div class="ueb-text">
          <span class="ueb-label">Rhautt Comfort</span>
          <span class="ueb-title">进入标准化三档系统配置流程</span>
          <span class="ueb-sub">基础 / 舒适 / 尊享 · 系统包 · 报价 · 交付字段</span>
        </div>
        <a href="/pain-diagnosis.html" class="ueb-cta">进入配置流程</a>
        <button class="ueb-close" aria-label="关闭" onclick="document.getElementById('unified-entry-banner').remove()">×</button>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
      #unified-entry-banner {
        position: sticky; top: 0; z-index: 9998;
        background: #fff;
        color: #20242a; font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, "Microsoft YaHei", sans-serif;
        border-bottom: 1px solid #d8dde3;
        box-shadow: 0 1px 2px rgba(17,24,32,.08);
      }
      #unified-entry-banner .ueb-inner {
        display: flex; align-items: center; gap: 16px;
        padding: 10px 24px; max-width: 1400px; margin: 0 auto;
      }
      #unified-entry-banner .ueb-text { flex: 1; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      #unified-entry-banner .ueb-label {
        display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px;
        border: 1px solid #d8dde3; border-radius: 4px; color: #E4002B;
        background: #fafbfc; font-size: 12px; font-weight: 800;
      }
      #unified-entry-banner .ueb-title { font-size: 14px; font-weight: 700; color: #161a20; }
      #unified-entry-banner .ueb-sub { font-size: 12px; color: #697586; }
      #unified-entry-banner .ueb-cta {
        background: #E4002B; color: #fff; padding: 7px 14px;
        border-radius: 6px; text-decoration: none; font-size: 13px;
        font-weight: 700; transition: background .12s;
      }
      #unified-entry-banner .ueb-cta:hover { background: #9d0e26; }
      #unified-entry-banner .ueb-close {
        background: transparent; border: 1px solid transparent; color: #697586;
        width: 32px; height: 32px; border-radius: 6px;
        font-size: 22px; cursor: pointer; padding: 0; opacity: .9;
      }
      #unified-entry-banner .ueb-close:hover { opacity: 1; border-color: #d8dde3; background: #f5f6f7; }
      @media (max-width: 720px) {
        #unified-entry-banner .ueb-inner { align-items: flex-start; padding: 10px 14px; gap: 8px; }
        #unified-entry-banner .ueb-text { display: grid; gap: 4px; }
        #unified-entry-banner .ueb-sub { display: none; }
      }
      @media print { #unified-entry-banner { display: none !important; } }
    `;
    document.head.appendChild(style);
    // 插入到 body 最前
    if (document.body.firstChild) {
      document.body.insertBefore(banner, document.body.firstChild);
    } else {
      document.body.appendChild(banner);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
