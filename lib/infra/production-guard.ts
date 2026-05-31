/**
 * Production Guard · 生产启动硬化检查 (P4-13)
 *
 * 在 boot.ts 早期调用. 生产模式下若任一关键配置缺失/弱值, 抛错阻止启动.
 *
 * 检查项:
 *   - NEXTAUTH_SECRET / SESSION_SECRET: 必须存在 + ≥32 chars + 非默认占位
 *   - DATABASE_URL: 必须存在 (生产不允许 in-memory)
 *   - MFA_ENCRYPTION_KEY: 推荐显式设, 否则警告 (回落 NEXTAUTH_SECRET)
 *   - ALLOW_DEMO_AUTH: 生产环境必须 != 1 (否则任何人能 bypass auth)
 *   - TANDEM_BOOTSTRAP_OWNER_PASSWORD: 不允许是 'TempPass-Change-...' 默认占位
 *   - NEXTAUTH_URL: 生产建议 https://
 *   - BCRYPT_ROUNDS: 生产 ≥10
 *
 * 警告项 (不阻止启动, 只 console.warn):
 *   - REDIS_URL 未设 (rate-limit 退化为内存)
 *   - S3_ENDPOINT 未设 (drive 退化为本地)
 *   - SENTRY_DSN 未设 (无错误监控)
 */

const WEAK_SECRET_PATTERNS = [
  /^change[-_]?me/i,
  /^placeholder/i,
  /^secret$/i,
  /^test/i,
  /^dev/i,
  /^[a-z0-9]{1,16}$/i, // <16 chars 弱
];

const DEFAULT_BOOTSTRAP_PASSWORDS = [
  'TempPass-Change-On-First-Login-2026!',
  'ChangeMeAtFirstLogin!2026',
  'admin',
  'password',
  '123456',
];

function isWeakSecret(s: string | undefined): boolean {
  if (!s) return true;
  if (s.length < 32) return true;
  return WEAK_SECRET_PATTERNS.some((re) => re.test(s));
}

export interface GuardResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function runProductionGuard(): GuardResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const isProd = process.env.NODE_ENV === 'production';

  // ───── 关键 (errors → 阻止启动) ─────
  const sessionSecret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (isProd && isWeakSecret(sessionSecret)) {
    errors.push(
      'NEXTAUTH_SECRET / SESSION_SECRET 缺失或过弱 (需 ≥32 字符, 非占位值). ' +
        '生成: `openssl rand -base64 48`'
    );
  }

  if (isProd && !process.env.DATABASE_URL) {
    errors.push(
      'DATABASE_URL 必须配置 (生产不允许 in-memory; 数据重启即丢失).'
    );
  }

  if (isProd && process.env.ALLOW_DEMO_AUTH === '1') {
    errors.push(
      'ALLOW_DEMO_AUTH=1 不允许在生产环境启用 (会让任何未登录请求 bypass 鉴权, 拿到 admin 角色).'
    );
  }

  const bootstrapPw = process.env.TANDEM_BOOTSTRAP_OWNER_PASSWORD;
  if (isProd && bootstrapPw && DEFAULT_BOOTSTRAP_PASSWORDS.includes(bootstrapPw)) {
    errors.push(
      'TANDEM_BOOTSTRAP_OWNER_PASSWORD 是默认占位密码, 必须改成强随机值再启动生产.'
    );
  }

  const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? '10');
  if (isProd && bcryptRounds < 10) {
    errors.push(`BCRYPT_ROUNDS=${bcryptRounds} 过低 (生产 ≥10).`);
  }

  // ───── 警告 (warnings → 不阻止) ─────
  if (isProd && !process.env.MFA_ENCRYPTION_KEY) {
    warnings.push('MFA_ENCRYPTION_KEY 未显式配置, 回退到 NEXTAUTH_SECRET 派生. 建议生成独立 key.');
  }

  const nextauthUrl = process.env.NEXTAUTH_URL;
  if (isProd && nextauthUrl && !nextauthUrl.startsWith('https://')) {
    warnings.push(`NEXTAUTH_URL=${nextauthUrl} 不是 https://, cookie SameSite/Secure 可能失效.`);
  }

  const replicas = Number(process.env.APP_REPLICAS ?? '1');
  if (isProd && !process.env.REDIS_URL) {
    if (replicas > 1) {
      // B7: 多副本无 Redis = cron 重复执行 (重复 KPI 快照/escalate) + 限流各副本独立失效, 必须拦
      errors.push(
        `APP_REPLICAS=${replicas} (多副本) 但 REDIS_URL 未设. 多副本必须配 Redis: ` +
          'cron 单飞行 (lib/infra/leader.ts) 与分布式限流都依赖它, 否则定时任务重复执行 + 限流失效.',
      );
    } else {
      warnings.push('REDIS_URL 未设, rate-limit / cron 单飞行退化为单进程内存 (仅单副本安全; 多副本请设 APP_REPLICAS).');
    }
  }

  if (isProd && !process.env.S3_ENDPOINT) {
    warnings.push('S3_ENDPOINT 未设, Drive 文件上传退化为本地存储 (容器重启文件丢失).');
  }

  if (isProd && !process.env.SENTRY_DSN) {
    warnings.push('SENTRY_DSN 未设, 错误无远程聚合 (仅 stdout).');
  }

  // LLM 至少要一个
  const hasLlm =
    !!process.env.DEEPSEEK_API_KEY ||
    !!process.env.OPENAI_API_KEY ||
    !!process.env.ANTHROPIC_API_KEY ||
    !!process.env.OLLAMA_BASE_URL;
  if (isProd && !hasLlm) {
    errors.push('生产模式下至少配置一个 LLM provider (DEEPSEEK_API_KEY / OPENAI_API_KEY / ...).');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * 在 boot.ts 调用. 生产环境失败则 throw (process exit).
 * 开发/test/build 环境只 console.warn (不阻止 next build prerender).
 *
 * 跳过条件:
 *   - NEXT_PHASE === 'phase-production-build' (next build 期间, env 通常是占位)
 *   - SKIP_STARTUP_GUARD=1 (CI/手动调试 escape hatch)
 */
export function enforceProductionGuard(): void {
  const r = runProductionGuard();
  const isProd = process.env.NODE_ENV === 'production';
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  const skipExplicit = process.env.SKIP_STARTUP_GUARD === '1';

  if (r.warnings.length > 0) {
    for (const w of r.warnings) {
      // eslint-disable-next-line no-console
      console.warn(`[startup-guard] WARN: ${w}`);
    }
  }

  if (r.errors.length > 0) {
    for (const e of r.errors) {
      // eslint-disable-next-line no-console
      console.error(`[startup-guard] FATAL: ${e}`);
    }
    if (isProd && !isBuildPhase && !skipExplicit) {
      throw new Error(
        `生产启动检查失败 (${r.errors.length} 项), 请按以上提示修正环境变量再启动. ` +
          '详见 lib/infra/production-guard.ts 与 .env.example.'
      );
    }
  } else if (isProd && !isBuildPhase) {
    // eslint-disable-next-line no-console
    console.info('[startup-guard] ✓ 所有关键配置就绪');
  }
}
