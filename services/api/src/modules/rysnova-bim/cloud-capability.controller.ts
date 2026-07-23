import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../common/roles.decorator';
import {
  CloudCapabilityService,
  ClashInput,
  IfcExportInput,
  BoqInput,
} from './cloud-capability.service';

@UseGuards(AuthGuard)
@Controller('rysnova-bim/cloud')
export class CloudCapabilityController {
  constructor(private readonly svc: CloudCapabilityService) {}

  /** 云端碰撞检测（BVH 占位）：工程师/设计师/管理员可执行 */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('clash')
  clash(@Body() body: ClashInput) {
    return this.svc.clashDetection(body);
  }

  /** 云端 IFC 导出：工程师/设计师/管理员可执行 */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('ifc')
  ifc(@Body() body: IfcExportInput) {
    return this.svc.exportIfc(body);
  }

  /** 云端工程量统计（BOQ）：工程师/设计师/管理员可执行 */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('boq')
  boq(@Body() body: BoqInput) {
    return this.svc.billOfQuantities(body);
  }

  /** IFC 真实几何碰撞（web-ifc 解析网格 AABB） */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('ifc-clash')
  ifcClash(@Body() body: { projectId?: string; ifcBase64: string; clearanceMm?: number; unitToMm?: number }) {
    return this.svc.clashFromIfc(body);
  }

  /** IFC 净高分析（楼板顶↔MEP 底净空） */
  @Roles('engineer', 'designer', 'platform_admin', 'hq_admin', 'regional_manager', 'dealer_admin', 'store_manager')
  @Post('ifc-clearance')
  ifcClearance(@Body() body: { projectId?: string; ifcBase64: string; minHeadroomMm?: number; unitToMm?: number }) {
    return this.svc.clearanceAnalysis(body);
  }
}
