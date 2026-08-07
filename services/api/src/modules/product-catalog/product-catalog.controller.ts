import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { Permissions } from '../common/permissions.decorator';
import { Roles } from '../common/roles.decorator';
import { ProductCatalogService } from './product-catalog.service';
import { ProductMgmtService } from './product-mgmt.service';
import { requireProductPermission, requireProductWrite, resolveProductTenant } from './product-catalog-access';

interface AuthRequest { user: JwtPayload; }

@UseGuards(AuthGuard)
@Controller('product-catalog')
export class ProductCatalogController {
  constructor(private readonly svc: ProductCatalogService, private readonly mgmt: ProductMgmtService) {}

  // ── 4.4 生命周期 / 4.5 NPI 上市 / 4.10 卖点 / 4.17 定价审批(毛利闸) ──
  @Patch('devices/:id/lifecycle')
  @Permissions('product.catalog.update')
  setLifecycle(@Req() req: AuthRequest, @Param('id') id: string, @Body('stage') stage: string) { return this.mgmt.setLifecycleStage(req.user, id, stage); }

  @Post('launches')
  @Permissions('product.catalog.update')
  createLaunch(@Req() req: AuthRequest, @Body() b: any) { return this.mgmt.createLaunch(req.user, b); }

  @Get('launches')
  @Permissions('product.catalog.read')
  listLaunches(@Req() req: AuthRequest) { return this.mgmt.listLaunches(req.user); }

  @Patch('launches/:id/status')
  @Permissions('product.catalog.update')
  updateLaunch(@Req() req: AuthRequest, @Param('id') id: string, @Body('status') status: string) { return this.mgmt.updateLaunchStatus(req.user, id, status); }

  @Post('selling-points')
  @Permissions('product.catalog.update')
  addSellingPoint(@Req() req: AuthRequest, @Body() b: any) { return this.mgmt.addSellingPoint(req.user, b); }

  @Get('selling-points')
  @Permissions('product.catalog.read')
  listSellingPoints(@Req() req: AuthRequest, @Query('productId') productId?: string) { return this.mgmt.listSellingPoints(req.user, productId); }

  @Post('pricing-policies')
  @Permissions('product.catalog.update')
  submitPricing(@Req() req: AuthRequest, @Body() b: any) { return this.mgmt.submitPricingPolicy(req.user, b); }

  @Get('pricing-policies')
  @Permissions('product.catalog.read')
  listPricing(@Req() req: AuthRequest) { return this.mgmt.listPricingPolicies(req.user); }

  @Post('pricing-policies/:id/decision')
  @Permissions('product.catalog.update')
  decidePricing(@Req() req: AuthRequest, @Param('id') id: string, @Body() b: { decision: 'approved' | 'rejected'; note?: string }) { return this.mgmt.decidePricingPolicy(req.user, id, b?.decision, b?.note); }

  @Get('taxonomy')
  @Permissions('product.catalog.read')
  taxonomy() {
    return this.svc.taxonomy();
  }

  // D4 发布投影：经销商(消费租户)按品牌只读已发布产品事实（经 grant 授权，不复制）。
  @Get('consumer/brands')
  @Permissions('product.catalog.read')
  consumerBrands(@Req() req: AuthRequest) {
    return this.svc.listConsumerGrants(req.user);
  }

  @Get('consumer/:brandCode/products')
  @Permissions('product.catalog.read')
  consumerProducts(@Req() req: AuthRequest, @Param('brandCode') brandCode: string) {
    return this.svc.listPublishedProductsForConsumer(req.user, brandCode);
  }

  @Get('dedupe-candidates')
  @Permissions('product.catalog.read')
  dedupeCandidates(@Req() req: AuthRequest, @Query('tenantId') tenantId?: string) {
    return this.svc.dedupeCandidates(resolveProductTenant(req.user, tenantId));
  }

  @Get('devices')
  @Permissions('product.catalog.view', 'product.catalog.read')
  list(@Req() req: AuthRequest, @Query() query: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, query.tenantId);
    return this.svc.list({ ...query, tenantId });
  }

  @Post('recommend')
  @Permissions('product.catalog.read')
  recommend(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.recommend({ ...body, tenantId });
  }

  @Get('devices/:id')
  @Permissions('product.catalog.read')
  get(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') tenantId?: string) {
    return this.svc.get(id, resolveProductTenant(req.user, tenantId));
  }

  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('product.catalog.create')
  @Post('devices')
  upsert(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    requireProductWrite(req.user);
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.upsert({ ...body, tenantId } as any, req.user);
  }

  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('product.catalog.update', 'product.catalog.publish')
  @Patch('devices/:id')
  update(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const updatesStatus = Object.prototype.hasOwnProperty.call(body, 'status');
    requireProductPermission(req.user, updatesStatus ? 'product.catalog.publish' : 'product.catalog.update');
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.update(id, tenantId, body, req.user);
  }

  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('product.catalog.delete')
  @Delete('devices/:id')
  archive(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') requested?: string) {
    requireProductWrite(req.user);
    const tenantId = resolveProductTenant(req.user, requested);
    return this.svc.archive(id, tenantId, req.user);
  }

  // ── L7 营销供给层（i18n + SEO/GEO + 富营销内容）· 受保护写/读 ──────────────
  @Get('devices/:id/content')
  @Permissions('product.content.read')
  listContent(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') requested?: string) {
    return this.svc.listContent(id, resolveProductTenant(req.user, requested));
  }

  @Post('devices/:id/content')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('product.content.create', 'product.content.update')
  upsertContent(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.upsertContent(id, { ...body, tenantId });
  }

  // ── L7 发布工作流：状态流转 + 定时发布结算 ──────────────────────────────────
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('product.catalog.publish')
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
  @Permissions('product.catalog.publish')
  publishDue(@Req() req: AuthRequest, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.publishDueContent(tenantId, body.actor as string | undefined);
  }

  // ── A4 i18n 覆盖率报表：哪些 SKU 缺哪些语言（运营翻译缺口视图）──────────────
  @Get('content/coverage')
  @Permissions('product.content.read')
  contentCoverage(@Req() req: AuthRequest, @Query('tenantId') requested?: string, @Query('brand') brand?: string) {
    return this.svc.contentCoverage(resolveProductTenant(req.user, requested), brand);
  }

  // ── 产品关系：配件/兼容/替代/交叉·向上销售/对比 ────────────────────────────
  @Get('devices/:id/relations')
  @Permissions('product.content.read')
  listRelations(@Req() req: AuthRequest, @Param('id') id: string, @Query('tenantId') requested?: string) {
    return this.svc.listRelations(id, resolveProductTenant(req.user, requested));
  }

  @Post('devices/:id/relations')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('product.content.create', 'product.content.update')
  upsertRelation(@Req() req: AuthRequest, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    const tenantId = resolveProductTenant(req.user, body.tenantId);
    return this.svc.upsertRelation(id, { ...body, tenantId });
  }

  @Delete('relations/:relId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('product.content.delete')
  deleteRelation(@Req() req: AuthRequest, @Param('relId') relId: string, @Query('tenantId') requested?: string) {
    return this.svc.deleteRelation(relId, resolveProductTenant(req.user, requested));
  }
}
