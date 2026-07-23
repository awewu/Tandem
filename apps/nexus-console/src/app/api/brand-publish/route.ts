import { execFile } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/api';

const run = promisify(execFile);
const PUBLISH_ROLES = new Set(['platform_admin', 'hq_admin', 'brand_admin', 'admin']);

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!PUBLISH_ROLES.has(user.role || '')) {
    return NextResponse.json({ error: '当前角色没有品牌站点发布权限' }, { status: 403 });
  }

  const cwd = process.cwd();
  const repoRoot = basename(cwd) === 'nexus-console' ? resolve(cwd, '../..') : cwd;
  const everhotDir = resolve(repoRoot, 'apps/everhot-cn');
  const scripts = [
    join(everhotDir, 'scripts/fetch-products-from-nexus.mjs'),
    join(everhotDir, 'scripts/fetch-product-images-from-dam.mjs'),
  ];
  const base = `${process.env.NEXUS_API_URL || 'http://localhost:5500'}${process.env.NEXUS_API_PREFIX ?? '/api/v2'}`;
  const logs: string[] = [];

  try {
    for (const script of scripts) {
      const { stdout, stderr } = await run('node', [script, '--base', base], {
        cwd: everhotDir,
        env: { ...process.env },
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      logs.push(`$ ${basename(script)}`, stdout.trim(), stderr.trim());
    }
    return NextResponse.json({ ok: true, log: logs.filter(Boolean).join('\n') });
  } catch (cause: any) {
    logs.push(`发布失败：${cause.message}`, String(cause.stdout || ''), String(cause.stderr || ''));
    return NextResponse.json(
      { error: cause.message, log: logs.filter(Boolean).join('\n') },
      { status: 500 },
    );
  }
}
