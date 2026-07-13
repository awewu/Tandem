import { NextResponse, type NextRequest } from 'next/server';
import { readManifest, compareVersions } from '@/lib/desktop/releases';

/**
 * GET /api/desktop/update/{{target}}/{{arch}}/{{current_version}}
 *
 * Tauri v2 updater 动态端点 (§desktop 自托管更新).
 *   - 无新版本 → 204 No Content (updater 视为已最新).
 *   - 有新版本 → 200 + 动态格式 JSON:
 *       { version, notes, pub_date, url, signature }
 *
 * url 指向同服务器的下载端点 (绝对地址, 由请求 origin 推导, 兼容反代 x-forwarded-*).
 */
export const dynamic = 'force-dynamic';

function originOf(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (proto && host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { target: string; arch: string; version: string } },
) {
  const manifest = await readManifest();
  if (!manifest) {
    return new NextResponse(null, { status: 204 });
  }

  // 已是最新 (或更高) → 无更新
  if (compareVersions(manifest.version, params.version) <= 0) {
    return new NextResponse(null, { status: 204 });
  }

  const platformKey = `${params.target}-${params.arch}`;
  const platform = manifest.platforms[platformKey];
  if (!platform || !platform.file || !platform.signature) {
    // 该平台没有对应安装包 → 不提供更新
    return new NextResponse(null, { status: 204 });
  }

  const url = `${originOf(req)}/api/desktop/download/${encodeURIComponent(platform.file)}`;

  return NextResponse.json({
    version: manifest.version,
    notes: manifest.notes ?? '',
    pub_date: manifest.pubDate ?? new Date().toISOString(),
    url,
    signature: platform.signature,
  });
}
