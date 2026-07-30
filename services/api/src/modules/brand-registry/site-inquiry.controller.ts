import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { Permissions } from '../common/permissions.decorator';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { Roles } from '../common/roles.decorator';
import { PublicSiteInquiryInput, SiteInquiryService } from './site-inquiry.service';

interface AuthRequest { user: JwtPayload; }

@Controller('brand-sites/:siteCode/inquiries')
export class SiteInquiryController {
  constructor(private readonly service: SiteInquiryService) {}

  @Get()
  @Permissions('brand.library.read')
  list(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Query() query: Record<string, unknown>) {
    return this.service.list(req.user, siteCode, query);
  }

  @Delete(':inquiryId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.delete')
  remove(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('inquiryId') id: string) {
    return this.service.remove(req.user, siteCode, id);
  }
}

@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('sites')
export class SiteInquiryPublicController {
  constructor(private readonly service: SiteInquiryService) {}

  @Post(':siteCode/inquiries/:kind')
  create(
    @Req() req: { headers?: Record<string, string> },
    @Param('siteCode') siteCode: string,
    @Param('kind') kind: string,
    @Body() body: PublicSiteInquiryInput,
  ) {
    return this.service.publicCreate(siteCode, kind, body, { userAgent: req?.headers?.['user-agent'] });
  }
}
