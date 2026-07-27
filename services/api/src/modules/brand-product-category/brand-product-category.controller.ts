import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { Roles } from '../common/roles.decorator';
import {
  BrandProductCategoryInput, BrandProductCategoryService,
} from './brand-product-category.service';

@Controller('brand-product-categories')
export class BrandProductCategoryController {
  constructor(private readonly service: BrandProductCategoryService) {}

  @Get()
  list(@Query('brandCode') brandCode: string, @Query('parentId') parentId?: string, @Query('metrics') metrics?: string) {
    return this.service.list(brandCode, parentId, metrics);
  }

  @Post()
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  create(@Body() body: BrandProductCategoryInput) {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  update(@Param('id') id: string, @Body() body: BrandProductCategoryInput) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('platform_admin', 'hq_admin', 'brand_admin')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Get(':id/usage')
  usage(@Param('id') id: string) {
    return this.service.usage(id);
  }
}

@Public()
@UseGuards(PublicRateLimitGuard)
@Controller('brand')
export class BrandProductCategoryPublicController {
  constructor(private readonly service: BrandProductCategoryService) {}

  @Get(':brandCode/categories')
  list(@Param('brandCode') brandCode: string) {
    return this.service.publicList(brandCode);
  }
}
