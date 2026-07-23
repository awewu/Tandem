import { Body, Controller, Get, Param, Post, Put, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BimService } from './bim.service';
import { Public } from '../common/public.decorator';

/**
 * W-BIM-0 · 批 C：目标架构下的新端点（/api/v2/rysnova-bim/projects）。
 *
 * 旧 /bim/* 端点仍由 BimController 保留，作为兼容层调用同一 service 方法；
 * 新端点在此聚合，便于未来统一迁移到 delivery / lifecycle 领域。
 */

// 公开端点 — 客户进度查询（保留在 rysnova-bim 做聚合）
@Controller('rysnova-bim/public')
@Public()
export class V2BimPublicController {
  constructor(private readonly svc: BimService) {}

  @Get(':code')
  lookup(@Param('code') code: string) {
    return this.svc.publicLookup(code);
  }
}

@Controller('rysnova-bim/projects')
@UseGuards(AuthGuard)
export class V2BimController {
  constructor(private readonly svc: BimService) {}

  // 从报价单承接（签单时调用）：目标端点 POST /api/v2/rysnova-bim/projects
  @Post()
  createFromQuotation(@Req() r: any, @Body('quotationId') quotationId: string) {
    return this.svc.inheritFromQuotation(r.user, quotationId);
  }

  // 项目统计
  @Get('stats')
  stats(@Req() r: any) {
    return this.svc.stats(r.user);
  }

  // 项目列表
  @Get()
  list(@Req() r: any, @Query() q: any) {
    return this.svc.list(r.user, q);
  }

  // 项目详情
  @Get(':id')
  get(@Req() r: any, @Param('id') id: string) {
    return this.svc.get(r.user, id);
  }

  // 阶段推进
  @Post(':id/advance')
  advance(@Req() r: any, @Param('id') id: string) {
    return this.svc.advanceStatus(r.user, id);
  }

  // 修改 BOM
  @Put(':id/bom')
  updateBom(@Req() r: any, @Param('id') id: string, @Body('bom') bom: any[]) {
    return this.svc.updateBom(r.user, id, bom);
  }

  // 导出 BOM Excel
  @Get(':id/bom/export')
  async exportBom(@Req() r: any, @Param('id') id: string, @Res() res: any) {
    const buf = await this.svc.exportBomXlsx(r.user, id);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.set('Content-Disposition', `attachment; filename="BOM_${id.slice(0, 8)}.xlsx"`);
    res.send(buf);
  }

  // 保存出图产物链接
  @Post(':id/drawing-artifacts')
  updateDrawing(@Req() r: any, @Param('id') id: string, @Body('drawingUrl') url: string) {
    return this.svc.updateDrawing(r.user, id, url);
  }

  // 验收打勾（单项验收状态）。客户签收确认另见 RysnovaController 的 customer-signoff。
  @Post(':id/acceptance')
  checkItem(@Req() r: any, @Param('id') id: string, @Body('index') i: number, @Body('done') done: boolean) {
    return this.svc.checkItem(r.user, id, Number(i), done);
  }

  // IoT 交付包
  @Get(':id/iot-package')
  iotPackage(@Req() r: any, @Param('id') id: string) {
    return this.svc.buildIotHandoffPackage(r.user, id);
  }

  // 指派负责人
  @Put(':id/assign')
  assign(@Req() r: any, @Param('id') id: string, @Body('assignedTo') uid: string) {
    return this.svc.assign(r.user, id, uid);
  }

  // 回款金额只读：批 C 已删除写入口，保留查询由 contract/财务域提供
}
