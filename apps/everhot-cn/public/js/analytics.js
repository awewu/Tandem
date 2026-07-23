/* Everhot 合规分析埋点 — 自建、无第三方、可度量 CRO。
 * 设计：默认不发送到外部；配置 window.EV_ANALYTICS_ENDPOINT（同源或自有合规服务）后经 sendBeacon 上报。
 * 隐私：尊重 DNT；仅采集匿名事件（页面路径、CTA 类型、referrer 主机），不采集个人信息。
 * 用法：window.evTrack('event_name', { ...props })。CTA/表单点击自动埋点。
 * 上线：把上报端点接到合规统计服务；如需 Cookie/同意管理，置 window.EV_ANALYTICS_CONSENT=false 可全局关闭。
 */
(function () {
  var ENDPOINT = window.EV_ANALYTICS_ENDPOINT || null;
  var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.msDoNotTrack === '1';
  var queue = [];
  var CKEY = 'ev_consent'; // 'granted' | 'denied' | null(未选)

  function getConsent(){ try { return localStorage.getItem(CKEY); } catch(_) { return null; } }
  function setConsent(v){ try { localStorage.setItem(CKEY, v); } catch(_) {} }
  // 启用条件：未被代码关闭 & 非 DNT & 用户未拒绝（未选→默认匿名统计，已在横幅告知）
  function isEnabled(){ return window.EV_ANALYTICS_CONSENT !== false && !dnt && getConsent() !== 'denied'; }

  function nowISO() { try { return new Date().toISOString(); } catch (_) { return ''; } }
  function refHost() { try { return document.referrer ? new URL(document.referrer).host : ''; } catch (_) { return ''; } }

  function send(evt) {
    var payload = {
      t: evt.event, ts: nowISO(),
      path: location.pathname, ref: refHost(),
      vw: window.innerWidth || 0,
      props: evt.props || {}
    };
    if (!isEnabled()) return;
    if (ENDPOINT && navigator.sendBeacon) {
      try { navigator.sendBeacon(ENDPOINT, JSON.stringify(payload)); return; } catch (_) {}
    }
    // 未配置端点：开发期落 console，便于验证埋点已触发（不外发）
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      try { console.debug('[evTrack]', payload.t, payload.path, payload.props); } catch (_) {}
    }
  }

  window.evTrack = function (event, props) {
    var evt = { event: event, props: props || {} };
    queue.push(evt); send(evt);
  };
  window.EVERHOT_analyticsQueue = queue;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Cookie 同意告知横幅（PIPL/Cookie）——首次访问展示，记住选择
  function consentBanner() {
    if (getConsent()) return;                 // 已选过不再打扰
    if (dnt) { setConsent('denied'); return; } // 尊重 DNT，不弹直接视为拒绝
    var bar = document.createElement('div');
    bar.className = 'ev-consent';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie 与隐私告知');
    bar.innerHTML =
      '<p class="ev-consent-tx">本站使用 Cookie 与匿名统计以保障基本功能并改善体验。继续浏览即表示同意，您也可拒绝非必要统计。详见<a href="/privacy/#cookie">隐私政策</a>。</p>' +
      '<div class="ev-consent-act">' +
        '<button type="button" class="btn btn-outline-light" data-consent="denied">拒绝非必要</button>' +
        '<button type="button" class="btn btn-brand" data-consent="granted">同意</button>' +
      '</div>';
    document.body.appendChild(bar);
    bar.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-consent]') : null;
      if (!b) return;
      setConsent(b.getAttribute('data-consent'));
      bar.remove();
      if (isEnabled()) { queue.forEach(send); } // 同意后补发先前排队的事件
    });
  }

  ready(function () {
    consentBanner();
    // 1) 页面浏览
    window.evTrack('pageview', { title: document.title });

    // 2) 委托式 CTA 点击埋点（覆盖动态注入的导航/页脚）
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest ? ev.target.closest('a, button') : null;
      if (!a) return;
      var href = a.getAttribute && a.getAttribute('href') || '';
      var label = (a.textContent || '').trim().slice(0, 40);

      if (href.indexOf('tel:') === 0) { window.evTrack('cta_call', { href: href, label: label }); return; }
      if (href.indexOf('/find-a-pro') !== -1) { window.evTrack('cta_find_pro', { label: label }); return; }
      if (a.classList && (a.classList.contains('btn-brand') || a.classList.contains('btn-light'))) {
        window.evTrack('cta_click', { label: label, href: href }); return;
      }
      if (href.indexOf('/products/selector') !== -1) { window.evTrack('cta_selector', { label: label }); return; }
    }, true);

    // 3) 表单提交（留资/联系）——只记类型，不记字段值
    document.addEventListener('submit', function (ev) {
      var f = ev.target;
      if (!f || f.tagName !== 'FORM') return;
      var kind = f.getAttribute('data-ev-form') || (f.getAttribute('role') === 'search' ? 'search' : 'form');
      window.evTrack('form_submit', { form: kind });
    }, true);

    // 4) 滚动深度（25/50/75/100）—— 衡量内容触达
    var hit = {};
    var onScroll = function () {
      var h = document.documentElement;
      var pct = (h.scrollTop + window.innerHeight) / (h.scrollHeight || 1) * 100;
      [25, 50, 75, 100].forEach(function (m) {
        if (pct >= m && !hit[m]) { hit[m] = 1; window.evTrack('scroll_depth', { pct: m }); }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  });
})();
