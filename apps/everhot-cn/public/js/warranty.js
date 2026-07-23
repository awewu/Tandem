/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 保修序列号查询（演示逻辑）
   挂载：[data-warranty-lookup]
   说明：当前为客户端演示，根据序列号生成可复现的查询结果。
   上线接后端时把 lookup() 内部替换为
   fetch('/api/v2/warranty?sn=' + sn) 即可。
   ═══════════════════════════════════════════════════════════ */
(function () {
  function e(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  var PRODUCTS=[
    {name:"EverWarm 冷凝壁挂炉", years:8},
    {name:"EverFlow 零冷水热水器", years:6},
    {name:"EverAir 家用空气能热水器", years:6},
    {name:"EverMax 商用燃气热水炉", years:5},
    {name:"EverModule 商用中央空调", years:6}
  ];
  function hash(s){var h=0;for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;}return h;}
  function pad(n){return n<10?'0'+n:''+n;}

  function lookup(sn){
    // demo: derive a reproducible result from the serial string
    var h=hash(sn.toUpperCase());
    var p=PRODUCTS[h%PRODUCTS.length];
    var now=new Date();
    var monthsAgo=h%40+2; // 2~41 个月前购买
    var d=new Date(now.getFullYear(), now.getMonth()-monthsAgo, (h%26)+1);
    var end=new Date(d.getFullYear()+p.years, d.getMonth(), d.getDate());
    var active=end>now;
    var remMonths=Math.max(0, Math.round((end-now)/(1000*60*60*24*30)));
    return { product:p.name, buy:d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()),
             end:end.getFullYear()+'-'+pad(end.getMonth()+1)+'-'+pad(end.getDate()),
             years:p.years, active:active, remMonths:remMonths };
  }

  function render(host){
    host.innerHTML=
      '<form class="ev-form wl-form" onsubmit="return false" style="max-width:560px">'
      +'<div class="ev-field"><label for="wl-sn">产品序列号（机身铭牌 S/N）<span class="req">*</span></label>'
      +'<input id="wl-sn" type="text" placeholder="示例：EH-WH24-0000000000" autocomplete="off"></div>'
      +'<button class="btn btn-brand btn-lg" type="submit">查询保修</button>'
      +'<p class="ev-form-note">演示查询：结果由序列号即时推算；接入保修数据库后将返回真实记录。也可致电 400-888-8888 协助查询。</p>'
      +'</form><div class="wl-result" aria-live="polite"></div>';

    var form=host.querySelector('.wl-form');
    var input=host.querySelector('#wl-sn');
    var out=host.querySelector('.wl-result');
    form.addEventListener('submit',function(){
      var sn=(input.value||'').trim();
      if(sn.length<6){ out.innerHTML='<div class="wl-card wl-err">请输入完整序列号（至少 6 位）。</div>'; return; }
      var r=lookup(sn);
      out.innerHTML='<div class="wl-card '+(r.active?'wl-ok':'wl-exp')+'">'
        +'<div class="wl-badge">'+(r.active?'保修期内':'已过保修')+'</div>'
        +'<h3>'+e(r.product)+'</h3>'
        +'<table class="wl-table"><tbody>'
        +'<tr><th>序列号</th><td>'+e(sn.toUpperCase())+'</td></tr>'
        +'<tr><th>购买日期</th><td>'+r.buy+'</td></tr>'
        +'<tr><th>保修年限</th><td>'+r.years+' 年（核心部件）</td></tr>'
        +'<tr><th>保修截止</th><td>'+r.end+'</td></tr>'
        +'<tr><th>剩余</th><td>'+(r.active?('约 '+r.remMonths+' 个月'):'—')+'</td></tr>'
        +'</tbody></table>'
        +'<div class="wl-actions"><a class="btn btn-brand" href="/find-a-pro/">预约服务</a>'
        +'<a class="btn dl-route" href="tel:4008888888">致电客服</a></div></div>';
    });
  }

  function boot(){ document.querySelectorAll('[data-warranty-lookup]').forEach(render); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',boot); }
  else { boot(); }
})();
