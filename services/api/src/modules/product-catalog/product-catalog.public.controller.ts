import { Body, Controller, Get, NotFoundException, Param, Post, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { ProductCatalogService } from './product-catalog.service';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';

/**
 * 品牌公开只读端点（无鉴权、脱敏）— 供匿名品牌站构建期发布管线拉取产品目录。
 * 路由（全局前缀 api/v2）：
 *   GET  /api/v2/brand/:slug/products   → 品牌上架产品（优先回读 meta.<slug>/无损往返）
 *   POST /api/v2/brand/:slug/recommend  → 按定位画像推荐（脱敏，供匿名问诊/选型页）
 *
 * 品牌无关设计：`:slug` 即产品目录中的 brand 值（如 everhot / lithnova）。
 * 新增品牌无需新增控制器——同步产品后 `/brand/<slug>/products` 自动可用，
 * 契合「Rhautt 持续新增品牌」的预留模式。
 * 与受保护的 /api/v2/product-catalog/devices（后台编辑、含成本价）分离，
 * 避免把 AuthGuard 暴露给匿名站点（EVERHOT-NEXUS-INTEGRATION-DESIGN §5.2）。
 */
@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('brand')
export class BrandPublicController {
  constructor(private readonly svc: ProductCatalogService) {}

  /**
   * 每品牌运营租户约定：环境变量 `<SLUG>_TENANT_ID`（大写）指定该品牌的产品门牌租户。
   * 未配置时返回 undefined，交由 service 走既有默认（EVERHOT_TENANT_ID || rhautt_shared），
   * 保持 everhot 现有行为完全不变。
   */
  private brandTenant(slug: string): string | undefined {
    return process.env[`${slug.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_TENANT_ID`];
  }

  /**
   * 本地化品牌目录（脱敏 + 内联 schema.org JSON-LD）。`?locale=` 可选（默认 zh-CN）；
   * 回退链：请求 locale published → 默认 locale published → 仅基础事实。
   * 供品牌站按语言构建 + 注入 SEO/GEO 结构化数据（D2-BLUEPRINT §10.3）。
   */
  @Get(':slug/products')
  products(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.svc.listBrandPublicLocalized(slug, locale, this.brandTenant(slug));
  }

  /** 本地化单品（脱敏 + JSON-LD）：供品牌站产品详情页 SSR/SSG。 */
  @Get(':slug/products/:sku')
  product(@Param('slug') slug: string, @Param('sku') sku: string, @Query('locale') locale?: string) {
    return this.svc.getBrandProductLocalized(slug, sku, locale, this.brandTenant(slug));
  }

  @Get(':slug/products/:sku/images/:artifactId')
  async productImage(
    @Param('slug') slug: string,
    @Param('sku') sku: string,
    @Param('artifactId') artifactId: string,
  ) {
    const found = await this.svc.getPublicProductImage(slug, sku, artifactId, this.brandTenant(slug));
    if (!found) throw new NotFoundException('image not found');
    return new StreamableFile(found.stream, {
      type: found.row.mimeType || 'application/octet-stream',
      disposition: `inline; filename="${encodeURIComponent(found.row.originalName)}"`,
    });
  }

  /**
   * 公开定位推荐（无鉴权、脱敏）— 供匿名问诊/选型页按画像推荐产品（B 消费面）。
   * 只接「通用定位约束」criteria（segments/personas/markets/painPoints/limit）；
   * 强制品牌=:slug、上架态，复用 recommend（其投影已脱敏、不含成本）。
   * 边界：诊断语义 → 定位 code 的映射由消费方完成，D2 不感知（同 §5.2 公开面原则）。
   */
  @Post(':slug/recommend')
  recommend(@Param('slug') slug: string, @Body() body: Record<string, unknown>) {
    return this.svc.recommend({
      segments: body?.segments,
      personas: body?.personas,
      markets: body?.markets,
      channels: body?.channels,
      painPoints: body?.painPoints,
      limit: body?.limit,
      brand: slug,
      tenantId: this.brandTenant(slug) || process.env.EVERHOT_TENANT_ID || 'rhautt_shared',
    });
  }
}
