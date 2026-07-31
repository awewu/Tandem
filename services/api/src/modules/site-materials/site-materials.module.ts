import { Module } from '@nestjs/common';
import { SiteMaterialsController } from './site-materials.controller';
import { SiteMaterialsService } from './site-materials.service';

@Module({
  controllers: [SiteMaterialsController],
  providers: [SiteMaterialsService],
})
export class SiteMaterialsModule {}
