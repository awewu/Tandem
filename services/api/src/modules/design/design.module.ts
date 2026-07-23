import { TypeOrmModule } from '@nestjs/typeorm';
import { DesignProjectEntity, DesignReleaseEntity, FloorPlanEntity } from './design.entity';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MdmModule } from '../mdm/mdm.module';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module';
import { DesignController } from './design.controller';
import { DesignBoundaryController, DesignBoundaryService } from './design-boundary.controller';
import { DesignService } from './design.service';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([DesignProjectEntity, DesignReleaseEntity, FloorPlanEntity]), MdmModule]),
    ProductCatalogModule,
    AuthModule
  ],
  controllers: [DesignController, DesignBoundaryController],
  providers: [
    DesignService,
    DesignBoundaryService,
    ...(TARGET_API_BOOT_SMOKE
      ? [
        bootSmokeRepositoryProvider(DesignProjectEntity),
        bootSmokeRepositoryProvider(DesignReleaseEntity),
        bootSmokeRepositoryProvider(FloorPlanEntity)
      ]
      : [])
  ],
})
export class DesignModule {}

// Boundary contract is provided by ./design-boundary.controller.ts
