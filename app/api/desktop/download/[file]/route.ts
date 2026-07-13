import { NextResponse, type NextRequest } from 'next/server';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { Readable } from 'node:stream';
import { resolveReleaseFile } from '@/lib/desktop/releases';

/**
 * GET /api/desktop/download/<file>
 *
 * 流式下发桌面端安装包 (§desktop 自托管更新). 由 /api/desktop/update 指向此处.
 * 防目录穿越: 文件名经 resolveReleaseFile 校验, 仅允许更新目录内的平面文件名.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { file: string } },
) {
  const fileName = decodeURIComponent(params.file);
  const full = resolveReleaseFile(fileName);
  if (!full) {
    return NextResponse.json({ error: 'invalid_file' }, { status: 400 });
  }

  let size: number;
  try {
    const stat = await fs.stat(full);
    if (!stat.isFile()) throw new Error('not a file');
    size = stat.size;
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const nodeStream = createReadStream(full);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(size),
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
