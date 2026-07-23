/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 经销商定位（可替换数据层）
   SWAPPABLE DEALER DB.
   说明：window.EVERHOT_DEALERS 为示例数据（占位），上线时用同结构
   的真实经销商数据替换即可，定位器会自动重新渲染。
   字段：name 门店名 | city 城市 | province 省份 | district 区域
        addr 地址 | tel 电话 | services 服务标签[] | type 经销商类型
        cert 认证标识[] | lng/lat 经纬度(可空)
   ═══════════════════════════════════════════════════════════ */
window.EVERHOT_DEALERS = [
  {name:"恒热上海浦东旗舰服务中心", city:"上海市", province:"上海", district:"浦东新区", addr:"浦东新区张杨路 1500 号 A 座 2F", tel:"021-5888-0001", type:"旗舰店", services:["家用","商用","安装","售后"], cert:["Rheem认证","金牌服务"], lat:31.221, lng:121.545},
  {name:"恒热上海徐汇授权店", city:"上海市", province:"上海", district:"徐汇区", addr:"徐汇区漕溪北路 88 号", tel:"021-5888-0002", type:"授权店", services:["家用","安装","售后"], cert:["Rheem认证"], lat:31.188, lng:121.437},
  {name:"恒热北京朝阳体验中心", city:"北京市", province:"北京", district:"朝阳区", addr:"朝阳区建国路 95 号院 3 号楼", tel:"010-8588-0010", type:"旗舰店", services:["家用","商用","安装","售后"], cert:["Rheem认证","金牌服务"], lat:39.921, lng:116.486},
  {name:"恒热北京海淀授权店", city:"北京市", province:"北京", district:"海淀区", addr:"海淀区中关村大街 27 号", tel:"010-8588-0011", type:"授权店", services:["家用","安装"], cert:["Rheem认证"], lat:39.959, lng:116.298},
  {name:"恒热广州天河服务中心", city:"广州市", province:"广东", district:"天河区", addr:"天河区天河路 230 号", tel:"020-3888-0020", type:"旗舰店", services:["家用","商用","安装","售后"], cert:["Rheem认证","金牌服务"], lat:23.124, lng:113.361},
  {name:"恒热深圳南山授权店", city:"深圳市", province:"广东", district:"南山区", addr:"南山区科技园南区高新南一道", tel:"0755-2688-0021", type:"授权店", services:["家用","商用","安装"], cert:["Rheem认证"], lat:22.533, lng:113.930},
  {name:"恒热杭州西湖体验店", city:"杭州市", province:"浙江", district:"西湖区", addr:"西湖区文三路 478 号", tel:"0571-8788-0030", type:"授权店", services:["家用","安装","售后"], cert:["Rheem认证"], lat:30.259, lng:120.130},
  {name:"恒热南京建邺服务中心", city:"南京市", province:"江苏", district:"建邺区", addr:"建邺区江东中路 222 号", tel:"025-8388-0040", type:"授权店", services:["家用","商用","安装","售后"], cert:["Rheem认证","金牌服务"], lat:32.005, lng:118.731},
  {name:"恒热苏州工业园授权店", city:"苏州市", province:"江苏", district:"工业园区", addr:"工业园区星海街 199 号", tel:"0512-6788-0041", type:"授权店", services:["家用","安装"], cert:["Rheem认证"], lat:31.317, lng:120.745},
  {name:"恒热成都高新体验中心", city:"成都市", province:"四川", district:"高新区", addr:"高新区天府大道北段 1700 号", tel:"028-8588-0050", type:"旗舰店", services:["家用","商用","安装","售后"], cert:["Rheem认证","金牌服务"], lat:30.572, lng:104.066},
  {name:"恒热武汉武昌授权店", city:"武汉市", province:"湖北", district:"武昌区", addr:"武昌区中南路 99 号", tel:"027-8788-0060", type:"授权店", services:["家用","安装","售后"], cert:["Rheem认证"], lat:30.554, lng:114.342},
  {name:"恒热重庆渝中服务中心", city:"重庆市", province:"重庆", district:"渝中区", addr:"渝中区民权路 28 号", tel:"023-6388-0070", type:"授权店", services:["家用","商用","安装"], cert:["Rheem认证"], lat:29.557, lng:106.572},
  {name:"恒热西安雁塔授权店", city:"西安市", province:"陕西", district:"雁塔区", addr:"雁塔区科技路 33 号", tel:"029-8588-0080", type:"授权店", services:["家用","安装","售后"], cert:["Rheem认证"], lat:34.222, lng:108.948},
  {name:"恒热天津和平体验店", city:"天津市", province:"天津", district:"和平区", addr:"和平区南京路 189 号", tel:"022-2388-0090", type:"授权店", services:["家用","安装"], cert:["Rheem认证"], lat:39.117, lng:117.201},
  {name:"恒热青岛市南服务中心", city:"青岛市", province:"山东", district:"市南区", addr:"市南区香港中路 76 号", tel:"0532-8588-0100", type:"授权店", services:["家用","商用","安装","售后"], cert:["Rheem认证","金牌服务"], lat:36.067, lng:120.382},
  {name:"恒热长沙岳麓授权店", city:"长沙市", province:"湖南", district:"岳麓区", addr:"岳麓区枫林三路 286 号", tel:"0731-8488-0110", type:"授权店", services:["家用","安装"], cert:["Rheem认证"], lat:28.228, lng:112.938}
];

