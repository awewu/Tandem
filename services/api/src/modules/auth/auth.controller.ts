import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OidcSsoCallbackService } from './oidc-sso-callback.service';
import { OidcSsoLoginService } from './oidc-sso-login.service';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import type { UserRole } from './auth.entity';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly svc: AuthService,
    private readonly oidcSsoLogin: OidcSsoLoginService,
    private readonly oidcSsoCallback: OidcSsoCallbackService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: { phone: string; password: string }) {
    return this.svc.login(body.phone, body.password);
  }

  @Public()
  @Get('sso/login')
  async ssoLogin(@Query('redirect') redirect: string | string[] | undefined, @Res() res: any) {
    try {
      const next = await this.oidcSsoLogin.createLoginRedirect(redirect);
      return res
        .status(302)
        .header('Set-Cookie', next.cookies)
        .header('Location', next.location)
        .send();
    } catch {
      return res
        .status(302)
        .header('Location', '/?returnUrl=%2Fbrand&ssoError=sso_unavailable')
        .send();
    }
  }

  @Public()
  @Get('sso/callback')
  async ssoCallback(
    @Query('code') code: string | string[] | undefined,
    @Query('state') state: string | string[] | undefined,
    @Req() req: any,
    @Res() res: any,
  ) {
    try {
      const next = await this.oidcSsoCallback.handleCallback({
        code,
        state,
        cookieHeader: req.headers?.cookie,
        requestId: this.firstHeader(req, 'x-request-id') || this.firstHeader(req, 'x-correlation-id'),
        traceId: this.firstHeader(req, 'x-trace-id'),
      });
      return res
        .status(302)
        .header('Set-Cookie', next.cookies)
        .header('Location', next.location)
        .send();
    } catch (error: any) {
      const reason = this.ssoFailureReason(error);
      const landingReason = reason === 'pending_authorization' ? 'unauthorized' : 'sso_callback_failed';
      return res
        .status(302)
        .header('Set-Cookie', this.oidcSsoCallback.clearTransientCookies())
        .header('Location', `/?returnUrl=%2Fbrand&ssoError=${landingReason}`)
        .send();
    }
  }

  private firstHeader(req: any, name: string): string | undefined {
    const value = req.headers?.[name];
    if (Array.isArray(value)) return value[0];
    return typeof value === 'string' ? value : undefined;
  }

  private ssoFailureReason(error: unknown): string {
    if (typeof this.oidcSsoCallback.failureReason === 'function') {
      return this.oidcSsoCallback.failureReason(error);
    }
    return 'unexpected';
  }

  @Public()
  @Post('send-sms')
  @HttpCode(200)
  sendSms(@Body() body: { phone: string }) {
    return this.svc.sendSmsCode(body.phone);
  }

  @Public()
  @Post('login-sms')
  @HttpCode(200)
  loginSms(@Body() body: { phone: string; smsCode: string }) {
    return this.svc.loginWithSms(body.phone, body.smsCode);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() req: any) { return this.svc.getMe(req.user); }

  // Legacy /api/auth/user 与 /api/auth/me 等价；NestJS v2 保留以兼容旧前端。
  @Get('user')
  @UseGuards(AuthGuard)
  user(@Req() req: any) { return this.svc.getMe(req.user); }

  @Put('user')
  @UseGuards(AuthGuard)
  updateUser(@Req() req: any, @Body() body: { name?: string }) {
    return this.svc.updateUser(req.user.userId, body);
  }

  @Put('password')
  @UseGuards(AuthGuard)
  changePassword(@Req() req: any, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.svc.changePassword(req.user.userId, body.oldPassword, body.newPassword);
  }

  @Post('refresh-token')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  refresh(@Req() req: any) { return this.svc.refreshToken(req.user); }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  logout() { return this.svc.logout(); }

  // 经销商自助注册（注册即用 + 事后限权）。品牌员工账号仍须走后台开户。
  @Public()
  @Post('register')
  register(@Body() body: { identifier?: string; phone?: string; email?: string; password: string; name?: string; companyName?: string }) {
    return this.svc.register(body);
  }

  // ── 管理员账号管理（租户内）。@Roles 限管理员角色；dealer_admin 仅可管本经销商非管理员账号。──
  @Get('admin/users')
  @UseGuards(AuthGuard)
  @Roles('platform_admin', 'hq_admin', 'dealer_admin')
  adminListUsers(@Req() req: any, @Query() q: { search?: string; role?: string; status?: string }) {
    return this.svc.adminListUsers(req.user, q);
  }

  @Post('admin/users')
  @UseGuards(AuthGuard)
  @Roles('platform_admin', 'hq_admin', 'dealer_admin')
  adminCreateUser(@Req() req: any, @Body() body: { identifier: string; password: string; name?: string; role: UserRole; dealerId?: string | null; storeId?: string | null }) {
    return this.svc.adminCreateUser(req.user, body);
  }

  @Patch('admin/users/:id')
  @UseGuards(AuthGuard)
  @Roles('platform_admin', 'hq_admin', 'dealer_admin')
  adminUpdateUser(@Req() req: any, @Param('id') id: string, @Body() body: { role?: UserRole; status?: 'active' | 'inactive' | 'suspended'; name?: string; dealerId?: string | null; storeId?: string | null }) {
    return this.svc.adminUpdateUser(req.user, id, body);
  }

  @Post('admin/users/:id/reset-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @Roles('platform_admin', 'hq_admin', 'dealer_admin')
  adminResetPassword(@Req() req: any, @Param('id') id: string, @Body() body: { newPassword: string }) {
    return this.svc.adminResetPassword(req.user, id, body.newPassword);
  }

  @Delete('admin/users/:id')
  @UseGuards(AuthGuard)
  @Roles('platform_admin', 'hq_admin', 'dealer_admin')
  adminDeleteUser(@Req() req: any, @Param('id') id: string) {
    return this.svc.adminDeleteUser(req.user, id);
  }
}
