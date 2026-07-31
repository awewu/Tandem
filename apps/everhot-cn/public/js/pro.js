/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 专业人士专区功能模块（可替换数据层）
   挂载式组件：
     [data-pro-lookup="residential|commercial|all"]  产品选型查询
     [data-doc-library="residential|commercial|all"]  技术文档库
     [data-resource-library="..."]                    设计资源库
     [data-course-catalog]                            培训课程
     [data-solutions]                                 商用解决方案库
   依赖 products-data.js。资料为占位条目，上线替换 url 即可。
   ═══════════════════════════════════════════════════════════ */
(function () {
  var BASE='';
  function e(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function productsReady(){
    if(typeof window.EVERHOT_LOAD_PRODUCTS==='function') return window.EVERHOT_LOAD_PRODUCTS();
    return window.EVERHOT_PRODUCTS_READY || Promise.resolve(false);
  }

  window.EVERHOT_DOCS = window.EVERHOT_DOCS || [
    {title:"EverWarm 冷凝壁挂炉 安装手册", cat:"residential", type:"安装手册", fmt:"PDF", size:"2.4 MB", url:"#"},
    {title:"EverWarm 冷凝壁挂炉 用户说明书", cat:"residential", type:"用户说明书", fmt:"PDF", size:"1.8 MB", url:"#"},
    {title:"EverFlow 零冷水热水器 安装手册", cat:"residential", type:"安装手册", fmt:"PDF", size:"2.1 MB", url:"#"},
    {title:"EverAir 家用空气能 维护保养指南", cat:"residential", type:"维护指南", fmt:"PDF", size:"1.5 MB", url:"#"},
    {title:"家用产品 全系样本画册 2026", cat:"residential", type:"产品样本", fmt:"PDF", size:"12.6 MB", url:"#"},
    {title:"EverMax 商用燃气热水炉 技术手册", cat:"commercial", type:"技术手册", fmt:"PDF", size:"4.2 MB", url:"#"},
    {title:"EverStation 楼宇集中热水站 设计选型手册", cat:"commercial", type:"设计选型", fmt:"PDF", size:"6.8 MB", url:"#"},
    {title:"商用空气能机组 BACnet/Modbus 通信协议", cat:"commercial", type:"通信协议", fmt:"PDF", size:"0.9 MB", url:"#"},
    {title:"商用产品 工程选型样本 2026", cat:"commercial", type:"产品样本", fmt:"PDF", size:"18.3 MB", url:"#"},
    {title:"EverModule 商用中央空调 安装调试规范", cat:"commercial", type:"安装规范", fmt:"PDF", size:"3.7 MB", url:"#"}
  ];
  window.EVERHOT_RESOURCES = window.EVERHOT_RESOURCES || [
    {title:"EverMax 系列 BIM 族库 (Revit .rfa)", cat:"commercial", type:"BIM/Revit", fmt:"RFA", size:"8.1 MB", url:"#"},
    {title:"商用机房 CAD 图块库", cat:"commercial", type:"CAD 图块", fmt:"DWG", size:"5.4 MB", url:"#"},
    {title:"楼宇热力站 典型系统原理图", cat:"commercial", type:"系统图", fmt:"PDF", size:"2.2 MB", url:"#"},
    {title:"家用全屋舒适系统 方案模板", cat:"residential", type:"方案模板", fmt:"PPTX", size:"6.0 MB", url:"#"},
    {title:"恒热品牌 VI 与销售物料包", cat:"residential", type:"营销物料", fmt:"ZIP", size:"22.5 MB", url:"#"}
  ];
  window.EVERHOT_COURSES = window.EVERHOT_COURSES || [
    {title:"冷凝壁挂炉 安装与调试 认证课", level:"初级", mode:"线上", hours:"3 课时", desc:"从安装规范、烟道布置到首次点火调试的标准流程。"},
    {title:"零冷水系统 设计与故障排查", level:"中级", mode:"线上", hours:"4 课时", desc:"循环管路设计、循环泵选型与常见故障定位。"},
    {title:"商用集中热水站 设计选型实战", level:"高级", mode:"线下", hours:"2 天", desc:"负荷计算、主备冗余、BACnet 楼控集成的工程实战。"},
    {title:"空气能热泵 低温运行与能效优化", level:"中级", mode:"线上", hours:"3 课时", desc:"喷气增焓原理、低温衰减控制与 COP 优化。"},
    {title:"恒热智能联控 EverLink 配置认证", level:"初级", mode:"线上", hours:"2 课时", desc:"网关配置、分区联动与远程运维平台接入。"}
  ];
  window.EVERHOT_SOLUTIONS = window.EVERHOT_SOLUTIONS || [
    {name:"酒店 / 公寓", icon:"commercial", desc:"高并发连续热水 + 主备冗余，满足客房高峰用水。", points:["EverMax 大功率热水炉","N+1 冗余配置","分户计量与楼控联动"]},
    {name:"学校 / 厂房", icon:"floor", desc:"大面积集中采暖 + 大流量生活热水，运行经济。", points:["EverBoiler 商用采暖炉","EverTank 储热水箱","级联节能控制"]},
    {name:"医院 / 养老", icon:"control", desc:"24h 不间断供热，防军团菌，安全合规。", points:["高温杀菌程序","主备自动切换","EverWatch 远程监控"]},
    {name:"综合体 / 写字楼", icon:"ac", desc:"采暖制冷新风一体，BAS 深度集成，集中调度。", points:["EverModule 模块机组","EverFresh 新风","EverControl 楼宇智控"]}
  ];

  /* ---------- 产品选型查询 ---------- */
  function renderLookup(host){
    var scope=host.getAttribute('data-pro-lookup')||'all';
    var all=(window.EVERHOT_PRODUCTS||[]).filter(function(p){return scope==='all'||p.cat===scope;});
    var systems=[]; all.forEach(function(p){ if(systems.indexOf(p.sys)<0&&p.sys) systems.push(p.sys); });
    var sysName={'water-heating':'热水','heating-cooling':'采暖制冷','air':'空气品质'};
    var state={q:'',sys:''};
    function results(){
      return all.filter(function(p){
        var hay=(p.name+' '+p.en+' '+(p.series||'')+' '+(p.tagline||'')+' '+(p.specs||[]).map(function(s){return s.k+s.v;}).join(' ')).toLowerCase();
        return (!state.q||hay.indexOf(state.q.toLowerCase())>-1) && (!state.sys||p.sys===state.sys);
      });
    }
    function row(p){
      var spec=(p.specs||[]).slice(0,2).map(function(s){return e(s.k)+' '+e(s.v);}).join(' · ');
      return '<a class="pl-row" href="'+BASE+'/products/detail/'+e(p.slug)+'/">'
        +'<span class="pl-name">'+e(p.name)+'<small>'+e(p.en||'')+'</small></span>'
        +'<span class="pl-series">'+e(p.series||'')+'</span>'
        +'<span class="pl-spec">'+spec+'</span>'
        +'<span class="pl-go">查看 →</span></a>';
    }
    function draw(){
      var list=results(),h='';
      h+='<form class="pl-filters" role="search" onsubmit="return false">';
      h+='<input type="search" class="dl-search" placeholder="按型号 / 系列 / 参数搜索" value="'+e(state.q)+'" aria-label="搜索产品">';
      h+='<select class="dl-select" aria-label="按系统筛选"><option value="">全部系统</option>'+systems.map(function(s){return '<option value="'+e(s)+'"'+(state.sys===s?' selected':'')+'>'+e(sysName[s]||s)+'</option>';}).join('')+'</select>';
      h+='</form>';
      h+='<p class="dl-count">匹配 <strong>'+list.length+'</strong> 款产品</p>';
      h+='<div class="pl-list">'+(list.length?list.map(row).join(''):'<div class="dl-empty"><p>未找到匹配产品，请调整关键词。</p></div>')+'</div>';
      host.innerHTML=h;
      host.querySelector('.dl-search').addEventListener('input',function(){state.q=this.value;draw();});
      host.querySelector('.dl-select').addEventListener('change',function(){state.sys=this.value;draw();});
    }
    draw();
  }

  /* ---------- 文档 / 资源库 ---------- */
  function renderLib(host, data, scopeAttr){
    var scope=host.getAttribute(scopeAttr)||'all';
    var all=data.filter(function(d){return scope==='all'||d.cat===scope;});
    var types=[]; all.forEach(function(d){ if(types.indexOf(d.type)<0) types.push(d.type); });
    var state={q:'',type:''};
    function results(){
      return all.filter(function(d){
        return (!state.q||(d.title.toLowerCase().indexOf(state.q.toLowerCase())>-1)) && (!state.type||d.type===state.type);
      });
    }
    function row(d){
      return '<a class="doc-row" href="'+e(d.url||'#')+'"'+((d.url&&d.url!=='#')?' target="_blank" rel="noopener"':'')+'>'
        +'<span class="doc-ic">'+e(d.fmt||'PDF')+'</span>'
        +'<span class="doc-main"><span class="doc-title">'+e(d.title)+'</span>'
        +'<span class="doc-meta">'+e(d.type)+' · '+e(d.size||'')+'</span></span>'
        +'<span class="doc-dl">下载 ↓</span></a>';
    }
    function draw(){
      var list=results(),h='';
      h+='<form class="pl-filters" role="search" onsubmit="return false">';
      h+='<input type="search" class="dl-search" placeholder="搜索文档名称" value="'+e(state.q)+'" aria-label="搜索文档">';
      h+='<select class="dl-select" aria-label="按类型筛选"><option value="">全部类型</option>'+types.map(function(t){return '<option value="'+e(t)+'"'+(state.type===t?' selected':'')+'>'+e(t)+'</option>';}).join('')+'</select>';
      h+='</form>';
      h+='<p class="dl-count">共 <strong>'+list.length+'</strong> 份资料</p>';
      h+='<div class="doc-list">'+(list.length?list.map(row).join(''):'<div class="dl-empty"><p>暂无匹配资料。</p></div>')+'</div>';
      h+='<p class="ev-form-note" style="margin-top:14px">资料链接为占位，正式 PDF/文件上线后将自动可下载。</p>';
      host.innerHTML=h;
      host.querySelector('.dl-search').addEventListener('input',function(){state.q=this.value;draw();});
      host.querySelector('.dl-select').addEventListener('change',function(){state.type=this.value;draw();});
    }
    draw();
  }

  /* ---------- 培训课程 ---------- */
  function renderCourses(host){
    var data=window.EVERHOT_COURSES||[];
    host.innerHTML='<div class="course-grid">'+data.map(function(c){
      return '<article class="course-card">'
        +'<div class="course-top"><span class="course-level course-'+(c.level==='高级'?'adv':c.level==='中级'?'mid':'beg')+'">'+e(c.level)+'</span>'
        +'<span class="course-mode">'+e(c.mode)+' · '+e(c.hours)+'</span></div>'
        +'<h3>'+e(c.title)+'</h3><p>'+e(c.desc)+'</p>'
        +'<a class="btn btn-brand course-btn" href="'+BASE+'/contact/">报名 / 咨询</a></article>';
    }).join('')+'</div>';
  }

  /* ---------- 商用解决方案 ---------- */
  function renderSolutions(host){
    var data=window.EVERHOT_SOLUTIONS||[];
    var artFn=window.EVERHOT_ART;
    host.innerHTML='<div class="sol-grid">'+data.map(function(s){
      var art=artFn?artFn({slug:s.icon,cat:'commercial',name:s.icon}):'';
      return '<article class="sol-card"><div class="sol-art">'+art+'</div>'
        +'<div class="sol-body"><h3>'+e(s.name)+'</h3><p>'+e(s.desc)+'</p>'
        +'<ul>'+(s.points||[]).map(function(p){return '<li>'+e(p)+'</li>';}).join('')+'</ul></div></article>';
    }).join('')+'</div>';
  }

  function boot(){
    document.querySelectorAll('[data-pro-lookup]').forEach(renderLookup);
    document.querySelectorAll('[data-doc-library]').forEach(function(h){renderLib(h, window.EVERHOT_DOCS, 'data-doc-library');});
    document.querySelectorAll('[data-resource-library]').forEach(function(h){renderLib(h, window.EVERHOT_RESOURCES, 'data-resource-library');});
    document.querySelectorAll('[data-course-catalog]').forEach(renderCourses);
    document.querySelectorAll('[data-solutions]').forEach(renderSolutions);
  }
  function start(){ productsReady().then(boot, boot); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',start); }
  else { start(); }
})();
