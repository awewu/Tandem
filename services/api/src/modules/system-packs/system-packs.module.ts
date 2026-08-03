import { Module } from '@nestjs/common';
import { SystemPacksController } from './system-packs.controller';
import { SystemPacksService } from './system-packs.service';

@Module({
  controllers: [SystemPacksController],
  providers: [SystemPacksService],
  exports: [SystemPacksService],
})
export class SystemPacksModule {}
