import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OidcSsoCallbackService } from './oidc-sso-callback.service';
import { OidcSsoLoginService } from './oidc-sso-login.service';
import { UserEntity } from './auth.entity';
import { ExternalIdentityBindingEntity } from './external-identity-binding.entity';
import { OtpChallengeEntity } from './otp-challenge.entity';
import { OtpService } from './otp.service';
import { SsoAuditLogService } from './sso-audit-log.service';
import { SsoExternalIdentityService } from './sso-external-identity.service';
import { DefaultSmsSender, SMS_SENDER } from './sms-sender';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

// Fail-fast JWT secret resolution: never fall back to a known dev secret in
// production. Mirrors server/modules/authRuntime.js + authenticateV2.js so the
// whole platform shares one rule. Boot-smoke is treated as non-prod.
function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production' && !TARGET_API_BOOT_SMOKE) {
    throw new Error('FATAL: JWT_SECRET is required in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[Auth] ⚠️  JWT_SECRET 未配置，使用开发默认值。生产上线前必须设置 JWT_SECRET。');
  return 'rhautt-comfort-dev-secret-NEVER-USE-IN-PRODUCTION';
}

@Module({
  imports: [
    ConfigModule,
    ...(TARGET_API_BOOT_SMOKE
      ? []
      : [TypeOrmModule.forFeature([UserEntity, OtpChallengeEntity, ExternalIdentityBindingEntity])]),
    EntitlementModule,
    JwtModule.register({
      secret: resolveJwtSecret(),
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OidcSsoLoginService,
    OidcSsoCallbackService,
    SsoAuditLogService,
    SsoExternalIdentityService,
    AuthGuard,
    OtpService,
    { provide: SMS_SENDER, useClass: DefaultSmsSender },
    ...(TARGET_API_BOOT_SMOKE
      ? [
          bootSmokeRepositoryProvider(UserEntity),
          bootSmokeRepositoryProvider(OtpChallengeEntity),
          bootSmokeRepositoryProvider(ExternalIdentityBindingEntity),
        ]
      : [])
  ],
  exports: [AuthGuard, JwtModule, SsoExternalIdentityService],
})
export class AuthModule {}

// ── Boundary contract (test evidence) ─────────────────────────────────────
import { Controller, Get, Injectable } from '@nestjs/common';
import { getApiModuleBoundary } from '../module-boundary';

@Injectable()
export class AuthBoundaryService {
  boundary() {
    const spec = getApiModuleBoundary('auth');
    return { tenantScope: spec.requiresTenantScope, auditLog: spec.requiresAuditLog, openApiContract: spec.requiresOpenApiContract };
  }
}
@Controller('auth')
export class AuthBoundaryController {
  constructor(private readonly s: AuthBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}
