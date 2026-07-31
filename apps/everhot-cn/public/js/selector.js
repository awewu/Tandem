/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 引导式选型向导（超越 rheem：智能推荐）
   GUIDED PRODUCT SELECTOR.
   纯前端启发式打分：把用户答案映射到 window.EVERHOT_CATALOG，
   按关键词命中对产品评分，给出 Top 推荐 + 命中理由，
   并一键带入对比（深链）/ 详情 / 预约经销商。
   挂载点：<div data-product-selector></div>
   ═══════════════════════════════════════════════════════════ */
(function(){
  var BASE='';
  function e(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function iconImage(s){
    s=String(s||'');
    return /^https?:\/\//.test(s) || s.indexOf('/api/')===0 || s.indexOf('/assets/')===0 || s.indexOf('data:image/')===0;
  }
  function renderIcon(s, cls){
    return iconImage(s) ? '<img class="'+cls+'" src="'+e(s)+'" alt="" loading="lazy" decoding="async">' : e(s||'🔧');
  }
  function productsReady(){
    if(typeof window.EVERHOT_LOAD_PRODUCTS==='function') return window.EVERHOT_LOAD_PRODUCTS();
    return window.EVERHOT_PRODUCTS_READY || Promise.resolve(false);
  }
  function apiBase(){ return window.EVERHOT_API_BASE || ''; }
  function siteCode(){ return window.EVERHOT_SITE_CODE || 'everhot'; }

  // 关注点 → 关键词权重表（按系统区分）
  var PRIORITY={
    'water-heating':[
      {v:'save',   label:'省气 / 节能',      ic:'🍃', kw:['冷凝','节能','省气','热效率','一级','105','能效']},
      {v:'instant',label:'即开即热 / 零冷水', ic:'⚡', kw:['零冷水','即开','即热','循环','恒温','秒','s']},
      {v:'volume', label:'大水量 / 多卫浴',   ic:'🛁', kw:['大水量','升','l','容积','储热','落地','多']},
      {v:'quiet',  label:'安静 / 稳定',       ic:'🤫', kw:['静音','安静','稳定','恒温','调节','宽频']}
    ],
    'heating-cooling':[
      {v:'area',   label:'大面积 / 别墅',  ic:'🏡', kw:['别墅','大','㎡','面积','楼','地暖','两联供','两用']},
      {v:'eco',    label:'节能低耗',       ic:'🍃', kw:['节能','变频','能效','热泵','cop','省电','一级']},
      {v:'comfort',label:'静音舒适',       ic:'🛋️', kw:['静音','舒适','恒温','无风感','均匀','稳定']},
      {v:'smart',  label:'智能控制',       ic:'📱', kw:['智能','wifi','远程','app','控制','联动','watch']}
    ],
    'commercial':[
      {v:'hotwater',label:'大热水量 / 酒店公寓', ic:'🏨', kw:['热水','酒店','公寓','商用','大','吨','储热','容积']},
      {v:'central', label:'集中供热 / 楼宇',     ic:'🏢', kw:['楼宇','集中','热力站','模块','机房','换热','站']},
      {v:'retrofit',label:'节能改造',           ic:'♻️', kw:['节能','改造','变频','能效','热泵','回收']},
      {v:'monitor', label:'远程监控 / 运维',     ic:'📡', kw:['监控','远程','运维','bas','modbus','预警','平台','watch','care']}
    ]
  };
  // 规模问题（影响容量偏好）
  var SCALE={
    residential:{q:'家里常住人数 / 用水规模？',opts:[
      {v:'small',label:'1–2 人 · 1 卫',ic:'👤'},
      {v:'mid',  label:'3–4 人 · 2 卫',ic:'👨‍👩‍👧'},
      {v:'large',label:'5 人以上 / 别墅多卫',ic:'👨‍👩‍👧‍👦'}
    ]},
    commercial:{q:'项目规模？',opts:[
      {v:'small',label:'小型商铺 / 民宿',ic:'🏪'},
      {v:'mid',  label:'酒店 / 公寓 / 学校',ic:'🏨'},
      {v:'large',label:'大型楼宇 / 工业',ic:'🏭'}
    ]}
  };

  function haystack(p){
    var parts=[p.name,p.en,p.series,p.tagline];
    (p.badges||[]).forEach(function(b){parts.push(b);});
    (p.highlights||[]).forEach(function(h){parts.push(h.label,h.value);});
    (p.features||[]).forEach(function(f){parts.push(f.title,f.desc);});
    (p.specs||[]).forEach(function(s){parts.push(s.k,s.v);});
    (p.certs||[]).forEach(function(c){parts.push(c);});
    return parts.join(' ').toLowerCase();
  }
  // 取产品容量数值（升数或 kW），用于规模匹配
  function capacity(p){
    var hs=haystack(p);
    var m=hs.match(/(\d{2,3})\s*(l|kw|升|kw)/);
    if(m) return parseInt(m[1],10);
    var m2=hs.match(/(\d{2,3})/);
    return m2?parseInt(m2[1],10):0;
  }

  function recommend(state){
    var cat=state.scene, sys=state.need==='both'?'water-heating':state.need;
    var pool=window.EVERHOT_CATALOG.by(cat,sys).slice();
    // 商用统一用 commercial 关键词表；家用按系统
    var prKey = cat==='commercial' ? 'commercial' : sys;
    var prList=PRIORITY[prKey]||[];
    var chosen=prList.filter(function(o){return (state.priorities||[]).indexOf(o.v)>-1;});
    var caps=pool.map(capacity).filter(function(n){return n>0;});
    var maxCap=Math.max.apply(null,caps.concat([1]));

    var scored=pool.map(function(p){
      var hs=haystack(p), score=0, reasons=[];
      chosen.forEach(function(o){
        var hit=o.kw.some(function(k){return hs.indexOf(k)>-1;});
        if(hit){ score+=3; reasons.push(o.label); }
      });
      // 两用偏好
      if(state.need==='both' && (hs.indexOf('两用')>-1||hs.indexOf('采暖')>-1)){ score+=4; reasons.push('采暖热水两用'); }
      // 规模 → 容量偏好
      var c=capacity(p), ratio=maxCap?c/maxCap:0;
      if(state.scale==='large'){ score+=ratio*3; if(ratio>=0.8)reasons.push('大容量适配'); }
      else if(state.scale==='small'){ score+=(1-ratio)*1.5; }
      else { score+=(1-Math.abs(ratio-0.6))*1.5; }
      // 角标轻微加权
      if((p.badges||[]).indexOf('旗舰')>-1) score+=0.6;
      if((p.badges||[]).indexOf('热销')>-1) score+=0.4;
      // 去重理由
      var seen={}; reasons=reasons.filter(function(r){if(seen[r])return false;seen[r]=1;return true;});
      return {p:p,score:score,reasons:reasons};
    }).sort(function(a,b){return b.score-a.score;});

    return {cat:cat,sys:sys,items:scored.filter(function(x){return x.p;})};
  }

  function selectionSystems(state){
    if(state.need==='water-heating') return ['hot_water'];
    if(state.need==='both') return ['heating','hot_water'];
    if(state.need==='heating-cooling') return ['heating'];
    return [];
  }

  function backendCriteria(state){
    var segments = state.scene==='commercial' ? ['commercial','project'] : ['home','villa'];
    return {
      segments: state.scene ? segments : [],
      channels: ['dealer'],
      systems: selectionSystems(state),
      limit: 4
    };
  }

  var REASON_VALUE_LABELS = {
    dealer: '授权经销商渠道',
    home: '家庭住宅',
    villa: '别墅大宅',
    commercial: '商用工程',
    project: '项目工程',
    heating: '采暖系统',
    hot_water: '热水系统',
    air: '空气系统',
    fresh_air: '新风系统',
    water_treatment: '水处理系统',
    smart_control: '智能控制'
  };
  var REASON_DIMENSION_LABELS = {
    targetSegments: '适配',
    channels: '适配',
    userPersonas: '适配',
    markets: '适配',
    applicationScenarios: '适配',
    system: '匹配',
    pain: '覆盖'
  };

  function reasonValueLabel(value){
    value=String(value||'').trim();
    return REASON_VALUE_LABELS[value] || value.replace(/_/g,' ');
  }

  function reasonLabel(reason){
    reason=String(reason||'').trim();
    if(!reason) return '';
    if(reason.indexOf(':')<0) return reason;
    var parts=reason.split(':');
    var dimension=parts.shift();
    var values=parts.join(':').split(',').map(reasonValueLabel).filter(Boolean);
    var suffix=REASON_DIMENSION_LABELS[dimension] || '匹配';
    return values.length ? values.join('、') + suffix : '';
  }

  function displayReasons(reasons){
    var seen={};
    return (Array.isArray(reasons)?reasons:[]).map(reasonLabel).filter(function(reason){
      if(!reason || seen[reason]) return false;
      seen[reason]=1;
      return true;
    });
  }

  function normalizeBackendProduct(item){
    var p = {};
    Object.keys(item || {}).forEach(function(key){ p[key] = item[key]; });
    p.slug = String(item && (item.slug || item.sku) || '');
    p.tagline = item && (item.tagline || item.summary || item.description) || '';
    p.highlights = Array.isArray(item && item.highlights) ? item.highlights : [];
    p.features = Array.isArray(item && item.features) ? item.features : [];
    return p;
  }

  function recommendFromBackend(state){
    if(!window.fetch) return Promise.reject(new Error('fetch unavailable'));
    return fetch(apiBase() + '/api/v2/brand/' + encodeURIComponent(siteCode()) + '/recommend', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(backendCriteria(state))
    }).then(function(res){
      if(!res.ok) throw new Error('HTTP '+res.status);
      return res.json();
    }).then(function(json){
      var items = json && json.data && Array.isArray(json.data.items) ? json.data.items : [];
      if(!items.length) throw new Error('empty backend recommendation');
      return {
        cat: state.scene,
        sys: state.need==='both'?'water-heating':state.need,
        items: items.map(function(item){
          return {p:normalizeBackendProduct(item),score:Number(item.matchScore||0),reasons:displayReasons(item.matchReasons || item.reasons || item.matchSignals)};
        })
      };
    });
  }

  function init(){
    var host=document.querySelector('[data-product-selector]');
    if(!host||!window.EVERHOT_CATALOG) return;
    var state={step:0,scene:null,need:null,priorities:[],scale:null};

    function stepDefs(){
      var defs=[
        {key:'scene',q:'您是为哪类场景选型？',multi:false,opts:[
          {v:'residential',label:'家庭住宅',ic:'🏠'},
          {v:'commercial', label:'商用 / 工程',ic:'🏢'}
        ]},
        {key:'need',q:'您主要想解决什么？',multi:false,opts:[
          {v:'water-heating', label:'生活热水',ic:'🚿'},
          {v:'heating-cooling',label:'采暖 / 制冷',ic:'❄️'},
          {v:'both',          label:'采暖热水两用',ic:'♨️'}
        ]}
      ];
      // 关注点（多选，依据 scene/need）
      var prKey=state.scene==='commercial'?'commercial':(state.need==='both'?'water-heating':state.need);
      defs.push({key:'priorities',q:'最看重哪些方面？（可多选）',multi:true,opts:(PRIORITY[prKey]||[]).map(function(o){return {v:o.v,label:o.label,ic:o.ic};})});
      // 规模
      var sc=SCALE[state.scene]||SCALE.residential;
      defs.push({key:'scale',q:sc.q,multi:false,opts:sc.opts});
      return defs;
    }

    function progress(defs){
      var total=defs.length;
      var pct=Math.round((Math.min(state.step,total)/total)*100);
      return '<div class="selw-progress"><div class="selw-progress-bar" style="width:'+pct+'%"></div></div>'+
             '<div class="selw-progress-txt">第 '+Math.min(state.step+1,total)+' / '+total+' 步</div>';
    }

    function draw(){
      var defs=stepDefs();
      // 结果页
      if(state.step>=defs.length){ return drawResult(defs); }
      var d=defs[state.step];
      var cur=state[d.key];
      var h='';
      h+='<div class="selw-card">';
      h+=progress(defs);
      h+='<h3 class="selw-q">'+e(d.q)+'</h3>';
      h+='<div class="selw-opts'+(d.multi?' is-multi':'')+'">';
      d.opts.forEach(function(o){
        var on=d.multi?(cur||[]).indexOf(o.v)>-1:cur===o.v;
        h+='<button type="button" class="selw-opt'+(on?' is-on':'')+'" data-val="'+e(o.v)+'"><span class="selw-opt-ic">'+e(o.ic||'•')+'</span><span class="selw-opt-label">'+e(o.label)+'</span></button>';
      });
      h+='</div>';
      h+='<div class="selw-actions">';
      if(state.step>0) h+='<button type="button" class="selw-back" data-back>← 上一步</button>';
      var canNext=d.multi?((cur||[]).length>0):!!cur;
      h+='<button type="button" class="btn btn-brand selw-next" data-next'+(canNext?'':' disabled')+'>'+(state.step===defs.length-1?'查看推荐 →':'下一步 →')+'</button>';
      h+='</div>';
      h+='</div>';
      host.innerHTML=h;
      bindStep(d);
    }

    function bindStep(d){
      host.querySelectorAll('.selw-opt').forEach(function(b){
        b.addEventListener('click',function(){
          var v=b.getAttribute('data-val');
          if(d.multi){
            var arr=state[d.key]||[];
            if(arr.indexOf(v)>-1) arr=arr.filter(function(x){return x!==v;});
            else arr=arr.concat([v]);
            state[d.key]=arr;
          } else {
            state[d.key]=v;
            // 切换 scene/need 会改变后续步骤，重置依赖项
            if(d.key==='scene'){ state.priorities=[]; state.scale=null; }
            if(d.key==='need'){ state.priorities=[]; }
          }
          draw();
        });
      });
      var nextBtn=host.querySelector('[data-next]');
      if(nextBtn) nextBtn.addEventListener('click',function(){ if(nextBtn.hasAttribute('disabled'))return; state.step++; draw(); });
      var backBtn=host.querySelector('[data-back]');
      if(backBtn) backBtn.addEventListener('click',function(){ state.step=Math.max(0,state.step-1); draw(); });
    }

    function drawResult(defs){
      var fallback=recommend(state);
      renderPendingResult();
      recommendFromBackend(state).then(renderResult).catch(function(){
        renderResult(fallback);
      });
    }

    function renderPendingResult(){
      var h='';
      h+='<div class="selw-card selw-result">';
      h+='<div class="selw-result-head"><span class="selw-badge">为您推荐</span><h3 class="selw-q">正在按官网产品字段匹配方案...</h3></div>';
      h+='</div>';
      host.innerHTML=h;
    }

    function renderResult(rec){
      var picks=rec.items.map(function(x){return x.p.slug;});
      var cmpUrl=BASE+'/products/compare/?cat='+encodeURIComponent(rec.cat)+'&sys='+encodeURIComponent(rec.sys)+'&pick='+encodeURIComponent(picks.join(','));
      var h='';
      h+='<div class="selw-card selw-result">';
      h+='<div class="selw-result-head"><span class="selw-badge">为您推荐</span><h3 class="selw-q">根据您的选择，推荐以下 '+rec.items.length+' 款方案</h3></div>';
      if(rec.cat==='residential' && state.scale==='large'){ h+='<p class="selw-slogan">大户型选恒热 · 多点用水没烦恼</p>'; }
      if(!rec.items.length){
        h+='<div class="cmp-empty">暂未匹配到合适机型，建议联系授权经销商定制选型。</div>';
      } else {
        h+='<div class="selw-rec-grid">';
        rec.items.forEach(function(x,i){
          var p=x.p;
          var hi=(p.highlights||[]).slice(0,3).map(function(g){return '<span class="selw-hl"><b>'+e(g.value)+'</b> '+e(g.label)+'</span>';}).join('');
          var reasons=x.reasons.slice(0,3).map(function(r){return '<span class="selw-reason">✓ '+e(r)+'</span>';}).join('');
          h+='<div class="selw-rec'+(i===0?' is-top':'')+'">';
          if(i===0) h+='<span class="selw-rec-rank">最佳匹配</span>';
          h+='<div class="selw-rec-ic">'+renderIcon(p.icon||'🔧','selw-rec-ic-img')+'</div>';
          h+='<div class="selw-rec-name">'+e(p.name)+'</div>';
          h+='<div class="selw-rec-series">'+e(p.series||'')+'</div>';
          h+='<p class="selw-rec-tag">'+e(p.tagline)+'</p>';
          if(hi) h+='<div class="selw-hls">'+hi+'</div>';
          if(reasons) h+='<div class="selw-reasons">'+reasons+'</div>';
          h+='<a class="btn btn-brand" style="font-size:13px;width:100%;text-align:center;margin-top:auto" href="'+BASE+'/products/detail/'+e(p.slug)+'/">查看详情</a>';
          h+='</div>';
        });
        h+='</div>';
        h+='<div class="selw-result-cta">';
        h+='<a class="btn btn-brand btn-lg" href="'+cmpUrl+'">并排对比这些方案 →</a>';
        h+='<a class="btn btn-outline" href="'+BASE+'/find-a-pro/">预约经销商上门选型</a>';
        h+='<button type="button" class="selw-restart" data-restart>↺ 重新选择</button>';
        h+='</div>';
      }
      h+='</div>';
      host.innerHTML=h;
      var rb=host.querySelector('[data-restart]');
      if(rb) rb.addEventListener('click',function(){ state={step:0,scene:null,need:null,priorities:[],scale:null}; draw(); });
    }

    draw();
  }

  function start(){ productsReady().then(init, init); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',start); }
  else { start(); }
})();
