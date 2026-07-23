import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { Roles } from '../common/roles.decorator';
import { ProductCatalogService } from './product-catalog.service';
import { requireProductWrite, resolveProductTenant } from './product-catalog-access';

interface AuthRequest { user: JwtPayload; }

@UseGuards(AuthGuard)
@Controller('product-catalog')
export class ProductCatalogController {
  constructor(private readonly svc: ProductCatalogService) {}

  @Get('taxonomy')
  taxonomy() {
    return this.svc.taxonomy();
  }

  @Get('dedupe-candidates')
  dedupeCandidates(@Req() req: AuthRequest, @Query('tenantId') tenantId?: string) {
    return this.svc.dedupeCandidates(resolveProductTenant(req.user, tenantId));
  }

  @Get('devices')
  list(@Req() req: AuthRequest, @Query() query: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, query.tenantId);
    return this.svc.list({ ...query, tenantId });
  }

  @Post('recommend')
  recommend(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.recommend({ ...body, tenantId });
  }

  @Get('devices/:id')
  get(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.svc.get(id, resolveProductTenant(req.user, tenantId));
  }

  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Post('devices')
  upsert(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    requireProductWrite(req.user);
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.upsert({ ...body, tenantId } as any, req.user);
  }

  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Patch('devices/:id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    requireProductWrite(req.user);
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.update(id, tenantId, body, req.user);
  }

  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Delete('devices/:id')
  archive(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') requested?: string) {
    requireProductWrite(req.user);
    const tenantId = resolveProductTenant(req.user, requested);
    return this.svc.archive(id, tenantId, req.user);
  }

  // ── L7 营销供给层（i18n + SEO/GEO + 富营销内容）· 受保护写/读 ──────────────
  @Get('devices/:id/content')
  listContent(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') requested?: string) {
    return this.svc.listContent(id, resolveProductTenant(req.user, requested));
  }

  @Post('devices/:id/content')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  upsertContent(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.upsertContent(id, { ...body, tenantId });
  }

  // ── L7 发布工作流：状态流转 + 定时发布结算 ──────────────────────────────────
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Post('devices/:id/content/:locale/transition')
  transitionContent(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() body: Record<string, unknown>,
  ) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.transitionContent(id, locale, String(body.action || ''), {
      tenantId,
      scheduledAt: body.scheduledAt,
      note: body.note as string | undefined,
      actor: body.actor as string | undefined,
    });
  }

  @Post('content/publish-due')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  publishDue(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.publishDueContent(tenantId, body.actor as string | undefined);
  }

  // ── A4 i18n 覆盖率报表：哪些 SKU 缺哪些语言（运营翻译缺口视图）──────────────
  @Get('content/coverage')
  contentCoverage(@Req() req: AuthRequest, @Query('tenantId') requested?: string, @Query('brand') brand?: string) {
    return this.svc.contentCoverage(resolveProductTenant(req.user, requested), brand);
  }

  // ── 产品关系：配件/兼容/替代/交叉·向上销售/对比 ────────────────────────────
  @Get('devices/:id/relations')
  listRelations(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') requested?: string) {
    return this.svc.listRelations(id, resolveProductTenant(req.user, requested));
  }

  @Post('devices/:id/relations')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  upsertRelation(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.upsertRelation(id, { ...body, tenantId });
  }

  @Delete('relations/:relId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  deleteRelation(@Req() req: AuthRequest, @Param('relId') relId: string, @Query('tenantId') requested?: string) {
    return this.svc.deleteRelation(relId, resolveProductTenant(req.user, requested));
  }
}
