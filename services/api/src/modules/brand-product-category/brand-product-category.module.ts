import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { ProductEntity } from '../product-catalog/product-catalog.entity';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import { BrandProductCategoryController, BrandProductCategoryPublicController } from './brand-product-category.controller';
import { BrandProductCategoryEntity } from './brand-product-category.entity';
import { BrandProductCategoryService } from './brand-product-category.service';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([BrandProductCategoryEntity, ProductEntity])]),
  ],
  controllers: [BrandProductCategoryController, BrandProductCategoryPublicController],
  providers: [
    BrandProductCategoryService,
    PublicRateLimitGuard,
    ...(TARGET_API_BOOT_SMOKE ? [
      bootSmokeRepositoryProvider(BrandProductCategoryEntity),
      bootSmokeRepositoryProvider(ProductEntity),
    ] : []),
  ],
})
export class BrandProductCategoryModule {}
