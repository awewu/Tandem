import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { getSession, canWrite } from '../../../lib/brand';

const run = promisify(execFile);

// POST 发布：重跑 everhot-cn 构建期拉取脚本，从 Nexus 重生成静态站数据/图，
// 完成「后台改 → 发布 → 站点更新」闭环。站点仍纯静态、匿名。
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: '未登录' }, { status: 401 });
  if (!canWrite(session.role)) return NextResponse.json({ error: '无发布权限（需要 brand_admin 角色）' }, { status: 403 });

  const everhotDir = resolve(process.cwd(), process.env.EVERHOT_DIR || '../everhot-cn');
  const scripts = [
    join(everhotDir, 'scripts', 'fetch-products-from-nexus.mjs'),
    join(everhotDir, 'scripts', 'fetch-product-images-from-dam.mjs'),
  ];
  const base = `${process.env.NEXUS_API_URL || 'https://web.rhautt.com'}${process.env.NEXUS_API_PREFIX ?? '/api/v2'}`;

  const logs: string[] = [];
  try {
    for (const script of scripts) {
      const { stdout, stderr } = await run('node', [script, '--base', base], {
        cwd: everhotDir,
        env: { ...process.env },
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      logs.push(`$ ${script.split('/').pop()}`, (stdout || '').trim(), (stderr || '').trim());
    }
    return NextResponse.json({ ok: true, log: logs.filter(Boolean).join('\n') });
  } catch (e: any) {
    logs.push(`✗ ${e.message}`, (e.stdout || '').toString(), (e.stderr || '').toString());
    return NextResponse.json({ ok: false, error: e.message, log: logs.filter(Boolean).join('\n') }, { status: 500 });
  }
}
