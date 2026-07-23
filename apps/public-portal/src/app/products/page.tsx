import PageHero from '../../components/PageHero';
import { listSiteProducts } from '../../lib/site-products';
import ProductCatalog from './ProductCatalog';

export default async function ProductsPage() {
  const result = await listSiteProducts();

  return (
    <main id="main">
      <PageHero
        minHeight={320}
        eyebrow="PRODUCT CATALOG · 产品目录"
        title={<>集团产品<span style={{ color: 'var(--rh-green)' }}>系列</span></>}
        lead={<>浏览 Rheem、Ruud、Everhot 等品牌在集团官网明确发布的产品。</>}
      />
      <ProductCatalog products={result.items} unavailable={!result.ok} />
    </main>
  );
}
