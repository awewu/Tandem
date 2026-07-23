import { Module } from '@nestjs/common';
import { MdmModule } from '../mdm/mdm.module';
import { CrmModule } from '../crm/crm.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { IngressController } from './ingress.controller';
import { IngressService } from './ingress.service';

/**
 * v-next · 公域接入层模块（底座/非视觉骨架），不吞并任何站点。
 * PIPL 加固：经 CrmModule 同事务落库（PII 单一副本）+ MdmModule 发 PII-free 事件。
 * DataSource 由全局 TypeOrmModule.forRoot 提供（boot-smoke 下无 DataSource，与 crm/notification 同约定）。
 */
@Module({
  imports: [MdmModule, CrmModule, ComplianceModule],
  controllers: [IngressController],
  providers: [IngressService],
  exports: [IngressService],
})
export class IngressModule {}
