/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 产品矢量插画（占位实拍图之前的高质量替代）
   提供 window.EVERHOT_ART(p) → 返回一段 SVG 字符串。
   依据产品 slug / sys 选择对应器型插画；上线接入真实产品图后，
   只要 products-data.js 的 image 字段非空，catalog.js 会优先用实拍图。
   ═══════════════════════════════════════════════════════════ */
(function () {
  /* official VI 中性灰调（原暖 espresso/copper/cream 已更正，避免与 Rheem 克制冲突） */
  var RED = '#BF1924', DK = '#2F302F', CU = '#9E948B', CR = '#F6F3EF', LN = '#E8E2DC';

  function frame(inner){
    return '<svg class="ev-art" viewBox="0 0 200 200" width="100%" height="100%" '
      + 'xmlns="http://www.w3.org/2000/svg" role="img" preserveAspectRatio="xMidYMid meet">'
      + '<rect width="200" height="200" fill="'+CR+'"/>' + inner + '</svg>';
  }

  // 壁挂炉 / 燃气热水器（方形壁挂机）
  function boiler(){
    return frame(
      '<rect x="58" y="44" width="84" height="104" rx="8" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<rect x="58" y="44" width="84" height="20" rx="8" fill="'+RED+'"/>'
      +'<rect x="70" y="78" width="60" height="34" rx="4" fill="'+CR+'" stroke="'+LN+'" stroke-width="1.5"/>'
      +'<circle cx="80" cy="95" r="5" fill="'+CU+'"/><circle cx="100" cy="95" r="5" fill="'+RED+'"/><circle cx="120" cy="95" r="5" fill="'+DK+'"/>'
      +'<rect x="74" y="124" width="52" height="6" rx="3" fill="'+LN+'"/>'
      +'<path d="M84 150v16M100 150v16M116 150v16" stroke="'+CU+'" stroke-width="3" stroke-linecap="round"/>'
    );
  }
  // 储水/容积式 热水器（立式罐）
  function tank(){
    return frame(
      '<rect x="74" y="36" width="52" height="120" rx="26" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<rect x="74" y="36" width="52" height="30" rx="26" fill="'+RED+'"/>'
      +'<circle cx="100" cy="100" r="13" fill="none" stroke="'+CU+'" stroke-width="3"/>'
      +'<path d="M100 92v8l5 4" stroke="'+CU+'" stroke-width="3" fill="none" stroke-linecap="round"/>'
      +'<path d="M88 160v8M112 160v8" stroke="'+DK+'" stroke-width="4" stroke-linecap="round"/>'
    );
  }
  // 空气能 / 热泵（外机 + 风扇）
  function heatpump(){
    return frame(
      '<rect x="46" y="64" width="108" height="78" rx="8" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<circle cx="84" cy="103" r="26" fill="'+CR+'" stroke="'+LN+'" stroke-width="2"/>'
      +'<g fill="'+CU+'"><path d="M84 103c0-14 4-22 0-26-8 0 0 18 0 26z"/><path d="M84 103c12-7 21-6 24-12-5-7-16 6-24 12z"/><path d="M84 103c5 13 3 22 9 24 6-5-6-17-9-24z"/></g>'
      +'<circle cx="84" cy="103" r="5" fill="'+RED+'"/>'
      +'<rect x="120" y="80" width="22" height="46" rx="3" fill="'+CR+'" stroke="'+LN+'" stroke-width="1.5"/>'
      +'<path d="M124 88h14M124 96h14M124 104h14M124 112h14" stroke="'+LN+'" stroke-width="2"/>'
    );
  }
  // 地暖 / 采暖（盘管波浪 + 地面）
  function floor(){
    return frame(
      '<rect x="40" y="120" width="120" height="40" rx="4" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<path d="M52 140h96" stroke="'+LN+'" stroke-width="2"/>'
      +'<path d="M56 100c0-12 16-12 16 0s16 12 16 0 16-12 16 0 16 12 16 0 16-12 16 0" fill="none" stroke="'+RED+'" stroke-width="4" stroke-linecap="round"/>'
      +'<path d="M70 70c4 6 0 10 4 16M100 66c4 6 0 10 4 16M130 70c4 6 0 10 4 16" stroke="'+CU+'" stroke-width="3" fill="none" stroke-linecap="round"/>'
    );
  }
  // 空调 / 多联机（室内风管机）
  function ac(){
    return frame(
      '<rect x="40" y="66" width="120" height="46" rx="8" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<rect x="40" y="66" width="120" height="14" rx="8" fill="'+DK+'"/>'
      +'<path d="M52 102h96" stroke="'+LN+'" stroke-width="2"/>'
      +'<path d="M64 122c0 8-4 10-4 18M100 122c0 8-4 10-4 18M136 122c0 8-4 10-4 18" stroke="'+CU+'" stroke-width="3" fill="none" stroke-linecap="round"/>'
      +'<circle cx="146" cy="89" r="3" fill="'+RED+'"/>'
    );
  }
  // 新风（带滤网的风机）
  function fresh(){
    return frame(
      '<rect x="50" y="60" width="100" height="80" rx="10" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<rect x="64" y="74" width="32" height="52" rx="4" fill="'+CR+'" stroke="'+LN+'" stroke-width="1.5"/>'
      +'<path d="M64 84h32M64 94h32M64 104h32M64 114h32" stroke="'+CU+'" stroke-width="2"/>'
      +'<circle cx="124" cy="100" r="18" fill="none" stroke="'+RED+'" stroke-width="3"/>'
      +'<g stroke="'+RED+'" stroke-width="3" stroke-linecap="round"><path d="M124 100l0-12M124 100l10 6M124 100l-10 6"/></g>'
    );
  }
  // 智能控制（面板 + 信号）
  function control(){
    return frame(
      '<rect x="68" y="48" width="64" height="104" rx="10" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<rect x="80" y="64" width="40" height="56" rx="4" fill="'+DK+'"/>'
      +'<text x="100" y="98" font-size="20" fill="#fff" text-anchor="middle" font-family="Arial" font-weight="bold">21°</text>'
      +'<circle cx="100" cy="134" r="7" fill="none" stroke="'+RED+'" stroke-width="3"/>'
      +'<path d="M138 60a26 26 0 0 1 0 36M146 52a38 38 0 0 1 0 52" stroke="'+CU+'" stroke-width="3" fill="none" stroke-linecap="round"/>'
    );
  }
  // 商用大功率（机柜机组）
  function commercial(){
    return frame(
      '<rect x="44" y="50" width="50" height="104" rx="6" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<rect x="106" y="50" width="50" height="104" rx="6" fill="#fff" stroke="'+LN+'" stroke-width="2"/>'
      +'<rect x="44" y="50" width="50" height="16" rx="6" fill="'+RED+'"/>'
      +'<rect x="106" y="50" width="50" height="16" rx="6" fill="'+DK+'"/>'
      +'<g stroke="'+LN+'" stroke-width="2"><path d="M52 80h34M52 92h34M52 104h34M52 116h34M114 80h34M114 92h34M114 104h34M114 116h34"/></g>'
      +'<circle cx="69" cy="138" r="6" fill="'+CU+'"/><circle cx="131" cy="138" r="6" fill="'+CU+'"/>'
    );
  }

  var MAP = {
    boiler: boiler, tank: tank, heatpump: heatpump, floor: floor,
    ac: ac, fresh: fresh, control: control, commercial: commercial
  };

  function pick(p){
    var s = (p.slug||'') + ' ' + (p.name||'') + ' ' + (p.en||'');
    s = s.toLowerCase();
    if(/fresh|新风/.test(s)) return 'fresh';
    if(/link|control|watch|care|guard|联控|控制|运维|维护/.test(s)) return 'control';
    if(/floor|地暖|采暖系统/.test(s)) return 'floor';
    if(/cool|空调|module|vrf|多联|heat-pro|风冷/.test(s)) return 'ac';
    if(/air|geo|duo|空气能|地源|热泵|两联供/.test(s)) return 'heatpump';
    if(/tank|储热|容积|station|水箱/.test(s)) return 'tank';
    if(/max|boiler|商用|集中|c500|大功率/.test(s) && p.cat==='commercial') return 'commercial';
    if(/warm|boiler|壁挂炉|elec|flow|电热|零冷水/.test(s)) return 'boiler';
    return p.cat==='commercial' ? 'commercial' : 'boiler';
  }

  window.EVERHOT_ART = function(p){
    var fn = MAP[pick(p||{})] || boiler;
    return fn();
  };
})();
