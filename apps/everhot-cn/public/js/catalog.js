/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 目录渲染器
   数据来源：window.EVERHOT_PRODUCTS（products-data.js）
   用法：
     分类页  <div class="product-grid" data-catalog="residential:water-heating"></div>
     详情页  <div data-product-detail></div>  + URL ?model=slug
   ═══════════════════════════════════════════════════════════ */
(function () {
  var BASE = '';
  function e(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  var RUNTIME_SITE_CODE = window.EVERHOT_SITE_CODE || 'everhot';
  var RUNTIME_API_BASE = window.EVERHOT_API_BASE || '';
  var RUNTIME_PRODUCTS_API = '/api/v2/sites/' + RUNTIME_SITE_CODE + '/products?locale=zh-CN';
  var LEGACY_PRODUCTS_API = '/api/v2/brand/' + RUNTIME_SITE_CODE + '/products?locale=zh-CN';

  function installCatalog(){
    window.EVERHOT_PRODUCTS = Array.isArray(window.EVERHOT_PRODUCTS) ? window.EVERHOT_PRODUCTS : [];
    window.EVERHOT_CATALOG = {
      by:function(cat,sys){ return window.EVERHOT_PRODUCTS.filter(function(p){return p.cat===cat&&p.sys===sys;}); },
      one:function(slug){ return window.EVERHOT_PRODUCTS.filter(function(p){return p.slug===slug;})[0]||null; }
    };
  }
  function setRuntimeStatus(status){
    window.EVERHOT_PRODUCTS_STATUS = status;
    try{ window.dispatchEvent(new CustomEvent('everhot-products-status',{detail:{status:status}})); }catch(_){}
  }
  function shouldUseRuntimeProducts(){
    if(window.EVERHOT_RUNTIME_PRODUCTS === false) return false;
    return true;
  }
  function fetchJson(url){
    return fetch(url, { cache:'no-store' }).then(function(res){
      if(!res.ok) throw new Error('HTTP '+res.status);
      return res.json();
    });
  }
  function fetchWithLegacy(apiBase, primary, legacy, valid){
    function accept(json){
      if(!valid(json)) throw new Error('Invalid product response');
      return json;
    }
    return fetchJson(apiBase + primary).then(accept)
      .catch(function(){ return fetchJson(apiBase + legacy).then(accept); });
  }
  function normalizeRuntimeProduct(product){
    var copy = {};
    Object.keys(product || {}).forEach(function(key){ copy[key] = product[key]; });
    copy.slug = String(product && (product.slug || product.sku) || '');
    copy.tagline = product && (product.tagline || product.summary) || '';
    copy.image = product && (product.image || (product.mainImage && product.mainImage.url)) || '';
    return copy;
  }
  function isRuntimeProductForSite(product){
    var brand = String(product && product.brand || '').trim().toLowerCase();
    return !brand || brand === RUNTIME_SITE_CODE;
  }
  function loadRuntimeProducts(){
    if(window.EVERHOT_PRODUCTS_READY) return window.EVERHOT_PRODUCTS_READY;
    if(!shouldUseRuntimeProducts()){ installCatalog(); setRuntimeStatus('static'); return Promise.resolve(false); }
    if(!window.fetch){ installCatalog(); setRuntimeStatus('fallback'); return Promise.resolve(false); }
    setRuntimeStatus('loading');
    var apiBase = RUNTIME_API_BASE;
    window.EVERHOT_PRODUCTS_READY = fetchWithLegacy(apiBase, RUNTIME_PRODUCTS_API, LEGACY_PRODUCTS_API, function(json){
      return !!(json && json.data && Array.isArray(json.data.items));
    })
      .then(function(json){
        var items = json && json.data && json.data.items;
        if(Array.isArray(items)){
          window.EVERHOT_PRODUCTS = items.map(normalizeRuntimeProduct).filter(function(p){ return p.slug && isRuntimeProductForSite(p); });
          installCatalog();
          setRuntimeStatus(window.EVERHOT_PRODUCTS.length ? 'runtime' : 'empty');
          return true;
        }
        installCatalog();
        setRuntimeStatus('fallback');
        return false;
      })
      .catch(function(){ installCatalog(); setRuntimeStatus('fallback'); return false; });
    return window.EVERHOT_PRODUCTS_READY;
  }
  function loadRuntimeProduct(slug){
    if(!slug || !shouldUseRuntimeProducts() || !window.fetch) return Promise.resolve(null);
    var found = window.EVERHOT_CATALOG && window.EVERHOT_CATALOG.one(slug);
    if(found) return Promise.resolve(found);
    var apiBase = RUNTIME_API_BASE;
    var suffix = encodeURIComponent(slug) + '?locale=zh-CN';
    return fetchWithLegacy(
      apiBase,
      '/api/v2/sites/' + RUNTIME_SITE_CODE + '/products/' + suffix,
      '/api/v2/brand/' + RUNTIME_SITE_CODE + '/products/' + suffix,
      function(json){ return !!(json && json.data && typeof json.data === 'object'); }
    )
      .then(function(json){
        var item = normalizeRuntimeProduct(json && json.data);
        if(!item || !item.slug || !isRuntimeProductForSite(item)) return null;
        var list = Array.isArray(window.EVERHOT_PRODUCTS) ? window.EVERHOT_PRODUCTS.slice() : [];
        list = list.filter(function(p){ return p.slug !== item.slug; });
        list.push(item);
        window.EVERHOT_PRODUCTS = list;
        installCatalog();
        return item;
      })
      .catch(function(){ return null; });
  }
  window.EVERHOT_LOAD_PRODUCTS = loadRuntimeProducts;
  window.EVERHOT_LOAD_PRODUCT = loadRuntimeProduct;

  function imageUrl(path) {
    if (!path || /^(?:https?:|data:)/.test(path)) return path;
    return RUNTIME_API_BASE + path;
  }

  function officialDetailHtml(product) {
    return String(product && (product.officialDetailHtml || (product.content && product.content.officialDetailHtml)) || '');
  }

  function manualPdfs(product) {
    return (product && Array.isArray(product.manualPdfs) ? product.manualPdfs : [])
      .map(function (item) {
        var url = item && item.url ? imageUrl(String(item.url)) : '';
        if (!url || !/^(https?:\/\/|\/api\/|\/assets\/|\/uploads\/)/i.test(url)) return null;
        return { url: url, filename: String((item && item.filename) || '产品说明.pdf') };
      })
      .filter(Boolean);
  }

  function normalizeOfficialDetailHtml(html) {
    if (!html) return '';
    var template = document.createElement('template');
    template.innerHTML = String(html);
    template.content.querySelectorAll('script, style, iframe, object, embed, form, input, button').forEach(function (node) {
      node.remove();
    });
    template.content.querySelectorAll('*').forEach(function (node) {
      Array.prototype.slice.call(node.attributes || []).forEach(function (attr) {
        var name = attr.name.toLowerCase();
        if (name.indexOf('on') === 0 || name === 'style') node.removeAttribute(attr.name);
      });
      if (node.tagName === 'A') {
        var href = node.getAttribute('href') || '';
        if (/^(https?:\/\/|mailto:|tel:|\/)/i.test(href)) {
          node.setAttribute('rel', 'noopener noreferrer');
          if (/^https?:\/\//i.test(href)) node.setAttribute('target', '_blank');
        } else {
          node.removeAttribute('href');
        }
      }
      if (node.tagName === 'IMG') {
        var src = node.getAttribute('src') || '';
        if (/^(https?:\/\/|\/api\/|\/assets\/|\/uploads\/)/i.test(src)) {
          node.setAttribute('src', imageUrl(src));
          node.setAttribute('loading', 'lazy');
          node.setAttribute('decoding', 'async');
          node.setAttribute('alt', node.getAttribute('alt') || '');
        } else {
          node.remove();
        }
      }
    });
    return template.innerHTML.trim();
  }

  function hasOfficialDetailBody(html) {
    if (!html) return false;
    var text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    return !!(text || /<(img|table)\b/i.test(html));
  }

  function officialDetailBlock(product) {
    var html = normalizeOfficialDetailHtml(officialDetailHtml(product));
    if (!hasOfficialDetailBody(html)) return '';
    return '<section class="section pd-official-detail-section"><div class="container">'
      + '<div class="pd-official-detail-body">' + html + '</div>'
      + '</div></section>';
  }

  function iconSrc(p){
    var v=p&&p.icon ? String(p.icon) : '';
    return (/^https?:\/\//.test(v) || v.indexOf('/api/')===0 || v.indexOf('/assets/')===0 || v.indexOf('data:image/')===0) ? v : '';
  }
  function art(p){
    var icon=iconSrc(p);
    if(icon) return '<img class="pc-media-icon-img" src="'+e(icon)+'" alt="'+e(p.name||'产品图标')+'" loading="lazy" decoding="async">';
    return (typeof window.EVERHOT_ART==='function') ? window.EVERHOT_ART(p) : '<span class="pc-media-emoji">'+e(p.icon||'🔧')+'</span>';
  }
  /* 产品 → 统一线性图标（按机型语义），用于对比/选型小图标，保持全站一致 */
  function prodIco(p){
    var icon=iconSrc(p);
    if(icon) return '<img class="pc-inline-icon-img" src="'+e(icon)+'" alt="" loading="lazy" decoding="async">';
    var f=window.EVERHOT_ICON; if(!f) return e(p.icon||'🔧');
    var n=(p&&(p.name||''))+' '+(p&&(p.series||''));
    var name = /热泵|空气能/.test(n) ? 'fan'
      : /壁挂炉|燃气|冷凝|采暖热水/.test(n) ? 'flame'
      : /储热|水箱|容积|无槽/.test(n) ? 'drop'
      : (p&&p.sys==='heating-cooling' ? 'thermo' : 'drop');
    return f(name);
  }
  // 图片解析优先级：products-data 显式 image > 抓取生成的图片映射 > SVG 矢量插画
  // 后期替换：编辑 data/product-image-manifest.json 并重跑 scripts/fetch-product-images.mjs 即可。
  function imgSrc(p){
    if(p && p.image) return p.image;
    var map = window.EVERHOT_PRODUCT_IMAGES;
    if(map && p && map[p.slug]) return map[p.slug];
    return '';
  }
  // 参数长图（仅详情页「产品参数」区用）：products-data.specImage > 参数长图映射
  function specImg(p){
    if(p && p.specImage) return p.specImage;
    var map = window.EVERHOT_PRODUCT_SPECIMAGES;
    if(map && p && map[p.slug]) return map[p.slug];
    return '';
  }
  function media(p){
    var src=imgSrc(p);
    if(src){ return '<div class="pc-media"><img src="'+e(src)+'" alt="'+e(p.name)+'" loading="lazy" decoding="async"></div>'; }
    return '<div class="pc-media pc-media-art">'+art(p)+'</div>';
  }
  function galleryImgs(p){
    return (p && Array.isArray(p.gallery) ? p.gallery : [])
      .map(function(x){ return x && x.url ? x.url : ''; })
      .filter(Boolean);
  }
  function badges(p){
    if(!p.badges||!p.badges.length) return '';
    return '<div class="pc-badges">'+p.badges.slice(0,1).map(function(b){return '<span class="pc-badge">'+e(b)+'</span>';}).join('')+'</div>';
  }

  function card(p){
    return '<a class="product-card" href="'+BASE+'/products/detail/?model='+e(p.slug)+'">'
      + media(p) + badges(p)
      + '<div class="pc-body">'
      + '<span class="pc-series">'+e(p.series||'')+'</span>'
      + '<h4>'+e(p.name)+'</h4>'
      + '<p>'+e(p.tagline)+'</p>'
      + '<span class="pc-cta">查看详情 →</span>'
      + '</div></a>';
  }

  /* 分类页 facet 筛选（rheem 级）：按系列(series)过滤 + 结果计数 */
  function renderCatalogGrid(g, list){
    if(g.dataset.faceted) return; g.dataset.faceted='1';
    var seriesList=[], seen={};
    list.forEach(function(p){ var s=p.series||'其他'; if(!seen[s]){seen[s]=1; seriesList.push(s);} });
    var state={f:'__all'}, bar=null;
    // 深链：?series=<系列名> 预选对应子类型（供 mega-nav / 外链直达）
    try{ var qsS=new URLSearchParams(location.search).get('series'); if(qsS && seriesList.indexOf(qsS)>=0) state.f=qsS; }catch(_){}
    if(seriesList.length>1 && g.parentNode){
      bar=document.createElement('div'); bar.className='cat-filter';
      bar.innerHTML='<div class="cat-filter-chips"><button class="cat-chip is-on" data-f="__all">全部</button>'
        + seriesList.map(function(s){return '<button class="cat-chip" data-f="'+e(s)+'">'+e(s)+'</button>';}).join('')
        + '</div><span class="cat-count"></span>';
      g.parentNode.insertBefore(bar, g);
    }
    function paint(){
      var sub = state.f==='__all' ? list : list.filter(function(p){return (p.series||'其他')===state.f;});
      g.innerHTML=sub.length ? runtimeNotice()+sub.map(card).join('') : emptyState();
      if(bar){
        bar.querySelector('.cat-count').textContent='共 '+sub.length+' 款';
        bar.querySelectorAll('.cat-chip').forEach(function(b){ b.classList.toggle('is-on', b.getAttribute('data-f')===state.f); });
      }
    }
    if(bar){ bar.querySelectorAll('.cat-chip').forEach(function(b){ b.addEventListener('click',function(){ state.f=b.getAttribute('data-f'); paint(); }); }); }
    paint();
  }

  // 空网格兜底：无匹配产品时给出说明 + 出口，避免出现空白网格
  function emptyState(){
    return '<div class="catalog-empty">'
      + '<p class="catalog-empty-tt">该系列产品正在陆续上架</p>'
      + '<p class="catalog-empty-tx">如需该类产品的选型与报价，欢迎联系恒热授权经销商，我们将为您推荐合适型号。</p>'
      + '<div class="catalog-empty-act"><a class="btn btn-brand" href="'+BASE+'/find-a-pro/">查找经销商</a>'
      + '<a class="btn btn-outline" href="'+BASE+'/products/">浏览全部产品</a></div>'
      + '</div>';
  }

  function loadingState(){
    return '<div class="catalog-empty"><p class="catalog-empty-tt">正在读取最新产品目录</p>'
      + '<p class="catalog-empty-tx">页面会直接使用 Everhot 同源公开 API，加载完成后显示最新上架产品。</p></div>';
  }
  function runtimeNotice(){
    if(window.EVERHOT_PRODUCTS_STATUS !== 'fallback') return '';
    return '<div class="catalog-empty"><p class="catalog-empty-tt">产品 API 暂时不可用</p>'
      + '<p class="catalog-empty-tx">当前显示本页随站点携带的离线目录；稍后刷新可重新读取最新后台数据。</p></div>';
  }

  function renderGrids(){
    document.querySelectorAll('[data-catalog]').forEach(function(g){
      var key=g.getAttribute('data-catalog').split(':');
      var list=window.EVERHOT_CATALOG.by(key[0],key[1]);
      // 第三段可选：按 series 过滤，供子类型 SEO 落地页（data-catalog="residential:water-heating:零冷水"）
      if(key[2]){ list=list.filter(function(p){return (p.series||'')===key[2];}); }
      if(!list.length){ g.innerHTML=emptyState(); return; }
      renderCatalogGrid(g, list);
    });
    // 首页精选：data-featured="residential" / "commercial"，可选条数 data-count
    document.querySelectorAll('[data-featured]').forEach(function(g){
      var cat=g.getAttribute('data-featured');
      var rawCount=g.getAttribute('data-count');
      var n=rawCount?parseInt(rawCount,10):0;
      var list=window.EVERHOT_PRODUCTS.filter(function(p){return p.cat===cat;});
      if(n>0) list=list.slice(0,n);
      if(!list.length){ g.innerHTML=emptyState(); return; }
      g.innerHTML=runtimeNotice()+list.map(card).join('');
    });
  }

  function specRows(p){
    return (p.specs||[]).map(function(s){
      return '<tr><th>'+e(s.k)+'</th><td>'+e(s.v)+'</td></tr>';
    }).join('');
  }
  function featureCards(p){
    return (p.features||[]).map(function(f){
      return '<div class="pf-card"><h4>'+e(f.title)+'</h4><p>'+e(f.desc)+'</p></div>';
    }).join('');
  }
  function displayMetricValue(v){
    return String(v==null?'':v).replace(/\u6d4b\u8bd5\s*$/,'');
  }
  function highlightStats(p){
    return (p.highlights||[]).map(function(h){
      return '<div class="pd-stat"><span class="pd-stat-val">'+e(displayMetricValue(h.value))+'</span><span class="pd-stat-label">'+e(h.label)+'</span></div>';
    }).join('');
  }
  function catName(p){
    var c=p.cat==='residential'?'家用':'商用';
    var s=p.sys==='water-heating'?'热水系统':'采暖制冷';
    return {c:c,s:s,sysPath:BASE+'/products/'+p.cat+'/'+p.sys+'/'};
  }
  function configuredRelated(p){
    var rel=p&&p.related;
    if(!rel || typeof rel!=='object') return [];
    var order=['cross_sell','up_sell','compatible','accessory','compare','replaces','replaced_by'];
    var out=[], seen={};
    order.forEach(function(k){
      (Array.isArray(rel[k]) ? rel[k] : []).forEach(function(r){
        var slug = r && (r.slug || r.sku);
        if(!slug || seen[slug]) return;
        seen[slug]=1;
        out.push({
          slug: slug,
          name: r.name || slug,
          series: r.series || '',
          tagline: r.summary || r.tagline || r.headline || '',
          tags: r.tags || [],
          badges: r.tags || [],
          image: (r.mainImage && r.mainImage.url) || r.image || '',
          mainImage: r.mainImage || null,
          gallery: [],
          cat: r.cat || p.cat,
          sys: r.sys || p.sys,
          icon: r.icon || p.icon
        });
      });
    });
    return out;
  }
  function related(p){
    var sib=configuredRelated(p);
    if(!sib.length && window.EVERHOT_PRODUCTS_STATUS === 'fallback'){
      sib=window.EVERHOT_CATALOG.by(p.cat,p.sys).filter(function(x){return x.slug!==p.slug;}).slice(0,3);
    }
    if(!sib.length) return '';
    return '<section class="section section-alt"><div class="container">'
      +'<div class="section-head"><div class="eyebrow">同类产品</div><h2>您可能还关注</h2></div>'
      +'<div class="product-grid">'+sib.map(card).join('')+'</div></div></section>';
  }

  /* 认证与能效（data-driven，可在 products-data.js 用 certs:[] 覆盖） */
  function certList(p){
    if(p.certs&&p.certs.length) return p.certs;
    return p.cat==='commercial'
      ? ['能效达标','3C 强制认证','BACnet / Modbus 兼容','ISO 9001 制造体系']
      : ['能效等级 一级','3C 强制认证','低氮排放','搪瓷内胆长效质保'];
  }
  function certBlock(p){
    var list=certList(p); if(!list.length) return '';
    return '<section class="section"><div class="container">'
      +'<div class="section-head"><div class="eyebrow">认证与能效</div><h2>合规与品质保障</h2></div>'
      +'<div class="cert-band">'+list.map(function(c){return '<span class="cert-chip"><span class="cert-tick">✓</span>'+e(c)+'</span>';}).join('')+'</div>'
      +'</div></section>';
  }

  /* 资料下载：规格书走浏览器打印/另存 PDF（真实可用，无占位文件） */
  function docBlock(p){
    var docs = manualPdfs(p);
    var resourcesUrl = BASE+'/professionals/'+(p.cat==='commercial'?'commercial':'residential')+'/resources/';
    if(docs.length){
      return '<section class="section section-alt"><div class="container">'
        +'<div class="section-head"><div class="eyebrow">资料下载</div><h2>技术资料</h2>'
        +'<p>产品说明 PDF 来自后台上传，可直接预览或下载。</p></div>'
        +'<div class="doc-actions">'
        +docs.map(function(doc){ return '<a class="btn btn-brand" href="'+e(doc.url)+'" target="_blank" rel="noopener noreferrer">下载 '+e(doc.filename)+'</a>'; }).join('')
        +'<a class="btn btn-outline" href="'+resourcesUrl+'">经销商资料库</a>'
        +'</div></div></section>';
    }
    return '<section class="section section-alt"><div class="container">'
      +'<div class="section-head"><div class="eyebrow">资料下载</div><h2>技术资料</h2>'
      +'<p>产品说明 PDF 尚未上传，安装手册、BIM/CAD 选型资料请向授权经销商索取。</p></div>'
      +'<div class="doc-actions">'
      +'<a class="btn btn-outline" href="'+resourcesUrl+'">经销商资料库</a>'
      +'</div></div></section>';
  }

  /* 常见问题：每款产品自动生成 + 可用 faqs:[] 覆盖；附 FAQPage 结构化数据 */
  function faqList(p){
    if(p.faqs&&p.faqs.length) return p.faqs;
    var arr=[]; var hi=(p.highlights||[]);
    if(hi.length){ arr.push({q:p.name+' 的关键性能参数是多少？',a:hi.map(function(h){return h.label+'：'+h.value;}).join('；')+'。'}); }
    var f0=(p.features||[])[0]; if(f0){ arr.push({q:'什么是'+f0.title+'？',a:f0.desc}); }
    arr.push({q:'如何购买与安装 '+p.name+'？',a:'恒热授权经销商提供免费上门勘测、选型设计与安装服务，点击「查找授权经销商」即可预约。'});
    arr.push({q:p.name+' 提供怎样的质保？',a:'恒热产品享受厂家质保，具体年限以产品保修政策与设备铭牌为准，详见保修政策页。'});
    return arr;
  }
  function faqBlock(p){
    var list=faqList(p); if(!list.length) return '';
    return '<section class="section"><div class="container narrow">'
      +'<div class="section-head"><div class="eyebrow">常见问题</div><h2>关于 '+e(p.name)+'</h2></div>'
      +'<div class="faq-list">'+list.map(function(f){
        return '<details class="faq-item"><summary>'+e(f.q)+'</summary><div class="faq-a">'+e(f.a)+'</div></details>';
      }).join('')+'</div></div></section>';
  }
  function injectFaqLd(p){
    try{
      var list=faqList(p); if(!list.length) return;
      var ld={"@context":"https://schema.org","@type":"FAQPage","mainEntity":list.map(function(f){
        return {"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}};
      })};
      var sc=document.createElement('script');sc.type='application/ld+json';sc.text=JSON.stringify(ld);
      document.head.appendChild(sc);
    }catch(_){}
  }

  // D2 定位消费（P3）：渲染产品定位的自由文本部分（价值主张/痛点/场景）。
  // 受控词维度（卖给谁/市场等）为 code，此处只消费无需映射的中文自由文本，保持站点自洽。
  function positioningBlock(p){
    var pos=p&&p.positioning; if(!pos) return '';
    var vp=pos.valueProposition||'', pains=pos.painPoints||[], scn=pos.scenarios||[];
    if(!vp && !pains.length && !scn.length) return '';
    var html='<section class="section"><div class="container">'
      +'<div class="section-head"><div class="eyebrow">为谁而生</div><h2>'+e(p.name)+' 的定位</h2></div>';
    if(vp){ html+='<p class="pd-value-prop">'+e(vp)+'</p>'; }
    if(pains.length){ html+='<h4 class="pd-pos-h">解决的痛点</h4><ul class="pd-pos-list">'+pains.map(function(x){return '<li>'+e(x)+'</li>';}).join('')+'</ul>'; }
    if(scn.length){ html+='<h4 class="pd-pos-h">适用场景</h4><ul class="pd-pos-list">'+scn.map(function(x){return '<li>'+e(x)+'</li>';}).join('')+'</ul>'; }
    html+='</div></section>';
    return html;
  }

  function renderDetail(){
    var host=document.querySelector('[data-product-detail]');
    if(!host) return;
    var slug=(new URLSearchParams(location.search)).get('model');
    var p=slug?window.EVERHOT_CATALOG.one(slug):null;
    if(!p && slug && window.EVERHOT_LOAD_PRODUCT && !host.getAttribute('data-single-load-tried')){
      host.setAttribute('data-single-load-tried','1');
      window.EVERHOT_LOAD_PRODUCT(slug).then(function(item){
        if(item) renderDetail();
        else renderDetail();
      });
      return;
    }
    if(!p){
      host.innerHTML='<section class="page-hero"><div class="container"><div class="eyebrow">产品中心</div>'
        +'<h1>未找到该产品</h1><p>请返回产品中心选择具体型号。</p></div></section>'
        +'<section class="section"><div class="container"><a class="btn btn-brand btn-lg" href="'+BASE+'/products/">返回产品中心</a></div></section>';
      return;
    }
    var cn=catName(p);
    document.title=p.name+' | 恒热 Everhot';
    var html=''
      + '<section class="pd-hero"><div class="container pd-hero-inner">'
      +   '<div class="pd-hero-media">'+(imgSrc(p)?'<img src="'+e(imgSrc(p))+'" alt="'+e(p.name)+'" decoding="async" fetchpriority="high">':'<div class="pd-hero-art">'+art(p)+'</div>')+'</div>'
      +   '<div class="pd-hero-text">'
      +     '<div class="pd-crumb"><a href="'+BASE+'/">首页</a> / <a href="'+BASE+'/products/">产品中心</a> / <a href="'+cn.sysPath+'">'+e(cn.c+cn.s)+'</a></div>'
      +     badges(p)
      +     '<h1>'+e(p.name)+'</h1>'
      +     '<p class="pd-series">'+e(p.en)+' · '+e(p.series||'')+'</p>'
      +     '<p class="pd-tagline">'+e(p.tagline)+'</p>'
      +     '<div class="pd-hero-actions"><a class="btn btn-light btn-lg" href="'+BASE+'/find-a-pro/">预约经销商选型</a>'
      +       '<a class="btn btn-outline-light btn-lg" href="'+cn.sysPath+'">查看同类产品</a></div>'
      +   '</div></div></section>';

    if(window.EVERHOT_SHOW_PRODUCT_POSITIONING){ html+=positioningBlock(p); }
    if((p.highlights||[]).length){
      html+='<section class="pd-stats-band"><div class="container pd-stats">'+highlightStats(p)+'</div></section>';
    }
    if((p.features||[]).length){
      html+='<section class="section"><div class="container">'
        +'<div class="section-head"><div class="eyebrow">产品亮点</div><h2>为什么选择 '+e(p.name)+'</h2></div>'
        +'<div class="pf-grid">'+featureCards(p)+'</div></div></section>';
    }
    var sImg=specImg(p);
    if((p.specs||[]).length || sImg){
      html+='<section class="section section-alt" id="ev-specsheet"><div class="container">'
        +'<div class="section-head"><div class="eyebrow">技术规格</div><h2>规格参数</h2><p>具体型号与参数以经销商报价及产品铭牌为准（数据后台可更新）。</p></div>';
      if((p.specs||[]).length){ html+='<table class="spec-table"><tbody>'+specRows(p)+'</tbody></table>'; }
      if(sImg){ html+='<figure class="pd-specimg"><img src="'+e(sImg)+'" alt="'+e(p.name)+' 产品参数图" loading="lazy" decoding="async"><figcaption>厂商产品参数图，仅供参考</figcaption></figure>'; }
      html+='</div></section>';
    }
    html+=certBlock(p);
    html+=officialDetailBlock(p);
    html+=docBlock(p);
    html+=faqBlock(p);
    html+='<section class="section-cta"><div class="container"><h2>需要为您的项目选型？</h2>'
      +'<p>恒热授权经销商提供免费勘测、方案设计与报价。</p>'
      +'<a class="btn btn-light btn-lg" href="'+BASE+'/find-a-pro/">查找授权经销商</a></div></section>';
    html+=related(p);

    host.innerHTML=html;

    // 规格书下载：浏览器打印 / 另存 PDF（配合 @media print 样式）
    injectFaqLd(p);

    // 注入 Product JSON-LD（GEO 友好）
    try{
      var ld={"@context":"https://schema.org","@type":"Product","name":p.name,
        "brand":{"@type":"Brand","name":"Everhot 恒热"},
        "category":cn.c+cn.s,"description":p.tagline,
        "additionalProperty":(p.specs||[]).map(function(s){return {"@type":"PropertyValue","name":s.k,"value":s.v};})};
      var sc=document.createElement('script');sc.type='application/ld+json';sc.text=JSON.stringify(ld);
      document.head.appendChild(sc);
    }catch(_){}
  }

  /* 产品对比工具（超越 rheem：分类筛选 + 勾选最多 4 款并排对比规格） */
  function renderCompare(){
    var host=document.querySelector('[data-product-compare]');
    if(!host) return;
    var state={cat:'residential',sys:'water-heating',picked:[],diffOnly:false};
    var SYS={'water-heating':'热水系统','heating-cooling':'采暖制冷'};
    var CAT={'residential':'家用','commercial':'商用'};

    function pool(){ return window.EVERHOT_CATALOG.by(state.cat,state.sys); }
    function specKeys(list){
      var seen={},order=[];
      list.forEach(function(p){(p.specs||[]).forEach(function(s){ if(!(s.k in seen)){seen[s.k]=1;order.push(s.k);} });});
      return order;
    }
    function specVal(p,k){ var f=(p.specs||[]).filter(function(s){return s.k===k;})[0]; return f?f.v:'—'; }
    function rowDiffers(picks,k){
      var first=specVal(picks[0],k);
      for(var i=1;i<picks.length;i++){ if(specVal(picks[i],k)!==first) return true; }
      return false;
    }

    // ---- shareable deep-link: ?cat=&sys=&pick=a,b,c&diff=1 ----
    function readUrl(){
      try{
        var q=new URLSearchParams(location.search);
        if(CAT[q.get('cat')]) state.cat=q.get('cat');
        if(SYS[q.get('sys')]) state.sys=q.get('sys');
        state.diffOnly=q.get('diff')==='1';
        var pk=(q.get('pick')||'').split(',').map(function(s){return s.trim();}).filter(Boolean);
        var valid=pk.filter(function(sl){return !!window.EVERHOT_CATALOG.one(sl);}).slice(0,4);
        if(valid.length) state.picked=valid;
      }catch(_){}
    }
    function syncUrl(){
      try{
        var q=new URLSearchParams();
        q.set('cat',state.cat); q.set('sys',state.sys);
        if(state.picked.length) q.set('pick',state.picked.join(','));
        if(state.diffOnly) q.set('diff','1');
        history.replaceState(null,'',location.pathname+'?'+q.toString());
      }catch(_){}
    }

    function draw(){
      syncUrl();
      var list=pool();
      var picks=state.picked.map(function(sl){return window.EVERHOT_CATALOG.one(sl);}).filter(Boolean);
      var h='';
      // controls
      h+='<div class="cmp-controls">';
      h+='<div class="cmp-seg" data-seg="cat">'+Object.keys(CAT).map(function(c){return '<button class="cmp-seg-btn'+(state.cat===c?' is-on':'')+'" data-cat="'+c+'">'+e(CAT[c])+'</button>';}).join('')+'</div>';
      h+='<div class="cmp-seg" data-seg="sys">'+Object.keys(SYS).map(function(sy){return '<button class="cmp-seg-btn'+(state.sys===sy?' is-on':'')+'" data-sys="'+sy+'">'+e(SYS[sy])+'</button>';}).join('')+'</div>';
      h+='<label class="cmp-toggle'+(state.diffOnly?' is-on':'')+'"><input type="checkbox" data-diff'+(state.diffOnly?' checked':'')+'><span>只看差异</span></label>';
      h+='<button class="cmp-share" data-share type="button">复制对比链接</button>';
      h+='<span class="cmp-hint">勾选最多 4 款产品并排对比（已选 '+picks.length+'/4）</span>';
      h+='</div>';
      // pick chips
      h+='<div class="cmp-pick-grid">'+list.map(function(p){
        var on=state.picked.indexOf(p.slug)>-1;
        return '<label class="cmp-pick'+(on?' is-on':'')+'"><input type="checkbox" data-slug="'+e(p.slug)+'"'+(on?' checked':'')+'><span class="cmp-pick-ic">'+prodIco(p)+'</span><span class="cmp-pick-name">'+e(p.name)+'</span></label>';
      }).join('')+'</div>';
      // table
      if(picks.length){
        var keys=specKeys(picks);
        var canDiff=picks.length>1;
        var shown=keys.filter(function(k){ return !(state.diffOnly&&canDiff)||rowDiffers(picks,k); });
        h+='<div class="cmp-table-wrap"><table class="cmp-table"><thead><tr><th>规格</th>'+picks.map(function(p){return '<th><a href="'+BASE+'/products/detail/?model='+e(p.slug)+'">'+e(p.name)+'</a><span class="cmp-th-series">'+e(p.series||'')+'</span></th>';}).join('')+'</tr></thead><tbody>';
        h+='<tr><th>一句话卖点</th>'+picks.map(function(p){return '<td>'+e(p.tagline)+'</td>';}).join('')+'</tr>';
        shown.forEach(function(k){
          var diff=canDiff&&rowDiffers(picks,k);
          h+='<tr'+(diff?' class="cmp-row-diff"':'')+'><th>'+e(k)+(diff?'<span class="cmp-diff-dot" title="各产品存在差异"></span>':'')+'</th>'+picks.map(function(p){return '<td>'+e(specVal(p,k))+'</td>';}).join('')+'</tr>';
        });
        if(state.diffOnly&&canDiff&&!shown.length){ h+='<tr><td colspan="'+(picks.length+1)+'" class="cmp-empty" style="padding:18px">所选产品在已收录规格上完全一致。</td></tr>'; }
        h+='<tr><th></th>'+picks.map(function(p){return '<td><a class="btn btn-brand" style="font-size:12px;padding:7px 14px" href="'+BASE+'/products/detail/?model='+e(p.slug)+'">查看详情</a></td>';}).join('')+'</tr>';
        h+='</tbody></table></div>';
      } else {
        h+='<div class="cmp-empty">请在上方勾选要对比的产品。</div>';
      }
      host.innerHTML=h;

      host.querySelectorAll('[data-cat]').forEach(function(b){b.addEventListener('click',function(){state.cat=b.getAttribute('data-cat');state.picked=[];draw();});});
      host.querySelectorAll('[data-sys]').forEach(function(b){b.addEventListener('click',function(){state.sys=b.getAttribute('data-sys');state.picked=[];draw();});});
      var diffBox=host.querySelector('[data-diff]');
      if(diffBox) diffBox.addEventListener('change',function(){state.diffOnly=diffBox.checked;draw();});
      var shareBtn=host.querySelector('[data-share]');
      if(shareBtn) shareBtn.addEventListener('click',function(){
        var url=location.href;
        var done=function(){var t=shareBtn.textContent;shareBtn.textContent='已复制链接 ✓';shareBtn.classList.add('is-ok');setTimeout(function(){shareBtn.textContent=t;shareBtn.classList.remove('is-ok');},1600);};
        if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(url).then(done,done); }
        else { try{var ta=document.createElement('textarea');ta.value=url;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);done();}catch(_){} }
      });
      host.querySelectorAll('input[data-slug]').forEach(function(cb){cb.addEventListener('change',function(){
        var sl=cb.getAttribute('data-slug');
        if(cb.checked){ if(state.picked.length>=4){cb.checked=false;return;} if(state.picked.indexOf(sl)<0)state.picked.push(sl); }
        else { state.picked=state.picked.filter(function(x){return x!==sl;}); }
        draw();
      });});
    }
    // hydrate from URL, else preselect first two for an instant non-empty view
    readUrl();
    if(!state.picked.length){ state.picked=pool().slice(0,2).map(function(p){return p.slug;}); }
    draw();
  }

  function renderLoading(){
    document.querySelectorAll('[data-catalog],[data-featured]').forEach(function(g){ g.innerHTML=loadingState(); });
    var detail=document.querySelector('[data-product-detail]');
    if(detail) detail.innerHTML='';
    var compare=document.querySelector('[data-product-compare]');
    if(compare) compare.innerHTML=loadingState();
  }
  function boot(){ installCatalog(); renderGrids(); renderDetail(); renderCompare(); }
  function start(){
    installCatalog();
    renderLoading();
    loadRuntimeProducts().then(function(){ boot(); });
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',start); }
  else { start(); }
})();
