import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/permissions.decorator';
import { Roles } from '../common/roles.decorator';
import { BrandSitePublishService } from './brand-site-publish.service';
import { BrandSiteInput, BrandSiteService } from './brand-site.service';

@Controller('brand-sites')
export class BrandSiteController {
  constructor(
    private readonly service: BrandSiteService,
    private readonly publisher: BrandSitePublishService,
  ) {}

  @Get()
  @Permissions('brand.library.view', 'brand.library.read')
  list(@Req() req: any, @Query('includeDeleted') includeDeleted?: string) {
    return this.service.list(req.user, includeDeleted === 'true');
  }

  @Get(':id')
  @Permissions('brand.library.read')
  get(@Req() req: any, @Param('id') id: string) { return this.service.get(req.user, id); }

  @Post()
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.create')
  create(@Req() req: any, @Body() body: BrandSiteInput) { return this.service.create(req.user, body); }

  @Put(':id')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  update(@Req() req: any, @Param('id') id: string, @Body() body: BrandSiteInput) {
    return this.service.update(req.user, id, body);
  }

  @Delete(':id')
  @Roles('platform_admin')
  @Permissions('brand.library.delete')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user, id); }

  @Post(':id/restore')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  restore(@Req() req: any, @Param('id') id: string) { return this.service.restore(req.user, id); }

  @Post(':id/publish')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.publish')
  async publish(@Req() req: any, @Param('id') id: string) {
    const site = await this.service.get(req.user, id);
    return this.publisher.publish(req.user, site);
  }

  @Get(':id/logo')
  @Permissions('brand.library.read')
  logo(@Req() req: any, @Param('id') id: string) { return this.service.getLogo(req.user, id); }

  @Post(':id/logo')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.asset.update')
  uploadLogo(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { filename?: string; mimeType?: string; dataBase64?: string },
  ) {
    return this.service.uploadLogo(req.user, id, body);
  }
}
