import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Public } from '../common/public.decorator';
import { getApiModuleBoundary } from '../module-boundary';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { ProductCatalogModule } from '../product-catalog/product-catalog.module';
import { AuthModule } from '../auth/auth.module';
import { AiGatewayService } from '../growth/ai-gateway.service';
import { AiDesignController } from './ai-design.controller';
import { AiDesignService } from './ai-design.service';
import { AiDesignAuditEntity } from './ai-design-audit.entity';
import { AiDesignAuditService } from './ai-design-audit.service';

@Injectable()
export class AiDesignBoundaryService {
  boundary() {
    return getApiModuleBoundary('ai-design');
  }
}

@Public()
@Controller('ai-design')
export class AiDesignBoundaryController {
  constructor(private readonly s: AiDesignBoundaryService) {}
  @Get('boundary') boundary() { return this.s.boundary(); }
}

@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([AiDesignAuditEntity])]),
    ProductCatalogModule,
    AuthModule,
  ],
  controllers: [AiDesignController, AiDesignBoundaryController],
  providers: [
    AiDesignService,
    AiDesignBoundaryService,
    AiDesignAuditService,
    AiGatewayService,
    ...(TARGET_API_BOOT_SMOKE ? [bootSmokeRepositoryProvider(AiDesignAuditEntity)] : []),
  ],
  exports: [AiDesignService, AiDesignAuditService],
})
export class AiDesignModule {}
