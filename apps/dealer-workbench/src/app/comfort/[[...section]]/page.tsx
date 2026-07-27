import BrandSiteConsoleShell from './BrandSiteConsoleShell';
import BrandSitesManager from './BrandSitesManager';

const LEGACY_COMFORT_PORT = 5010;

export default async function ComfortWorkspacePage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  if (section?.[0] === 'sites') {
    const brandCode = section[1];
    if (brandCode) return <BrandSiteConsoleShell brandCode={brandCode} />;
    return <BrandSitesManager brandCode="all" />;
  }

  const suffix = section?.length ? `/${section.map(encodeURIComponent).join('/')}` : '';
  const src = `http://localhost:${LEGACY_COMFORT_PORT}/comfort${suffix}`;

  return (
    <div className="embedded-workspace">
      <iframe src={src} title="品牌与市场中枢" className="embedded-workspace-frame" />
    </div>
  );
}
