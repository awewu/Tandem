import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req } from '@nestjs/common';
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
  list(@Req() req: any, @Query('includeDeleted') includeDeleted?: string) {
    return this.service.list(req.user, includeDeleted === 'true');
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) { return this.service.get(req.user, id); }

  @Post()
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  create(@Req() req: any, @Body() body: BrandSiteInput) { return this.service.create(req.user, body); }

  @Put(':id')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  update(@Req() req: any, @Param('id') id: string, @Body() body: BrandSiteInput) {
    return this.service.update(req.user, id, body);
  }

  @Delete(':id')
  @Roles('platform_admin')
  remove(@Req() req: any, @Param('id') id: string) { return this.service.remove(req.user, id); }

  @Post(':id/restore')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  restore(@Req() req: any, @Param('id') id: string) { return this.service.restore(req.user, id); }

  @Post(':id/publish')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  async publish(@Req() req: any, @Param('id') id: string) {
    const site = await this.service.get(req.user, id);
    return this.publisher.publish(req.user, site);
  }

  @Get(':id/logo')
  logo(@Req() req: any, @Param('id') id: string) { return this.service.getLogo(req.user, id); }

  @Post(':id/logo')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  uploadLogo(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { filename?: string; mimeType?: string; dataBase64?: string },
  ) {
    return this.service.uploadLogo(req.user, id, body);
  }
}
