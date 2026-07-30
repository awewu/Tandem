import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { Permissions } from '../common/permissions.decorator';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { Roles } from '../common/roles.decorator';
import {
  BrandSiteBasicSettingsInput,
  BrandSiteBasicSettingsService,
} from './brand-site-basic-settings.service';

interface AuthRequest { user: JwtPayload; }

@Controller('brand-sites/:siteCode/basic-settings')
export class BrandSiteBasicSettingsController {
  constructor(private readonly service: BrandSiteBasicSettingsService) {}

  @Get()
  @Permissions('brand.library.read')
  get(@Req() req: AuthRequest, @Param('siteCode') siteCode: string) {
    return this.service.get(req.user, siteCode);
  }

  @Put()
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  update(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Body() body: BrandSiteBasicSettingsInput,
  ) {
    return this.service.update(req.user, siteCode, body);
  }

  @Put(':section')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  updateSection(
    @Req() req: AuthRequest,
    @Param('siteCode') siteCode: string,
    @Param('section') section: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateSection(req.user, siteCode, section, body);
  }
}

@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('sites')
export class BrandSiteBasicSettingsPublicController {
  constructor(private readonly service: BrandSiteBasicSettingsService) {}

  @Get(':siteCode/basic-settings')
  get(@Param('siteCode') siteCode: string) {
    return this.service.publicGet(siteCode);
  }
}
