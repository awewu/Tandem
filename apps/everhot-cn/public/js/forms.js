/* ═══════════════════════════════════════════════════════════
   EVERHOT 恒热 — 统一表单处理器
   用法：<form data-ev-form="contact"> ... </form>
   - 字段加 data-required / type=tel 自动校验
   - 提交后：客户端校验 → 本地暂存(localStorage) → 成功态
   - 后端就绪后：把 submit() 里的本地暂存替换为 fetch('/api/v2/leads', ...)
   ═══════════════════════════════════════════════════════════ */
(function () {
  var STORE_KEY = 'everhot_leads';

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

  function attach(form){
    form.setAttribute('novalidate','');
    // A11y：必填字段标注 aria-required（供屏幕阅读器）
    form.querySelectorAll('[data-required]').forEach(function(f){ f.setAttribute('aria-required','true'); });
    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      var data=validate(form);
      if(!data) return;
      saveLocal(form.getAttribute('data-ev-form')||'lead', data);
      // TODO(backend): fetch('/api/v2/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:..,data:data})})
      showSuccess(form);
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
