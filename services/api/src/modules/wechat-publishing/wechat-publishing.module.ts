import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';
import { FileArtifactModule } from '../file-artifact/file-artifact.module';
import { WechatPublishingController } from './wechat-publishing.controller';
import { WECHAT_PUBLISHING_ENTITIES } from './wechat-publishing.entity';
import { WechatPublishingService } from './wechat-publishing.service';

@Module({
  imports: [
    FileArtifactModule,
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([...WECHAT_PUBLISHING_ENTITIES])]),
  ],
  controllers: [WechatPublishingController],
  providers: [
    WechatPublishingService,
    ...(TARGET_API_BOOT_SMOKE ? WECHAT_PUBLISHING_ENTITIES.map((entity) => bootSmokeRepositoryProvider(entity)) : []),
  ],
})
export class WechatPublishingModule {}
