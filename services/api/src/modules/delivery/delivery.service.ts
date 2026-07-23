import { BadRequestException, Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getRuntimeEngine } = require('../../../../../server/modules/runtimeEngineAccess');

@Injectable()
export class DeliveryService {
  private get engine() {
    return getRuntimeEngine('technicalDelivery');
  }

  generateDelivery(dto: Record<string, unknown>) {
    // B1 类型边界：交付单体必须是对象（拒绝数组/标量，避免脏输入进交付引擎）
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new BadRequestException('交付单体必须是对象');
    const order = (dto['order'] as Record<string, unknown>) || dto;
    if (!order['signedAt']) order['signedAt'] = new Date().toISOString().slice(0, 10);
    return this.engine.generate(order);
  }

  getDocs(orderNo: string) {
    return this.engine.getManifest(orderNo);
  }
}
