/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 统一表单处理器
   用法：<form data-ev-form="contact"> ... </form>
   - 字段加 data-required / type=tel 自动校验
   - 提交后：客户端校验 → 本地暂存(localStorage) → 成功态
   - 后端就绪后：把 submit() 里的本地暂存替换为 fetch('/api/v2/leads', ...)
   ═══════════════════════════════════════════════════════════ */
(function () {
  var STORE_KEY = 'everhot_leads';
  var SITE_CODE = window.EVERHOT_SITE_CODE || 'everhot';
  var API_BASE = window.EVERHOT_API_BASE || '';

  function saveLocal(kind, data){
    try{
      var all = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      all.push({ kind: kind, data: data, ts: new Date().toISOString() });
      localStorage.setItem(STORE_KEY, JSON.stringify(all));
    }catch(_){}
  }

  function validTel(v){ return /^1[3-9]\d{9}$/.test(String(v).replace(/\s/g,'')); }

  var uid = 0;
  function setError(field, msg){
    field.classList.add('ev-field-err');
    field.setAttribute('aria-invalid','true');
    var hint = field.parentNode.querySelector('.ev-field-msg');
    if(!hint){
      hint=document.createElement('span'); hint.className='ev-field-msg';
      hint.id = field.id ? field.id+'-err' : 'ev-err-'+(++uid);
      hint.setAttribute('role','alert');
      field.parentNode.appendChild(hint);
      field.setAttribute('aria-describedby', hint.id);
    }
    hint.textContent = msg;
  }
  function clearError(field){
    field.classList.remove('ev-field-err');
    field.removeAttribute('aria-invalid');
    var hint = field.parentNode.querySelector('.ev-field-msg');
    if(hint) hint.textContent='';
  }

  function validate(form){
    var ok=true, data={}, firstErr=null;
    form.querySelectorAll('input,select,textarea').forEach(function(f){
      if(f.type==='submit'||f.type==='button') return;
      var name=f.name||f.placeholder||'字段';
      var val=(f.value||'').trim();
      clearError(f);
      function fail(m){ setError(f,m); ok=false; if(!firstErr) firstErr=f; }
      if(f.hasAttribute('data-required') && !val){ fail('此项必填'); return; }
      if(f.type==='tel' && val && !validTel(val)){ fail('请输入有效的 11 位手机号'); return; }
      if(f.type==='email' && val && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)){ fail('请输入有效邮箱'); return; }
      data[name]=val;
    });
    if(firstErr){ try{ firstErr.focus(); }catch(_){} }
    return ok?data:null;
  }

  function showSuccess(form){
    var kind=form.getAttribute('data-ev-form')||'lead';
    var msg=form.getAttribute('data-success')||'提交成功！恒热客服将尽快与您联系。';
    var box=document.createElement('div');
    box.className='ev-form-success';
    box.innerHTML='<div class="ev-form-success-ic">✓</div><h3>'+msg+'</h3>'
      +'<p>如需紧急处理，请直接致电 <a href="tel:4008888888">400-888-8888</a>。</p>';
    form.parentNode.insertBefore(box, form);
    form.style.display='none';
  }

  function fieldValue(form, selector, fallbackIndex) {
    var field = selector ? form.querySelector(selector) : null;
    if (!field && typeof fallbackIndex === 'number') {
      field = form.querySelectorAll('input,select,textarea')[fallbackIndex];
    }
    return field ? (field.value || '').trim() : '';
  }

  function inquiryPayload(form, data) {
    var kind = form.getAttribute('data-ev-form') || 'lead';
    if (kind === 'dealer') {
      return {
        kind: 'dealer',
        body: {
          name: fieldValue(form, null, 0),
          phone: fieldValue(form, null, 1),
          companyName: fieldValue(form, null, 2),
          intendedRegion: fieldValue(form, null, 3),
          businessSummary: fieldValue(form, null, 4),
          sourcePath: location.pathname
        }
      };
    }
    return {
      kind: 'customer',
      body: {
        name: fieldValue(form, '#cf-name', 0),
        phone: fieldValue(form, '#cf-tel', 1),
        city: fieldValue(form, '#cf-city', 2),
        inquiryType: fieldValue(form, '#cf-type', 3),
        message: fieldValue(form, '#cf-msg', 4),
        sourcePath: location.pathname
      }
    };
  }

  function submitInquiry(form, data) {
    var payload = inquiryPayload(form, data);
    if (!window.fetch) return Promise.reject(new Error('fetch unavailable'));
    return fetch(API_BASE + '/api/v2/sites/' + encodeURIComponent(SITE_CODE) + '/inquiries/' + encodeURIComponent(payload.kind), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload.body)
    }).then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    });
  }

  function attach(form){
    form.setAttribute('novalidate','');
    // A11y：必填字段标注 aria-required（供屏幕阅读器）
    form.querySelectorAll('[data-required]').forEach(function(f){ f.setAttribute('aria-required','true'); });
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var data=validate(form);
      if(!data) return;
      var btn=form.querySelector('[type="submit"]');
      if(btn) btn.disabled=true;
      submitInquiry(form, data).then(function(){
        saveLocal(form.getAttribute('data-ev-form')||'lead', data);
        showSuccess(form);
      }).catch(function(){
        alert('提交失败，请稍后再试或直接致电 400-888-8888。');
      }).finally(function(){
        if(btn) btn.disabled=false;
      });
    });
    // live clear errors
    form.querySelectorAll('input,select,textarea').forEach(function(f){
      f.addEventListener('input',function(){ clearError(f); });
    });
  }

  function boot(){ document.querySelectorAll('form[data-ev-form]').forEach(attach); }
  if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',boot); }
  else { boot(); }
})();
