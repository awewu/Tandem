import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.service';
import { Permissions } from '../common/permissions.decorator';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { Roles } from '../common/roles.decorator';
import {
  SiteProductAssignmentBatchInput,
  SiteProductAssignmentInput,
  SiteProductAssignmentService,
} from './site-product-assignment.service';

interface AuthRequest { user: JwtPayload; }

@Controller('brand-sites/:siteCode/product-assignments')
export class SiteProductAssignmentController {
  constructor(private readonly service: SiteProductAssignmentService) {}

  @Get()
  @Permissions('brand.library.read')
  list(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Query('includeArchived') includeArchived?: string) {
    return this.service.list(req.user, siteCode, includeArchived === 'true');
  }

  @Post()
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.create')
  create(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Body() body: SiteProductAssignmentInput) {
    return this.service.create(req.user, siteCode, body);
  }

  @Patch(':assignmentId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  update(
    @Req() req: AuthRequest, @Param('siteCode') siteCode: string,
    @Param('assignmentId') id: string, @Body() body: SiteProductAssignmentInput,
  ) {
    return this.service.update(req.user, siteCode, id, body);
  }

  @Post('batch/publish')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.publish')
  batchPublish(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Body() body: SiteProductAssignmentBatchInput) {
    return this.service.batchPublish(req.user, siteCode, body);
  }

  @Post('batch/hide')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  batchHide(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Body() body: SiteProductAssignmentBatchInput) {
    return this.service.batchHide(req.user, siteCode, body);
  }

  @Post(':assignmentId/publish')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.publish')
  publish(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('assignmentId') id: string) {
    return this.service.setStatus(req.user, siteCode, id, 'published');
  }

  @Post(':assignmentId/hide')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.update')
  hide(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('assignmentId') id: string) {
    return this.service.setStatus(req.user, siteCode, id, 'hidden');
  }

  @Delete(':assignmentId')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  @Permissions('brand.library.delete')
  archive(@Req() req: AuthRequest, @Param('siteCode') siteCode: string, @Param('assignmentId') id: string) {
    return this.service.archive(req.user, siteCode, id);
  }
}

@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('sites')
export class SiteProductPublicController {
  constructor(private readonly service: SiteProductAssignmentService) {}

  @Get(':siteCode/products')
  list(
    @Param('siteCode') siteCode: string,
    @Query('locale') locale?: string,
    @Query() filters?: Record<string, unknown>,
  ) {
    return this.service.publicList(siteCode, locale, filters);
  }

  @Get(':siteCode/products/:publicSlug')
  detail(
    @Param('siteCode') siteCode: string,
    @Param('publicSlug') publicSlug: string,
    @Query('locale') locale?: string,
  ) {
    return this.service.publicDetail(siteCode, publicSlug, locale);
  }
}