/* 经销商定位器：挂载到 [data-dealer-locator] */
(function () {
  function e(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

  function getParam(name){ return (new URLSearchParams(location.search)).get(name)||''; }

  // 两点球面距离（haversine，单位 km）
  function distKm(a, b){
    if(a==null||b==null) return null;
    var R=6371, toRad=Math.PI/180;
    var dLat=(b.lat-a.lat)*toRad, dLng=(b.lng-a.lng)*toRad;
    var la1=a.lat*toRad, la2=b.lat*toRad;
    var h=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
  }
  function fmtDist(km){
    if(km==null) return '';
    return km<1 ? ('约 '+Math.round(km*1000)+' m') : ('约 '+(km<10?km.toFixed(1):Math.round(km))+' km');
  }

  function dealerCard(d){
    var tel=String(d.tel||'').replace(/[^0-9]/g,'');
    var distBadge=(d._dist!=null) ? '<span class="dl-dist">📍 '+e(fmtDist(d._dist))+'</span>' : '';
    return '<article class="dl-card">'
      + '<div class="dl-card-top">'
      +   '<h3>'+e(d.name)+'</h3>'
      +   '<span class="dl-type'+(d.type==='旗舰店'?' dl-type-flag':'')+'">'+e(d.type||'授权店')+'</span>'
      + '</div>'
      + distBadge
      + '<p class="dl-addr">'+e(d.province)+' · '+e(d.city)+e(d.district?(' · '+d.district):'')+'<br>'+e(d.addr||'')+'</p>'
      + '<div class="dl-tags">'+(d.services||[]).map(function(s){return '<span class="dl-tag">'+e(s)+'</span>';}).join('')+'</div>'
      + '<div class="dl-certs">'+(d.cert||[]).map(function(c){return '<span class="dl-cert">✓ '+e(c)+'</span>';}).join('')+'</div>'
      + '<div class="dl-actions"><a class="btn btn-brand" href="tel:'+e(tel)+'">致电 '+e(d.tel||'')+'</a>'
      +   '<a class="btn dl-route" target="_blank" rel="noopener" href="https://uri.amap.com/search?keyword='+encodeURIComponent((d.city||'')+(d.addr||''))+'">导航前往 →</a></div>'
      + '</article>';
  }

  function render(host){
    var all=window.EVERHOT_DEALERS||[];
    var provinces=[];
    all.forEach(function(d){ if(provinces.indexOf(d.province)<0) provinces.push(d.province); });
    var state={ q:getParam('q')||getParam('city')||'', province:'', service:'', sort:'default', me:null, locating:false };

    function results(){
      var list=all.filter(function(d){
        var hay=(d.name+d.province+d.city+d.district+d.addr).toLowerCase();
        var okQ=!state.q || hay.indexOf(state.q.toLowerCase())>-1;
        var okP=!state.province || d.province===state.province;
        var okS=!state.service || (d.services||[]).indexOf(state.service)>-1;
        return okQ&&okP&&okS;
      });
      // 附加距离（若已定位）
      list.forEach(function(d){ d._dist = state.me ? distKm(state.me, d) : null; });
      if(state.sort==='nearest' && state.me){
        list=list.slice().sort(function(a,b){ return (a._dist==null?1e9:a._dist)-(b._dist==null?1e9:b._dist); });
      }
      return list;
    }

    // 表单只渲染一次（避免每次输入重建 DOM 导致输入框失焦）
    host.innerHTML=''
      +'<form class="dl-filters" role="search" onsubmit="return false">'
      +  '<input type="search" class="dl-search" placeholder="输入城市 / 区域 / 地址，如：上海 浦东" aria-label="搜索经销商">'
      +  '<select class="dl-select dl-prov" aria-label="按省份筛选"><option value="">全部省份</option>'+provinces.map(function(p){return '<option value="'+e(p)+'">'+e(p)+'</option>';}).join('')+'</select>'
      +  '<select class="dl-select dl-serv" aria-label="按服务类型筛选"><option value="">全部服务</option>'+['家用','商用','安装','售后'].map(function(s){return '<option value="'+e(s)+'">'+e(s)+'</option>';}).join('')+'</select>'
      +  '<button type="button" class="dl-geo" aria-label="使用我的位置查找最近经销商">📍 离我最近</button>'
      +'</form>'
      +'<p class="dl-count" aria-live="polite"></p>'
      +'<div class="dl-results"></div>';

    var elSearch=host.querySelector('.dl-search');
    var elProv=host.querySelector('.dl-prov');
    var elServ=host.querySelector('.dl-serv');
    var elGeo=host.querySelector('.dl-geo');
    var elCount=host.querySelector('.dl-count');
    var elResults=host.querySelector('.dl-results');
    elSearch.value=state.q;

    // 仅更新结果区与计数（保持输入焦点与光标）
    function drawResults(){
      var list=results();
      var near = state.sort==='nearest' && state.me;
      var msg = state.locating ? '正在获取您的位置…'
        : (near ? ('已按距离为您排序最近的 <strong>'+list.length+'</strong> 家经销商')
                : ('为您找到 <strong>'+list.length+'</strong> 家恒热授权经销商'+(state.q?('（关键词：'+e(state.q)+'）'):'')));
      elCount.innerHTML=msg;
      elResults.innerHTML = list.length
        ? '<div class="dl-grid">'+list.map(dealerCard).join('')+'</div>'
        : '<div class="dl-empty"><p>未找到匹配的经销商。请尝试更换关键词，或致电 <a href="tel:4008888888">400-888-8888</a> 由客服为您就近匹配。</p></div>';
    }

    function locate(){
      if(!navigator.geolocation){ alert('当前浏览器不支持定位，请手动输入城市。'); return; }
      state.locating=true; elGeo.classList.add('is-busy'); elGeo.textContent='定位中…'; drawResults();
      navigator.geolocation.getCurrentPosition(function(pos){
        state.me={lat:pos.coords.latitude, lng:pos.coords.longitude};
        state.sort='nearest'; state.locating=false;
        elGeo.classList.remove('is-busy'); elGeo.classList.add('is-on'); elGeo.textContent='📍 已按最近排序';
        drawResults();
      }, function(){
        state.locating=false; elGeo.classList.remove('is-busy'); elGeo.textContent='📍 离我最近';
        elCount.innerHTML='无法获取定位（可能被拒绝或超时）。请手动输入城市，或致电 <a href="tel:4008888888">400-888-8888</a>。';
      }, {enableHighAccuracy:false, timeout:8000, maximumAge:300000});
    }

    elSearch.addEventListener('input',function(){state.q=this.value;drawResults();});
    elProv.addEventListener('change',function(){state.province=this.value;drawResults();});
    elServ.addEventListener('change',function(){state.service=this.value;drawResults();});
    elGeo.addEventListener('click',locate);
    drawResults();
  }

  function boot(){
    document.querySelectorAll('[data-dealer-locator]').forEach(render);
  }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',boot); }
  else { boot(); }
})();
