import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { BrandProductCategoryController, BrandProductCategoryPublicController } from './brand-product-category.controller';
import { BrandProductCategoryEntity } from './brand-product-category.entity';
import { BrandProductCategoryService } from './brand-product-category.service';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([BrandProductCategoryEntity])]),
    // D2 单一事实源：经 product-catalog 只读出口读取产品行，本模块不再自持产品实体仓储。
    ProductCatalogModule,
  ],
  controllers: [BrandProductCategoryController, BrandProductCategoryPublicController],
  providers: [
    BrandProductCategoryService,
    PublicRateLimitGuard,
    ...(TARGET_API_BOOT_SMOKE ? [
      bootSmokeRepositoryProvider(BrandProductCategoryEntity),
    ] : []),
  ],
})
export class BrandProductCategoryModule {}
