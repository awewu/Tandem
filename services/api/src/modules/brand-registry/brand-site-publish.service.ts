import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { execFile, type ExecFileOptions } from 'node:child_process';
import { resolve } from 'node:path';
import type { JwtPayload } from '../auth/auth.service';

export type BrandPublishCapability = {
  supported: boolean;
  mode: 'static-backup' | 'unsupported';
  label: string;
  reason: string;
};

export type BrandPublishTarget = {
  id: string;
  code: string;
  appKey: string | null;
  deliveryType?: 'self_hosted' | 'external';
  status: 'active' | 'inactive';
  deletedAt?: Date | string | null;
};

export type BrandPublishCommand = {
  label: string;
  file: string;
  args: string[];
};

export type BrandPublishPlan = {
  brandCode: string;
  appKey: string;
  mode: 'static-backup';
  cwd: string;
  commands: BrandPublishCommand[];
};

export type BrandPublishRunner = (
  file: string,
  args: string[],
  options: ExecFileOptions,
) => Promise<{ stdout: string; stderr: string }>;

const WRITE_ROLES = new Set(['platform_admin', 'hq_admin', 'brand_admin']);
const EVERHOT_APP_KEY = 'everhot-cn';

export function requireBrandPublishWrite(user: Pick<JwtPayload, 'role'>): void {
  if (!WRITE_ROLES.has(user?.role)) throw new ForbiddenException('当前角色无品牌发布权限');
}

export function resolveBrandPublishCapability(site: BrandPublishTarget): BrandPublishCapability {
  if (site.deletedAt) return unsupported('已归档品牌站点不能发布');
  if (site.status !== 'active') return unsupported('品牌站点已停用，不能发布');
  if (site.deliveryType === 'external') return unsupported('外部托管品牌暂不支持 Nexus 静态备份');
  if (site.code === 'everhot' && site.appKey === EVERHOT_APP_KEY) {
    return {
      supported: true,
      mode: 'static-backup',
      label: '生成静态备份',
      reason: '从 Nexus 重生成 Everhot 产品数据和产品图片静态快照',
    };
  }
  return unsupported(`品牌 ${site.code} 尚未配置服务端静态备份流程`);
}

export function createBrandPublishPlan(
  site: BrandPublishTarget,
  user: Pick<JwtPayload, 'tenantId'>,
  options: { workspaceRoot?: string; apiBase?: string; productTenantId?: string } = {},
): BrandPublishPlan {
  const capability = resolveBrandPublishCapability(site);
  if (!capability.supported) throw new ConflictException(capability.reason);

  const workspaceRoot = options.workspaceRoot || resolveWorkspaceRoot();
  const cwd = resolve(workspaceRoot, 'apps', EVERHOT_APP_KEY);
  const apiBase = options.apiBase || resolveApiBase();
  const productTenantId = options.productTenantId
    || process.env.BRAND_PUBLISH_EVERHOT_TENANT_ID
    || process.env.EVERHOT_TENANT_ID
    || user.tenantId;

  return {
    brandCode: site.code,
    appKey: EVERHOT_APP_KEY,
    mode: 'static-backup',
    cwd,
    commands: [
      {
        label: '刷新公开产品数据',
        file: resolve(cwd, 'scripts', 'fetch-products-from-nexus.mjs'),
        args: ['--base', apiBase],
      },
      {
        label: '刷新 DAM 产品图片',
        file: resolve(cwd, 'scripts', 'fetch-product-images-from-dam.mjs'),
        args: ['--base', apiBase, '--tenant', productTenantId],
      },
    ],
  };
}

export async function executeBrandPublishPlan(
  plan: BrandPublishPlan,
  runner: BrandPublishRunner = runExecFile,
) {
  const startedAt = new Date();
  const logs = [
    `品牌：${plan.brandCode}`,
    `模式：${plan.mode}`,
    `开始：${startedAt.toISOString()}`,
  ];

  try {
    for (const command of plan.commands) {
      logs.push(`\n[${command.label}]`, `$ node ${command.file.split(/[\\/]/).pop()}`);
      const result = await runner(process.execPath, [command.file, ...command.args], {
        cwd: plan.cwd,
        env: { ...process.env },
        timeout: 60_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      });
      appendOutput(logs, result.stdout, result.stderr);
    }
  } catch (error) {
    const failure = error as Error & { stdout?: string | Buffer; stderr?: string | Buffer };
    logs.push(`\n失败：${failure.message}`);
    appendOutput(logs, failure.stdout, failure.stderr);
    throw new BrandPublishExecutionError(failure.message, logs.filter(Boolean).join('\n'));
  }

  const finishedAt = new Date();
  logs.push(`\n完成：${finishedAt.toISOString()}`);
  return {
    ok: true,
    brandCode: plan.brandCode,
    mode: plan.mode,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    log: logs.filter(Boolean).join('\n'),
  };
}

@Injectable()
export class BrandSitePublishService {
  async publish(user: JwtPayload, site: BrandPublishTarget) {
    requireBrandPublishWrite(user);
    const capability = resolveBrandPublishCapability(site);
    if (!capability.supported) {
      throw new ConflictException({
        message: capability.reason,
        code: 'BRAND_PUBLISH_UNSUPPORTED',
        capability,
      });
    }

    try {
      return await executeBrandPublishPlan(createBrandPublishPlan(site, user));
    } catch (error) {
      if (error instanceof BrandPublishExecutionError) {
        throw new InternalServerErrorException({
          message: '品牌静态备份执行失败',
          error: error.message,
          log: error.log,
        });
      }
      throw error;
    }
  }
}

export class BrandPublishExecutionError extends Error {
  constructor(message: string, readonly log: string) {
    super(message);
    this.name = 'BrandPublishExecutionError';
  }
}

function unsupported(reason: string): BrandPublishCapability {
  return { supported: false, mode: 'unsupported', label: '暂不支持发布', reason };
}

function resolveWorkspaceRoot(): string {
  const configured = process.env.BRAND_SITE_WORKSPACE_ROOT;
  if (configured) return resolve(configured);
  const cwd = process.cwd();
  return cwd.endsWith(`${resolve('services', 'api')}`) ? resolve(cwd, '..', '..') : cwd;
}

function resolveApiBase(): string {
  const origin = String(process.env.NEXUS_API_URL || 'http://127.0.0.1:5500').replace(/\/+$/, '');
  const prefix = String(process.env.NEXUS_API_PREFIX ?? '/api/v2').replace(/^\/*/, '/').replace(/\/+$/, '');
  return origin.endsWith(prefix) ? origin : `${origin}${prefix}`;
}

function appendOutput(logs: string[], stdout?: string | Buffer, stderr?: string | Buffer) {
  const out = String(stdout || '').trim();
  const err = String(stderr || '').trim();
  if (out) logs.push(out);
  if (err) logs.push(err);
}

function runExecFile(file: string, args: string[], options: ExecFileOptions) {
  return new Promise<{ stdout: string; stderr: string }>((resolvePromise, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stdout, stderr });
        reject(error);
        return;
      }
      resolvePromise({ stdout: String(stdout || ''), stderr: String(stderr || '') });
    });
  });
}
