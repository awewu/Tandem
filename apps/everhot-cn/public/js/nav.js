/* Everhot unified mega-nav — three-audience model mirroring rheem.com */
(function () {
  var BASE = '';

  /* 埋点单点接入：全站(58 页)经 nav.js 载入合规统计，无第三方、DNT/同意可控 */
  (function(){ var s=document.createElement('script'); s.src=BASE+'/js/analytics.js'; s.defer=true; (document.head||document.documentElement).appendChild(s); })();

  /* ── 统一线性图标系统（替代 emoji，提升 VI 调性，currentColor 描边）── */
  var ICON_PATHS = {
    flame:'<path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-1.6.6-2.8 1.5-3.7C8.8 9 9 10 10 10.5 9.6 8 11 5 12 3z"/>',
    drop:'<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    thermo:'<path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
    fan:'<circle cx="12" cy="12" r="2.1"/><path d="M12 9.9C12 6.2 13.4 4 15.8 4c1.2 2-.2 4.6-3.8 5.9zM14.1 12c3.7 0 5.9 1.4 5.9 3.8-2 1.2-4.6-.2-5.9-3.8zM12 14.1c0 3.7-1.4 5.9-3.8 5.9-1.2-2 .2-4.6 3.8-5.9zM9.9 12C6.2 12 4 10.6 4 8.2c2-1.2 4.6.2 5.9 3.8z"/>',
    home:'<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/>',
    building:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2m2 0h2M9 11h2m2 0h2M9 15h2m2 0h2"/>',
    tools:'<path d="M14.6 6.3a3.4 3.4 0 0 0-4.5 4.2l-5.3 5.3a1.5 1.5 0 1 0 2.1 2.1l5.3-5.3a3.4 3.4 0 0 0 4.4-4.4l-2.1 2.1-2-2z"/>',
    shield:'<path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    award:'<circle cx="12" cy="9" r="5"/><path d="M8.5 13L7 21l5-2.7L17 21l-1.5-8"/>',
    bolt:'<path d="M13 3L5 13h5l-1 8 8-11h-5z"/>',
    pin:'<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/>',
    globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/>',
    factory:'<path d="M4 21V10l6 4V10l6 4V6h4v15z"/><path d="M4 21h17"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3 3 0 0 1 0 5.8M20.5 20a5.5 5.5 0 0 0-4.5-5.4"/>',
    phone:'<path d="M6 3h3l2 5-2 1.4a11 11 0 0 0 5 5L17 12l5 2v3a2 2 0 0 1-2.1 2A16 16 0 0 1 4 5.1 2 2 0 0 1 6 3z"/>',
    leaf:'<path d="M5 19c0-8 6-13 14-13 0 8-5 14-13 14 0-3 2-6 6-8"/>',
    smart:'<path d="M5 12.5a10 10 0 0 1 14 0M8 15.4a6 6 0 0 1 8 0"/><circle cx="12" cy="18.6" r="1.1" fill="currentColor" stroke="none"/>',
    star:'<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.9 7.2 19l.9-5.4L4.2 9.7l5.4-.8z"/>',
    person:'<circle cx="12" cy="7.5" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2-2.5 3.6"/><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none"/>',
    gift:'<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11"/><path d="M12 9S10 3 7.5 4.2 9 9 12 9zM12 9s2-6 4.5-4.8S15 9 12 9z"/>'
  };
  function ico(name){
    var p=ICON_PATHS[name]; if(!p) return '';
    return '<svg class="ev-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
  }
  function upgradeIcons(root){
    (root||document).querySelectorAll('[data-ico]').forEach(function(el){
      if(el.dataset.icoDone) return; var s=ico(el.dataset.ico); if(s){ el.innerHTML=s; el.dataset.icoDone='1'; }
    });
  }
  window.EVERHOT_ICON=ico; window.EVERHOT_upgradeIcons=upgradeIcons;
  var menus = [
    { id:'homeowners', label:'家用', label_en:'Homeowners', cols:[
      { head:'采暖与制冷', items:[['家用中央空调','products/residential/heating-cooling/air-conditioning/'],['地暖系统','products/residential/heating-cooling/underfloor-heating/'],['全热新风','products/residential/heating-cooling/fresh-air/'],['地源热泵','products/residential/heating-cooling/geothermal/']]},
      { head:'热水系统', items:[['燃气冷凝壁挂炉','products/residential/water-heating/condensing-boiler/'],['零冷水燃气热水器','products/residential/water-heating/zero-cold-water/'],['空气能热水器','products/residential/water-heating/heat-pump/'],['容积式燃气热水器','products/residential/water-heating/?series=容积式'],['电热水器','products/residential/water-heating/electric/'],['采暖热水两联供','products/residential/water-heating/combo/']]},
      { head:'工具与资源 Resources', items:[['智能选型向导','products/selector/'],['产品对比工具','products/compare/'],['常见问题 FAQ','faqs/'],['保修与注册','warranty/'],['节能补贴','rebates/'],['支持中心','support/']]},
      { head:'精选产品创新', featured:true, cards:[
        ['EverComfort™ 系列','全屋采暖·热水·制冷一体','products/residential/','home'],
        ['零冷水燃气热水器','即开即热 · 告别等待','products/residential/water-heating/zero-cold-water/','flame'],
        ['空气能采暖热泵','超低能耗 · 一机多用','products/residential/heating-cooling/','fan']
      ], cta:['智能选型向导','products/selector/'], warranty:true }
    ]},
    { id:'commercial', label:'商用', label_en:'Commercial', cols:[
      { head:'商用采暖与制冷', items:[['商用风冷热泵机组','products/commercial/heating-cooling/air-source-heat-pump/'],['商用中央空调（模块机）','products/commercial/heating-cooling/modular-chiller/'],['商用燃气采暖炉','products/commercial/heating-cooling/gas-boiler/'],['商用新风机组','products/commercial/heating-cooling/fresh-air/'],['楼宇智能控制','products/commercial/heating-cooling/?series=楼宇智控'],['预防性维护服务','products/commercial/heating-cooling/?series=运维服务']]},
      { head:'商用热水系统', items:[['大功率燃气热水炉','products/commercial/water-heating/high-capacity/'],['商用空气能机组','products/commercial/water-heating/air-source/'],['大容积储热水箱','products/commercial/water-heating/storage-tank/'],['楼宇集中热水站','products/commercial/water-heating/central-station/'],['串联备用系统','products/commercial/water-heating/?series=主备热备'],['远程运维平台','products/commercial/water-heating/?series=数字运维']]},
      { head:'工具与资源', items:[['智能选型向导','products/selector/'],['产品对比工具','products/compare/'],['BIM/CAD 资料库','professionals/commercial/resources/'],['选型计算工具','professionals/commercial/product-lookup/'],['技术支持文档','professionals/commercial/documentation/']]}
    ]},
    { id:'professionals', label:'专业人士', label_en:'Professionals', cols:[
      { head:'住宅产品（经销商）', items:[['产品查询','professionals/residential/product-lookup/'],['技术文档','professionals/residential/documentation/'],['经销商资源库','professionals/residential/resources/'],['培训中心','professionals/residential/training/'],['合作伙伴计划','professionals/residential/partner-programs/']]},
      { head:'商用产品（经销商）', items:[['产品查询','professionals/commercial/product-lookup/'],['技术支持文档','professionals/commercial/documentation/'],['解决方案库','professionals/commercial/solutions/'],['培训中心','professionals/commercial/training/'],['BIM/Revit 资料','professionals/commercial/resources/']]},
      { head:'推荐资源', featured:true, cards:[
        ['查找经销商网点','就近授权安装与服务','find-a-pro/','pin'],
        ['授权经销商申请','加入恒热合作网络','professionals/residential/partner-programs/','people'],
        ['技术热线 400-888-8888','工作日 8:30–18:00','support/','phone']
      ], cta:['进入专业人士中心','professionals/'] }
    ]},
    { id:'about', label:'关于恒热', label_en:'About', cols:[
      { head:'公司介绍', items:[['关于恒热','about/'],['品质与可靠性','reliability/'],['可持续发展','sustainability/'],['创新科技','innovation/'],['加入恒热','careers/'],['新闻动态','about/']]},
      { head:'联系与支持', items:[['支持中心','support/'],['联系我们','contact/'],['保修服务','warranty/'],['常见问题','faqs/'],['节能补贴','rebates/'],['金融分期','financing/'],['配件与正品','parts/'],['查找经销商','find-a-pro/']]}
    ]},
    { id:'support', label:'支持', label_en:'Support', cols:[
      { head:'售后服务', items:[['支持中心','support/'],['保修与注册','warranty/'],['常见问题 FAQ','faqs/'],['联系我们','contact/']]},
      { head:'购买支持', items:[['查找经销商','find-a-pro/'],['节能补贴','rebates/'],['金融分期','financing/'],['配件与正品','parts/']]},
      { head:'品牌责任', items:[['可持续发展','sustainability/'],['品质与可靠性','reliability/'],['创新科技','innovation/'],['关于恒热','about/']]},
      { head:'精选服务', featured:true, cards:[
        ['保修与注册','产品注册 · 保修查询','warranty/','shield'],
        ['节能补贴','国补以旧换新 · 地方政策','rebates/','gift'],
        ['帮助与支持','安装调试 · 日常维护','support/','help']
      ], cta:['查看支持中心','support/'] }
    ]},
  ];

  function e(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function buildNav(){
    // 极简地区条：仅身份再唤起 + 集团 + 地区（右对齐、安静灰底，支持入口已收进 masthead「支持」下拉）
    var h='<a class="ev-skip" href="#evMain">跳到主要内容</a>'
      +'<div class="ev-util-bar"><div class="container ev-util-inner ev-util-inner--min">'
      +'<a href="#" class="ev-aud-reopen" data-open-audience>为谁选购</a><span class="ev-div">|</span>'
      +'<a href="https://rhautt.com" class="ev-group-link">瑞合瑞德集团 &#8599;</a><span class="ev-div">|</span>'
      +'<span class="ev-util-locale">中国 · 简体中文</span>'
      +'</div></div>'
      +'<header class="ev-masthead"><div class="container ev-masthead-inner">'
      +'<a href="'+BASE+'/" class="ev-logo" aria-label="EVERHOT 恒热">'
      +'<img class="ev-logo-img" src="'+BASE+'/assets/img/brand/everhot-logo.png" alt="EVERHOT 恒热" width="124" height="48">'
      +'<span class="ev-logo-text"><span class="ev-logo-en">EVERHOT</span><span class="ev-logo-cn">恒热</span></span>'
      +'</a>'
      +'<nav class="ev-primary-nav">';

    menus.forEach(function(m){
      h+='<button class="ev-nav-item" data-menu="'+m.id+'" aria-expanded="false">'+e(m.label)
        +'<svg class="ev-chev" viewBox="0 0 10 6" width="10" height="6"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>';
    });

    h=h.replace('<nav class="ev-primary-nav">','<nav class="ev-primary-nav" aria-label="主导航">');
    h+='</nav><div class="ev-masthead-actions">'
      +'<a href="'+BASE+'/search/" class="ev-icon-btn ev-search-btn" aria-label="站内搜索"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6" stroke="currentColor" stroke-width="1.8"/><path d="M14 14l4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></a>'
      +'<a href="'+BASE+'/find-a-pro/" class="btn btn-brand ev-find-cta">查找经销商</a>'
      +'<button class="ev-burger" aria-label="打开菜单" aria-expanded="false" aria-controls="evMobileDrawer"><span></span><span></span><span></span></button>'
      +'</div>'
      +'</div><div class="ev-brand-line"></div>';

    menus.forEach(function(m){
      if(m.compact){
        h+='<div class="ev-mega ev-mega--compact" id="ev-mega-'+m.id+'"><div class="ev-mega-mini"><ul>';
        m.cols[0].items.forEach(function(it){
          h+='<li><a href="'+BASE+'/'+it[1]+'"><span class="ev-util-ic">'+ico(it[2])+'</span>'+e(it[0])+'</a></li>';
        });
        h+='</ul></div></div>';
        return;
      }
      h+='<div class="ev-mega" id="ev-mega-'+m.id+'"><div class="container ev-mega-inner">';
      m.cols.forEach(function(col){
        h+='<div class="ev-mega-col'+(col.featured?' ev-mega-featured':'')+'"><p class="ev-mega-head">'+e(col.head)+'</p>';
        if(col.cards){
          h+='<div class="ev-mega-cards">';
          col.cards.forEach(function(c){
            h+='<a class="ev-mega-card" href="'+BASE+'/'+c[2]+'">'
              +'<span class="ev-mega-card-ic" aria-hidden="true">'+ico(c[3])+'</span>'
              +'<span class="ev-mega-card-tx"><strong>'+e(c[0])+'</strong><em>'+e(c[1])+'</em></span>'
              +'<svg class="ev-mega-card-ar" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>';
          });
          h+='</div>';
          if(col.cta){ h+='<a class="ev-mega-cta" href="'+BASE+'/'+col.cta[1]+'">'+e(col.cta[0])+' &#8594;</a>'; }
          if(col.warranty){ h+='<a class="ev-mega-warranty" href="'+BASE+'/warranty/"><strong>保修与注册</strong><span>产品注册 · 保修查询</span></a>'; }
        } else {
          h+='<ul>';
          col.items.forEach(function(it){ h+='<li><a href="'+BASE+'/'+it[1]+'">'+e(it[0])+'</a></li>'; });
          h+='</ul>';
        }
        h+='</div>';
      });
      h+='</div></div>';
    });

    h+='</header>';

    // ===== Mobile drawer (accordion reusing the same menu data) =====
    h+='<div class="ev-drawer-scrim" id="evDrawerScrim"></div>'
      +'<aside class="ev-drawer" id="evMobileDrawer" aria-hidden="true">'
      +'<div class="ev-drawer-head"><span class="ev-drawer-title">菜单</span>'
      +'<button class="ev-drawer-close" aria-label="关闭菜单">&times;</button></div>'
      +'<form class="ev-drawer-search" action="'+BASE+'/search/" method="get" role="search">'
      +'<input type="search" name="q" placeholder="搜索产品 / 支持 / 经销商" aria-label="站内搜索">'
      +'<button type="submit" aria-label="搜索">搜索</button></form>'
      +'<nav class="ev-drawer-nav">';
    menus.forEach(function(m){
      h+='<div class="ev-acc"><button class="ev-acc-btn" aria-expanded="false">'+e(m.label)
        +'<svg class="ev-chev" viewBox="0 0 10 6" width="11" height="7"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>'
        +'<div class="ev-acc-panel">';
      m.cols.forEach(function(col){
        h+='<p class="ev-acc-head">'+e(col.head)+'</p><ul>';
        if(col.cards){
          col.cards.forEach(function(c){ h+='<li><a href="'+BASE+'/'+c[2]+'">'+e(c[0])+'</a></li>'; });
          if(col.cta){ h+='<li><a href="'+BASE+'/'+col.cta[1]+'">'+e(col.cta[0])+'</a></li>'; }
          if(col.warranty){ h+='<li><a href="'+BASE+'/warranty/">保修与注册</a></li>'; }
        } else {
          col.items.forEach(function(it){ h+='<li><a href="'+BASE+'/'+it[1]+'">'+e(it[0])+'</a></li>'; });
        }
        h+='</ul>';
      });
      h+='</div></div>';
    });
    h+='</nav>'
      +'<div class="ev-drawer-foot">'
      +'<a href="'+BASE+'/find-a-pro/" class="btn btn-brand" style="width:100%;text-align:center">查找经销商</a>'
      +'<a href="https://rhautt.com" class="ev-drawer-group">瑞合瑞德集团 &#8599;</a>'
      +'</div></aside>';

    // ===== Audience gateway overlay (rheem.com「Homeowners / Commercial / Professionals」) =====
    h+='<div class="ev-aud" id="evAudience" role="dialog" aria-modal="true" aria-labelledby="evAudTitle" hidden>'
      +'<div class="ev-aud-scrim" data-aud-dismiss></div>'
      +'<div class="ev-aud-modal">'
      +'<button class="ev-aud-close" data-aud-dismiss aria-label="关闭">&times;</button>'
      +'<div class="ev-aud-head"><img class="ev-aud-logo" src="'+BASE+'/assets/img/brand/everhot-logo-white.png" alt="EVERHOT 恒热" width="132" height="51">'
      +'<h2 id="evAudTitle">欢迎来到恒热</h2><p>请选择您的身份，为您呈现更合适的产品与服务。</p></div>'
      +'<div class="ev-aud-grid">'
      +audCard('homeowners','家用','Homeowners','热水 · 采暖 · 净水 · 制冷 · 空气全屋解决方案','home','products/residential/')
      +audCard('commercial','商用','Commercial','为酒店 · 公寓 · 综合体提供工程级方案','building','products/commercial/')
      +audCard('professionals','专业人士','Professionals','经销商与工程师：培训 · 技术资料 · 合作','tools','professionals/')
      +'</div>'
      +'<button class="ev-aud-skip" data-aud-dismiss>先随便逛逛 →</button>'
      +'</div></div>';
    // 常驻悬浮再唤起按钮（始终可见，第一视觉入口找得到）
    h+='<button class="ev-aud-fab" type="button" data-open-audience aria-label="为谁选购"><span class="ev-aud-fab-ic" aria-hidden="true">'+ico('home')+'</span>为谁选购</button>';
    return h;
  }

  function audCard(id,cn,en,desc,ic,href){
    return '<a class="ev-aud-card" data-aud="'+id+'" href="'+BASE+'/'+href+'">'
      +'<span class="ev-aud-ic" aria-hidden="true">'+ico(ic)+'</span>'
      +'<span class="ev-aud-cn">'+e(cn)+'</span>'
      +'<span class="ev-aud-en">'+e(en)+'</span>'
      +'<span class="ev-aud-desc">'+e(desc)+'</span>'
      +'<span class="ev-aud-go">进入 &#8594;</span></a>';
  }

  document.addEventListener('DOMContentLoaded',function(){
    var mount=document.getElementById('evNavMount');
    if(!mount) return;
    mount.innerHTML=buildNav();
    upgradeIcons(mount); upgradeIcons(document);

    // A11y: 把导航与页脚之间的正文包进 <main id="evMain">，作为 skip-link 目标与主地标
    try{
      if(!document.getElementById('evMain')){
        var footer=document.querySelector('footer.footer');
        var main=document.createElement('main');
        main.id='evMain'; main.setAttribute('tabindex','-1');
        var node=mount.nextSibling, moved=[];
        while(node && node!==footer){ moved.push(node); node=node.nextSibling; }
        moved.forEach(function(n){ main.appendChild(n); });
        if(footer) footer.parentNode.insertBefore(main, footer); else document.body.appendChild(main);
      }
      // 点击 skip-link 后把焦点移入正文（部分浏览器需显式聚焦）
      var skip=mount.querySelector('.ev-skip');
      if(skip) skip.addEventListener('click',function(){ var m=document.getElementById('evMain'); if(m){ m.focus(); } });
    }catch(_){}

    // 品牌 slogan：在结尾红场 CTA 末尾统一补一行（全站一致，免逐页改）
    document.querySelectorAll('.section-cta').forEach(function(cta){
      if(cta.querySelector('.cta-slogan')) return;
      var box=cta.querySelector('.container')||cta;
      var p=document.createElement('p');
      p.className='cta-slogan';
      p.textContent='大户型选恒热 · 多点用水没烦恼';
      box.appendChild(p);
    });

    function closeAll(){
      mount.querySelectorAll('.ev-nav-item').forEach(function(b){b.setAttribute('aria-expanded','false');});
      mount.querySelectorAll('.ev-mega').forEach(function(p){p.classList.remove('ev-mega--open');});
    }
    mount.querySelectorAll('.ev-nav-item').forEach(function(btn){
      btn.addEventListener('click',function(e){
        e.stopPropagation();
        var wasOpen=btn.getAttribute('aria-expanded')==='true';
        closeAll();
        if(!wasOpen){
          btn.setAttribute('aria-expanded','true');
          var panel=document.getElementById('ev-mega-'+btn.dataset.menu);
          if(panel) panel.classList.add('ev-mega--open');
        }
      });
    });
    document.addEventListener('click',closeAll);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeAll();});

    // ===== Mobile drawer logic =====
    var burger=mount.querySelector('.ev-burger');
    var drawer=mount.querySelector('#evMobileDrawer');
    var scrim=mount.querySelector('#evDrawerScrim');
    var closeBtn=mount.querySelector('.ev-drawer-close');

    function openDrawer(){
      if(!drawer) return;
      drawer.classList.add('is-open'); scrim.classList.add('is-open');
      drawer.setAttribute('aria-hidden','false');
      if(burger){burger.setAttribute('aria-expanded','true');burger.classList.add('is-active');}
      document.body.style.overflow='hidden';
    }
    function closeDrawer(){
      if(!drawer) return;
      drawer.classList.remove('is-open'); scrim.classList.remove('is-open');
      drawer.setAttribute('aria-hidden','true');
      if(burger){burger.setAttribute('aria-expanded','false');burger.classList.remove('is-active');}
      document.body.style.overflow='';
    }
    if(burger){burger.addEventListener('click',function(e){
      e.stopPropagation();
      if (drawer.classList.contains('is-open')) { closeDrawer(); } else { openDrawer(); }
    });}
    if(scrim){scrim.addEventListener('click',closeDrawer);}
    if(closeBtn){closeBtn.addEventListener('click',closeDrawer);}
    document.addEventListener('keydown',function(e){if(e.key==='Escape')closeDrawer();});

    // accordion inside drawer
    mount.querySelectorAll('.ev-acc-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        var open=btn.getAttribute('aria-expanded')==='true';
        btn.setAttribute('aria-expanded',open?'false':'true');
        var panel=btn.nextElementSibling;
        if(panel) panel.style.maxHeight=open?'':panel.scrollHeight+'px';
      });
    });
    // close drawer when a link is tapped
    mount.querySelectorAll('.ev-drawer-nav a, .ev-drawer-foot a').forEach(function(a){
      a.addEventListener('click',closeDrawer);
    });

    // ===== Audience gateway overlay logic =====
    var aud=mount.querySelector('#evAudience');
    function getStore(k){try{return localStorage.getItem(k);}catch(_){return null;}}
    function setStore(k,v){try{localStorage.setItem(k,v);}catch(_){}}
    function openAud(){ if(!aud) return; aud.hidden=false; document.body.style.overflow='hidden';
      var f=aud.querySelector('.ev-aud-card'); if(f) f.focus(); }
    function closeAud(){ if(!aud) return; aud.hidden=true; document.body.style.overflow='';
      setStore('ev_audience_seen','1'); }
    if(aud){
      // 仅首次访问弹出；已选择/已关闭过则不再打扰
      if(!getStore('ev_audience_seen')) setTimeout(openAud, 600);
      aud.querySelectorAll('[data-aud-dismiss]').forEach(function(el){
        el.addEventListener('click',function(ev){ ev.preventDefault(); closeAud(); });
      });
      aud.querySelectorAll('.ev-aud-card').forEach(function(card){
        card.addEventListener('click',function(){ setStore('ev_audience',card.dataset.aud); setStore('ev_audience_seen','1'); });
      });
      document.addEventListener('keydown',function(e){ if(e.key==='Escape' && !aud.hidden) closeAud(); });
    }
    // 常驻再唤起入口：顶栏「为谁选购」+ 任意 [data-open-audience] 元素
    mount.querySelectorAll('[data-open-audience]').forEach(function(el){
      el.addEventListener('click',function(ev){ ev.preventDefault(); openAud(); });
    });
    window.EVERHOT_openAudience=openAud;

    if(!document.querySelector('.ev-backtop')){
      var backTop=document.createElement('button');
      backTop.type='button';
      backTop.className='ev-backtop';
      backTop.setAttribute('aria-label','回到顶部');
      backTop.setAttribute('title','回到顶部');
      backTop.innerHTML='<span aria-hidden="true">↑</span>';
      backTop.addEventListener('click',function(){
        window.scrollTo({top:0,behavior:'smooth'});
      });
      document.body.appendChild(backTop);
      function updateBackTop(){
        backTop.classList.toggle('is-visible',window.scrollY>360);
      }
      updateBackTop();
      window.addEventListener('scroll',updateBackTop,{passive:true});
    }
  });
})();
