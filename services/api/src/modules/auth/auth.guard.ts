import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../common/public.decorator';

const NX_COOKIE_NAME = 'nx_token';

function extractTokenFromCookie(req: any): string | null {
  try {
    const cookieHeader = req.headers?.cookie ?? '';
    if (!cookieHeader) return null;
    const match = cookieHeader.match(new RegExp('(?:^|;\\s*)' + NX_COOKIE_NAME + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

// Accepts UUID, Mongo ObjectId, or a conservative slug (seed data uses varchar
// tenant/dealer/store ids that are not always UUIDs). Rejects empty strings,
// whitespace and non-string payloads — closing the "no tenant-scope check" gap
// flagged in the security audit (H2), mirroring server/middleware/authenticateV2.js.
const ID_LIKE = /^(?:[0-9a-fA-F]{24}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[a-zA-Z0-9][a-zA-Z0-9_-]{1,63})$/;

function isValidId(value: unknown): boolean {
  return typeof value === 'string' && ID_LIKE.test(value);
}

// Optional scope fields are valid when absent (null/undefined) OR a well-formed id.
function isValidOptionalId(value: unknown): boolean {
  return value === null || value === undefined || isValidId(value);
}

export function isValidScope(user: any): boolean {
  if (!user || typeof user !== 'object') return false;
  if (!isValidId(user.userId)) return false;
  if (!isValidId(user.tenantId)) return false;
  if (!isValidOptionalId(user.dealerId)) return false;
  if (!isValidOptionalId(user.storeId)) return false;
  if (!isValidOptionalId(user.customerId)) return false;
  return true;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    // H2：全局 deny-by-default。仅 @Public() 标注的端点跳过认证。
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers?.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : extractTokenFromCookie(req);
    if (!token) throw new UnauthorizedException('缺少访问令牌');
    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('访问令牌无效');
    }
    if (!isValidScope(payload)) {
      throw new ForbiddenException('访问令牌租户范围无效');
    }
    req.user = payload;
    return true;
  }
}
