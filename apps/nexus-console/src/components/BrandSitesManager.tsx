'use client';

import { useCallback, useEffect, useState } from 'react';

interface BrandSite {
  id: string;
  code: string;
  nameCn: string;
  nameEn: string;
  appKey: string | null;
  deliveryType: 'self_hosted' | 'external';
  developmentUrl: string | null;
  productionUrl: string | null;
  logoArtifactId: string | null;
  sortOrder: number;
  status: 'active' | 'inactive';
  siteNote: string | null;
  deletedAt: string | null;
}

const EMPTY = {
  code: '', nameCn: '', nameEn: '', appKey: '', deliveryType: 'self_hosted',
  developmentUrl: '', productionUrl: '', sortOrder: 0, status: 'active', siteNote: '',
} as const;

async function request(path = '', init?: RequestInit) {
  const res = await fetch(`/api/brand-sites${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || '请求失败');
  return data;
}

function LogoPreview({ brand }: { brand: BrandSite }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    if (!brand.logoArtifactId) { setSrc(''); return; }
    request(`/${brand.id}/logo`).then((result) => {
      const file = result.data || result;
      if (active && file.dataBase64) setSrc(`data:${file.mimeType || 'image/png'};base64,${file.dataBase64}`);
    }).catch(() => { if (active) setSrc(''); });
    return () => { active = false; };
  }, [brand.id, brand.logoArtifactId]);
  return src
    ? <img className="brand-logo-preview" src={src} alt={`${brand.nameEn} Logo`} />
    : <span className="brand-logo-empty">未上传</span>;
}

export default function BrandSitesManager({ focusCode }: { focusCode?: string }) {
  const [items, setItems] = useState<BrandSite[]>([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<BrandSite | null | undefined>(undefined);
  const [form, setForm] = useState<Record<string, string | number>>(EMPTY as unknown as Record<string, string | number>);
  const [logo, setLogo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const normalizedFocusCode = focusCode?.trim().toLowerCase();
  const visibleItems = normalizedFocusCode
    ? items.filter((item) => item.code.toLowerCase() === normalizedFocusCode)
    : items;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await request(`?includeDeleted=${includeDeleted}`);
      setItems(data.items || []);
    } catch (e) { setError(e instanceof Error ? e.message : '加载失败'); }
    finally { setLoading(false); }
  }, [includeDeleted]);

  useEffect(() => {
    void load();
    const reload = () => { void load(); };
    window.addEventListener('nexus-session-changed', reload);
    return () => window.removeEventListener('nexus-session-changed', reload);
  }, [load]);

  function openCreate() {
    setEditing(null); setLogo(null);
    setForm({ ...EMPTY, code: normalizedFocusCode || '' });
  }

  function openEdit(brand: BrandSite) {
    setEditing(brand); setLogo(null);
    setForm({
      code: brand.code, nameCn: brand.nameCn, nameEn: brand.nameEn, appKey: brand.appKey || '',
      deliveryType: brand.deliveryType, developmentUrl: brand.developmentUrl || '',
      productionUrl: brand.productionUrl || '', sortOrder: brand.sortOrder,
      status: brand.status, siteNote: brand.siteNote || '',
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form };
      if (editing) delete payload.code;
      const saved: BrandSite = await request(editing ? `/${editing.id}` : '', {
        method: editing ? 'PUT' : 'POST', body: JSON.stringify(payload),
      });
      if (logo) {
        const dataBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
          reader.onerror = () => reject(new Error('Logo 读取失败'));
          reader.readAsDataURL(logo);
        });
        await request(`/${saved.id}/logo`, {
          method: 'POST',
          body: JSON.stringify({ filename: logo.name, mimeType: logo.type, dataBase64 }),
        });
      }
      setEditing(undefined);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败'); }
    finally { setSaving(false); }
  }

  async function archive(brand: BrandSite) {
    if (!window.confirm(`确认归档“${brand.nameCn}”？归档后可恢复。`)) return;
    try { await request(`/${brand.id}`, { method: 'DELETE', body: '{}' }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : '归档失败'); }
  }

  async function restore(brand: BrandSite) {
    try { await request(`/${brand.id}/restore`, { method: 'POST', body: '{}' }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : '恢复失败'); }
  }

  return (
    <div className="brand-sites-manager">
      <div className="manager-toolbar">
        <label className="toggle-label">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          显示已归档
        </label>
        <button className="btn" type="button" onClick={openCreate}>新增品牌</button>
      </div>
      {error && <div className="manager-alert" role="alert">{error}</div>}
      <div className="table-scroll">
        <table>
          <thead><tr><th>Logo</th><th>品牌</th><th>代码</th><th>开发地址</th><th>生产地址</th><th>交付</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            {loading ? <tr><td className="empty" colSpan={8}>加载中...</td></tr> : visibleItems.length === 0 ? (
              <tr><td className="empty" colSpan={8}>暂无品牌，点击“新增品牌”开始配置。</td></tr>
            ) : visibleItems.map((brand) => (
              <tr key={brand.id} className={brand.deletedAt ? 'archived-row' : ''}>
                <td><LogoPreview brand={brand} /></td>
                <td><strong>{brand.nameCn}</strong><small>{brand.nameEn}</small></td>
                <td><code>{brand.code}</code></td>
                <td className="url-cell">{brand.developmentUrl || '-'}</td>
                <td className="url-cell">{brand.productionUrl || '-'}</td>
                <td><span className="badge">{brand.deliveryType === 'self_hosted' ? '自建' : '外链'}</span></td>
                <td><span className={`badge ${brand.deletedAt ? 'warn' : brand.status === 'active' ? 'ok' : ''}`}>{brand.deletedAt ? '已归档' : brand.status === 'active' ? '启用' : '停用'}</span></td>
                <td><div className="row-actions">
                  {brand.deletedAt ? <button className="btn ghost" type="button" onClick={() => restore(brand)}>恢复</button> : <>
                    <button className="btn ghost" type="button" onClick={() => openEdit(brand)}>编辑</button>
                    <button className="btn ghost danger" type="button" onClick={() => archive(brand)}>归档</button>
                  </>}
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing !== undefined && (
        <div className="dialog-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(undefined); }}>
          <form className="brand-dialog" role="dialog" aria-modal="true" aria-labelledby="brand-dialog-title" onSubmit={save}>
            <div className="dialog-head"><h2 id="brand-dialog-title">{editing ? '编辑品牌官网' : '新增品牌官网'}</h2><button type="button" className="icon-close" aria-label="关闭" onClick={() => setEditing(undefined)}>×</button></div>
            <div className="form-grid">
              <label>品牌代码<input required disabled={Boolean(editing)} value={String(form.code)} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="例如 rheem" /></label>
              <label>排序<input required type="number" min="0" max="9999" value={Number(form.sortOrder)} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
              <label>中文名称<input required value={String(form.nameCn)} onChange={(e) => setForm({ ...form, nameCn: e.target.value })} /></label>
              <label>英文名称<input required value={String(form.nameEn)} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></label>
              <label>应用标识<input value={String(form.appKey)} onChange={(e) => setForm({ ...form, appKey: e.target.value })} placeholder="例如 rheem-cn" /></label>
              <label>交付方式<select value={String(form.deliveryType)} onChange={(e) => setForm({ ...form, deliveryType: e.target.value })}><option value="self_hosted">自建</option><option value="external">外链</option></select></label>
              <label className="span-2">开发地址<input type="url" value={String(form.developmentUrl)} onChange={(e) => setForm({ ...form, developmentUrl: e.target.value })} placeholder="http://localhost:5014" /></label>
              <label className="span-2">生产地址<input type="url" value={String(form.productionUrl)} onChange={(e) => setForm({ ...form, productionUrl: e.target.value })} placeholder="https://www.example.com" /></label>
              <label>状态<select value={String(form.status)} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">启用</option><option value="inactive">停用</option></select></label>
              <label>Logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogo(e.target.files?.[0] || null)} /><small>PNG、JPEG、WebP 或 SVG，不超过 2MB</small></label>
              <label className="span-2">站点备注<textarea rows={3} value={String(form.siteNote)} onChange={(e) => setForm({ ...form, siteNote: e.target.value })} /></label>
            </div>
            <div className="dialog-actions"><button type="button" className="btn ghost" onClick={() => setEditing(undefined)}>取消</button><button className="btn" disabled={saving}>{saving ? '保存中...' : '保存'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
