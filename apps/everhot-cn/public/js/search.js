/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 站内搜索
   SITE SEARCH. 纯前端，跨产品 / 经销商 / 页面索引检索。
   读取 ?q= 初始关键词；输入即时刷新结果。
   挂载点：<div data-site-search></div>
   依赖：products-data.js、dealers.js（可选，缺失则跳过该分组）
   ═══════════════════════════════════════════════════════════ */
(function(){
  var BASE='';
  function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function iconImage(s){
    s=String(s||'');
    return /^https?:\/\//.test(s) || s.indexOf('/api/')===0 || s.indexOf('/assets/')===0 || s.indexOf('data:image/')===0;
  }
  function renderIcon(s, cls){
    return iconImage(s) ? '<img class="'+cls+'" src="'+e(s)+'" alt="" loading="lazy" decoding="async">' : e(s||'•');
  }
  function getParam(n){ return (new URLSearchParams(location.search)).get(n)||''; }
  function productsReady(){
    if(typeof window.EVERHOT_LOAD_PRODUCTS==='function') return window.EVERHOT_LOAD_PRODUCTS();
    return window.EVERHOT_PRODUCTS_READY || Promise.resolve(false);
  }

  // 静态页面索引（站点主要页面）
  var PAGES=[
    {title:'产品中心',url:'products/',desc:'家用与商用完整产品线总览',tag:'页面'},
    {title:'智能选型向导',url:'products/selector/',desc:'回答几个问题，智能推荐合适机型',tag:'工具'},
    {title:'产品对比工具',url:'products/compare/',desc:'勾选最多 4 款产品并排对比规格',tag:'工具'},
    {title:'家用产品',url:'products/residential/',desc:'家用热水、采暖与制冷',tag:'页面'},
    {title:'商用产品',url:'products/commercial/',desc:'商用热水炉、空气能、楼宇热力站',tag:'页面'},
    {title:'查找经销商',url:'find-a-pro/',desc:'按城市 / 定位查找授权经销商',tag:'工具'},
    {title:'支持与服务',url:'support/',desc:'安装、维护、技术热线 400-888-8888',tag:'页面'},
    {title:'保修政策',url:'warranty/',desc:'产品保修范围与服务承诺',tag:'页面'},
    {title:'常见问题',url:'faqs/',desc:'选型、安装、使用与售后常见问题',tag:'页面'},
    {title:'节能补贴',url:'rebates/',desc:'高效节能产品补贴与申请指引',tag:'页面'},
    {title:'创新科技',url:'innovation/',desc:'冷凝、变频、零冷水与智能联控技术',tag:'页面'},
    {title:'可持续发展',url:'sustainability/',desc:'低碳节能与企业社会责任',tag:'页面'},
    {title:'关于恒热',url:'about/',desc:'百年恒续 · 为爱恒热',tag:'页面'},
    {title:'联系我们',url:'contact/',desc:'销售与服务联系方式',tag:'页面'},
    {title:'专业人士 / 经销商',url:'professionals/',desc:'产品查询、技术文档、培训与资源',tag:'页面'}
  ];

  function tokens(q){ return q.toLowerCase().split(/\s+/).filter(Boolean); }
  function matchAll(hay, toks){ hay=hay.toLowerCase(); return toks.every(function(t){return hay.indexOf(t)>-1;}); }

  function searchProducts(toks){
    var prods=window.EVERHOT_PRODUCTS||[];
    return prods.filter(function(p){
      var hay=[p.name,p.en,p.series,p.tagline].concat((p.badges||[]),(p.specs||[]).map(function(s){return s.k+s.v;})).join(' ');
      return matchAll(hay, toks);
    }).map(function(p){
      return {title:p.name, sub:p.series||'', desc:p.tagline||'', url:'products/detail/?model='+encodeURIComponent(p.slug), tag:'产品', ic:p.icon||'🔧'};
    });
  }
  function searchDealers(toks){
    var ds=window.EVERHOT_DEALERS||[];
    return ds.filter(function(d){
      return matchAll([d.name,d.province,d.city,d.district,d.addr].join(' '), toks);
    }).map(function(d){
      return {title:d.name, sub:(d.province||'')+' · '+(d.city||''), desc:d.addr||'', url:'find-a-pro/?q='+encodeURIComponent(d.city||d.name), tag:'经销商', ic:'📍'};
    });
  }
  function searchPages(toks){
    return PAGES.filter(function(p){ return matchAll(p.title+' '+p.desc, toks); })
      .map(function(p){ return {title:p.title, sub:'', desc:p.desc, url:p.url, tag:p.tag, ic:'📄'}; });
  }

  function init(){
    var host=document.querySelector('[data-site-search]');
    if(!host) return;
    var q0=getParam('q');

    host.innerHTML=''
      +'<form class="ss-form" role="search" onsubmit="return false">'
      +  '<input type="search" class="ss-input" placeholder="搜索产品、经销商、页面…" aria-label="站内搜索">'
      +'</form>'
      +'<p class="ss-count" aria-live="polite"></p>'
      +'<div class="ss-results"></div>';

    var elInput=host.querySelector('.ss-input');
    var elCount=host.querySelector('.ss-count');
    var elResults=host.querySelector('.ss-results');
    elInput.value=q0;

    function group(title, items){
      if(!items.length) return '';
      var h='<section class="ss-group"><h2 class="ss-group-h">'+e(title)+' <span>'+items.length+'</span></h2><div class="ss-list">';
      items.forEach(function(r){
        h+='<a class="ss-item" href="'+BASE+'/'+r.url+'">'
          +'<span class="ss-ic">'+renderIcon(r.ic||'•','ss-ic-img')+'</span>'
          +'<span class="ss-body"><span class="ss-title">'+e(r.title)+(r.sub?(' <small>'+e(r.sub)+'</small>'):'')+'</span>'
          +'<span class="ss-desc">'+e(r.desc||'')+'</span></span>'
          +'<span class="ss-tag">'+e(r.tag)+'</span></a>';
      });
      return h+'</div></section>';
    }

    function draw(){
      var q=elInput.value.trim();
      // 同步 URL，便于分享/刷新
      try{ history.replaceState(null,'',location.pathname+(q?('?q='+encodeURIComponent(q)):'')); }catch(_){}
      if(!q){ elCount.textContent='输入关键词开始搜索，例如：零冷水、冷凝炉、上海、保修。'; elResults.innerHTML=''; return; }
      var toks=tokens(q);
      var prods=searchProducts(toks), dealers=searchDealers(toks), pages=searchPages(toks);
      var total=prods.length+dealers.length+pages.length;
      elCount.innerHTML='关于 “<strong>'+e(q)+'</strong>” 共找到 <strong>'+total+'</strong> 条结果';
      if(!total){
        elResults.innerHTML='<div class="ss-empty"><p>未找到相关内容。试试更换关键词，或 <a href="'+BASE+'/products/selector/">用选型向导</a> / <a href="'+BASE+'/find-a-pro/">查找经销商</a>，也可致电 <a href="tel:4008888888">400-888-8888</a>。</p></div>';
        return;
      }
      elResults.innerHTML=group('产品', prods)+group('经销商', dealers)+group('页面', pages);
    }

    elInput.addEventListener('input',draw);
    draw();
    elInput.focus();
  }

  function start(){ productsReady().then(init, init); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',start); }
  else { start(); }
})();
