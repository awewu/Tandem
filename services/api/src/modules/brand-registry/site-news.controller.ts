import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { Permissions } from '../common/permissions.decorator';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { Roles } from '../common/roles.decorator';
import { SiteNewsArticleInput, SiteNewsService } from './site-news.service';

interface AuthRequest { user: JwtPayload; }

@Controller('brand-sites/:siteCode/news')
export class SiteNewsController {
  constructor(private readonly service: SiteNewsService) {}

  @Get()
  @Permissions('brand.library.read')
  list(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Query() query: Record<string, unknown>) {
    return this.service.list(req.user, siteCode, query);
  }

  @Get(':articleId')
  @Permissions('brand.library.read')
  get(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('articleId') id: string) {
    return this.service.get(req.user, siteCode, id);
  }

  @Post()
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.create')
  create(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Body() body: SiteNewsArticleInput) {
    return this.service.create(req.user, siteCode, body);
  }

  @Patch(':articleId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  update(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('articleId') id: string,
    @Body() body: SiteNewsArticleInput,
  ) {
    return this.service.update(req.user, siteCode, id, body);
  }

  @Post(':articleId/publish')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.publish')
  publish(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('articleId') id: string) {
    return this.service.setStatus(req.user, siteCode, id, 'published');
  }

  @Post(':articleId/hide')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  hide(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('articleId') id: string) {
    return this.service.setStatus(req.user, siteCode, id, 'hidden');
  }

  @Delete(':articleId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.delete')
  archive(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('articleId') id: string) {
    return this.service.archive(req.user, siteCode, id);
  }
}

@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('sites')
export class SiteNewsPublicController {
  constructor(private readonly service: SiteNewsService) {}

  @Get(':siteCode/news')
  list(@Param('siteCode') siteCode: string, @Query() query: Record<string, unknown>) {
    return this.service.publicList(siteCode, query);
  }

  @Get(':siteCode/news/:articleId/cover')
  async cover(@Param('siteCode') siteCode: string, @Param('articleId') articleId: string) {
    const artifact = await this.service.publicCover(siteCode, articleId);
    return new StreamableFile(artifact.stream, {
      type: artifact.row.mimeType || 'application/octet-stream',
      disposition: `inline; filename="${encodeURIComponent(artifact.row.originalName || articleId)}"`,
    });
  }
}
