import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantContextInterceptor } from './common/tenant-context.interceptor';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './common/roles.guard';
import { PermissionsGuard } from './common/permissions.guard';
import { BrandModule } from './brand/brand.module';
import { BrandProductCategoryModule } from './brand-product-category/brand-product-category.module';
import { BrandRegistryModule } from './brand-registry/brand-registry.module';
import { ComplianceModule } from './compliance/compliance.module';
import { MdmModule } from './mdm/mdm.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuditLogInterceptor } from './audit-log/audit-log.interceptor';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { CrmModule } from './crm/crm.module';
import { DeliveryModule } from './delivery/delivery.module';
import { DesignModule } from './design/design.module';
import { DiagnosisModule } from './diagnosis/diagnosis.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { EntitlementModule } from './entitlement/entitlement.module';
import { EntitlementGuard } from './entitlement/entitlement.guard';
import { EventConsumersModule } from './event-consumers/event-consumers.module';
import { FileArtifactModule } from './file-artifact/file-artifact.module';
import { GovernanceModule } from './governance/governance.module';
import { GrowthModule } from './growth/growth.module';
import { IngressModule } from './ingress/ingress.module';
import { HealthController } from './health.controller';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { RysnovaModule } from './rysnova-bim/rysnova-bim.module';
import { AiDesignModule } from './ai-design/ai-design.module';
import { AftersalesModule } from './aftersales/aftersales.module';
import { NotificationModule } from './notification/notification.module';
import { ProductCatalogModule } from './product-catalog/product-catalog.module';
import { QuoteModule } from './quote/quote.module';
import { TenantModule } from './tenant/tenant.module';
import { WorkflowModule } from './workflow/workflow.module';
import { TARGET_API_BOOT_SMOKE, BootSmokeInfraModule } from './boot-smoke';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.DOTENV_CONFIG_PATH,
    }),
    // boot-smoke 下提供全局 DataSource 桩（@Global），供注入 DataSource 的服务实例化。
    ...(TARGET_API_BOOT_SMOKE ? [BootSmokeInfraModule] : []),
    ...(TARGET_API_BOOT_SMOKE ? [] : [
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: process.env.POSTGRES_URI,
        host: process.env.POSTGRES_HOST || 'localhost',
        port: Number(process.env.POSTGRES_PORT || 5432),
        username: process.env.POSTGRES_USER || 'rhautt',
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB || 'rhautt_nexus',
        // 与 data-source.ts 及 curated 迁移保持一致：业务表位于 rhautt_nexus schema。
        // 缺省会退回 public（旧/空表），导致 bim_projects 等实体查询 500。
        schema: process.env.POSTGRES_SCHEMA || 'rhautt_nexus',
        autoLoadEntities: true,
        // Schema is owned by curated SQL migrations (scripts/db/apply-migrations.js),
        // not TypeORM. Default OFF in EVERY environment (including dev) to prevent silent
        // entity→schema drift against the curated rhautt_nexus schema — the root cause of
        // past column drift. Opt-in only via POSTGRES_SYNCHRONIZE=true for throwaway local
        // experiments. Never run migrations through TypeORM here.
        synchronize: process.env.POSTGRES_SYNCHRONIZE === 'true',
        migrationsRun: false,
        logging: process.env.NODE_ENV === 'development',
      })
    ]),
    AuditLogModule,
    AuthModule,
    TenantModule,
    CrmModule,
    DiagnosisModule,
    ProductCatalogModule,
    QuoteModule,
    DesignModule,
    RysnovaModule,
    AiDesignModule,
    AftersalesModule,
    BrandModule,
    BrandProductCategoryModule,
    BrandRegistryModule,
    ComplianceModule,
    MdmModule,
    DeliveryModule,
    LifecycleModule,
    EventConsumersModule,
    AnalyticsModule,
    GovernanceModule,
    FileArtifactModule,
    NotificationModule,
    WorkflowModule,
    IngressModule,
    DispatchModule,
    GrowthModule,
    EntitlementModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
    // H2：全局 deny-by-default。AuthGuard 先跑（认证 + 校验租户范围，@Public() 放行），
    // RolesGuard 后跑（读 req.user.role 做 RBAC，未标 @Roles 时 no-op）。顺序即数组顺序。
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // 商业化订阅授权：@RequireModule 标注的端点校验租户是否订阅对应模块（无标注则 no-op）。
    { provide: APP_GUARD, useClass: EntitlementGuard },
  ],
})
export class AppModule {}
