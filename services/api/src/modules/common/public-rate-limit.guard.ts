import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * 轻量内存频率限制守卫（零新依赖）— 用于 L5 公开面（@Public 匿名端点）防滥用。
 * 固定窗口，按「客户端 IP + 路由」计数；命中上限抛 429。
 * 通过 `x-forwarded-for` 首跳识别真实来源（legacy 同源代理 :3000 → :3300 场景）。
 * 阈值可用环境变量覆盖：PUBLIC_RATE_LIMIT（默认 60）/ PUBLIC_RATE_WINDOW_MS（默认 60000）。
 * 注意：内存态，仅单实例有效；多实例部署需替换为共享存储（Redis）。
 */
@Injectable()
export class PublicRateLimitGuard implements CanActivate {
  private readonly limit = Number(process.env.PUBLIC_RATE_LIMIT || 60);
  private readonly windowMs = Number(process.env.PUBLIC_RATE_WINDOW_MS || 60_000);
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  canActivate(ctx: ExecutionContext): boolean {
    const req: any = ctx.switchToHttp().getRequest();
    const now = Date.now();
    this.sweep(now);

    const fwd = (req.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    const ip = fwd || req.ip || req.socket?.remoteAddress || 'unknown';
    const route = req.routeOptions?.url || req.url || 'route';
    const key = `${ip}::${route}`;

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpException(
        { success: false, error: '请求过于频繁，请稍后再试', retryAfterSeconds },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    bucket.count += 1;
    return true;
  }

  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [k, v] of this.buckets) {
      if (v.resetAt <= now) this.buckets.delete(k);
    }
  }
}
