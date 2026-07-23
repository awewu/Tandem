'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  isEditableProduct,
  loadProductWorkspace,
  readFileBase64,
  requestJson,
  type AssetRef,
  type ProductRecord,
  type Taxonomy,
} from '../lib/product-operations';

interface AssetRow extends AssetRef {
  product: ProductRecord;
}

export default function DamLibraryManager() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({});
  const [tenantId, setTenantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [productSku, setProductSku] = useState('');
  const [role, setRole] = useState('card');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const workspace = await loadProductWorkspace();
      setProducts(workspace.products);
      setTaxonomy(workspace.taxonomy);
      setTenantId(workspace.tenantId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'DAM 加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener('nexus-session-changed', reload);
    return () => window.removeEventListener('nexus-session-changed', reload);
  }, [load]);

  const editableProducts = useMemo(
    () => products.filter((product) => isEditableProduct(product, tenantId)),
    [products, tenantId],
  );
  const assets = useMemo<AssetRow[]>(
    () => products.flatMap((product) => (product.assetRefs || []).map((asset) => ({ ...asset, product }))),
    [products],
  );

  function openUpload() {
    if (!editableProducts.length) {
      setError('当前品牌租户暂无可挂载素材的产品，请先在“品牌产品库”上新。');
      return;
    }
    setProductSku(editableProducts[0].sku);
    setRole(taxonomy.assetRoles?.[0]?.code || 'card');
    setFile(null);
    setOpen(true);
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    const product = editableProducts.find((item) => item.sku === productSku);
    if (!file || !product) return;
    setUploading(true);
    setError('');
    try {
      const artifact = await requestJson('/api/file-artifact/upload-base64', {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'product-image',
          entityId: product.sku,
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64: await readFileBase64(file),
        }),
      });
      const nextRef: AssetRef = {
        role,
        artifactId: artifact.id,
        objectKey: artifact.fileKey,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
      };
      const assetRefs = [
        ...(product.assetRefs || []).filter((asset) => asset.role !== role),
        nextRef,
      ];
      await requestJson('/api/product-catalog/devices', {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          category: product.category,
          listPrice: Number(product.listPrice || 0),
          costPrice: Number(product.costPrice || 0),
          status: product.status,
          spec: product.spec || {},
          positioning: product.positioning || {},
          meta: {
            ...(product.meta || {}),
            imageArtifactId: artifact.id,
            imageObjectKey: artifact.fileKey,
            imageMimeType: nextRef.mimeType,
            imageRole: role,
            imageOwned: true,
          },
          assetRefs,
        }),
      });
      setOpen(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '素材上传失败');
    } finally {
      setUploading(false);
    }
  }

  const roleLabel = (code: string) => taxonomy.assetRoles?.find((item) => item.code === code)?.label || code;

  return (
    <div className="operations-workspace">
      <div className="manager-toolbar">
        <div className="dam-summary">
          <div><span>素材资产</span><strong>{assets.length}</strong></div>
          <div><span>已挂载产品</span><strong>{new Set(assets.map((asset) => asset.product.sku)).size}</strong></div>
        </div>
        <div className="toolbar-actions">
          <button className="btn ghost" type="button" onClick={() => void load()} disabled={loading}>刷新</button>
          <button className="btn" type="button" onClick={openUpload}>上传素材</button>
        </div>
      </div>
      {error && <div className="manager-alert" role="alert">{error}</div>}
      <div className="table-scroll">
        <table>
          <thead><tr><th>文件</th><th>素材角色</th><th>关联产品</th><th>品牌</th><th>存储键</th><th>来源</th></tr></thead>
          <tbody>
            {loading ? <tr><td className="empty" colSpan={6}>加载中...</td></tr> : assets.length === 0 ? (
              <tr><td className="empty" colSpan={6}>暂无素材。点击“上传素材”并关联品牌产品。</td></tr>
            ) : assets.map((asset) => (
              <tr key={`${asset.product.sku}:${asset.role}:${asset.artifactId}`}>
                <td><strong>{asset.filename || asset.artifactId}</strong><small>{asset.mimeType || '未知格式'}</small></td>
                <td><span className="badge info">{roleLabel(asset.role)}</span></td>
                <td>{asset.product.name}<small>{asset.product.sku}</small></td>
                <td>{asset.product.brand || '未分类'}</td>
                <td className="artifact-key">{asset.objectKey || '—'}</td>
                <td><span className="badge">{isEditableProduct(asset.product, tenantId) ? '品牌运营库' : '共享目录'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <form className="brand-dialog asset-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title" onSubmit={upload}>
            <div className="dialog-head"><h2 id="asset-dialog-title">上传产品素材</h2><button className="icon-close" type="button" aria-label="关闭" onClick={() => setOpen(false)}>×</button></div>
            <div className="form-grid">
              <label className="span-2">关联产品<select value={productSku} onChange={(event) => setProductSku(event.target.value)}>{editableProducts.map((product) => <option key={product.sku} value={product.sku}>{product.name} · {product.sku}</option>)}</select></label>
              <label>素材角色<select value={role} onChange={(event) => setRole(event.target.value)}>{(taxonomy.assetRoles || [{ code: 'card', label: '卡片图' }]).map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label>
              <label>文件<input required type="file" accept="image/*,.pdf,.ifc,.rfa,.zip" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
            </div>
            <div className="dialog-actions"><button className="btn ghost" type="button" onClick={() => setOpen(false)}>取消</button><button className="btn" disabled={uploading || !file}>{uploading ? '上传中...' : '上传并挂载'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
