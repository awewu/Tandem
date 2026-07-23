import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DealerDirectoryEntity, RoutingDecisionEntity } from './dispatch.entity';
import { DispatchController } from './dispatch.controller';
import { DispatchService } from './dispatch.service';
import { AuthModule } from '../auth/auth.module';
import { TARGET_API_BOOT_SMOKE, bootSmokeRepositoryProvider } from '../boot-smoke';

/**
 * 派单模块（线索交接层 P1）。DispatchService 以 EntityManager 事务内派单
 * （供 event-consumers 调用），控制器提供只读决策/目录查询。
 * DataSource 由全局 TypeOrmModule.forRoot 提供。
 */
@Module({
  imports: [
    ...(TARGET_API_BOOT_SMOKE ? [] : [TypeOrmModule.forFeature([DealerDirectoryEntity, RoutingDecisionEntity])]),
    AuthModule,
  ],
  controllers: [DispatchController],
  providers: [
    DispatchService,
    ...(TARGET_API_BOOT_SMOKE
      ? [bootSmokeRepositoryProvider(DealerDirectoryEntity), bootSmokeRepositoryProvider(RoutingDecisionEntity)]
      : []),
  ],
  exports: [DispatchService],
})
export class DispatchModule {}
