import { WORKBENCH_PORTS } from '../../../lib/workbench-navigation';
import BrandSiteConsoleShell from './BrandSiteConsoleShell';
import BrandSitesManager from './BrandSitesManager';
import SiteProductShelfManager from './SiteProductShelfManager';

export default async function ComfortWorkspacePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  if (section?.[0] === 'sites') {
    const brandCode = section[1];
    if (brandCode && section[2] === 'library') return <SiteProductShelfManager siteCode={brandCode} />;
    if (brandCode) return <BrandSiteConsoleShell brandCode={brandCode} />;
    return <BrandSitesManager brandCode="all" />;
  }

  const suffix = section?.length ? `/${section.map(encodeURIComponent).join('/')}` : '';
  const src = `http://localhost:${WORKBENCH_PORTS.nexus}/comfort${suffix}`;

  return (
    <div className="embedded-workspace">
      <iframe src={src} title="品牌与市场中枢" className="embedded-workspace-frame" />
    </div>
  );
}
