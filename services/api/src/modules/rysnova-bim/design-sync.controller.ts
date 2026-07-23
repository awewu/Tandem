import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { JwtPayload } from '../auth/auth.service';
import { DesignSyncService } from './design-sync.service';

/**
 * M12 · design↔Rysnova 单一真相源 API（/api/v2/rysnova-bim/sync）
 * 租户上下文一律取自 JWT（req.user.tenantId），不接受客户端传入 tenantId —— 防越权跨租户。
 */
@UseGuards(AuthGuard)
@Controller('rysnova-bim/sync')
export class DesignSyncController {
  constructor(private readonly svc: DesignSyncService) {}

  private tenant(req: { user: JwtPayload }) {
    return req.user.tenantId;
  }

  /** 登记 Rysnova 产物为某 design 版本的派生 */
  @Post('link')
  link(@Request() req: any, @Body() body: { designId: string; designVersion: string; artifactId: string; artifactVersion?: string }) {
    return this.svc.linkArtifactToDesign({ ...body, tenantId: this.tenant(req) }, req.user);
  }

  /** design 变更通知（真相源更新 → 派生置 stale） */
  @Post('design-changed')
  designChanged(@Request() req: any, @Body() body: { designId: string; newVersion: string }) {
    return this.svc.onDesignChanged(this.tenant(req), body.designId, body.newVersion, req.user);
  }

  /** Rysnova 工程修正回流 design（变更建议） */
  @Post('propose-change')
  propose(@Request() req: any, @Body() body: { syncId: string; proposal: Record<string, unknown> }) {
    return this.svc.proposeChangeBackToDesign(this.tenant(req), body.syncId, body.proposal, req.user);
  }

  /** design 审核确认变更 → re-sync（复核人取自 JWT） */
  @Post('confirm')
  confirm(@Request() req: any, @Body() body: { syncId: string; newDesignVersion: string }) {
    return this.svc.confirmDesignUpdate(this.tenant(req), body.syncId, req.user.userId ?? 'design-owner', body.newDesignVersion, req.user);
  }

  /** 查询某 design 的同步状态（tenantId 取 JWT） */
  @Get('status/:designId')
  status(@Request() req: any, @Param('designId') designId: string) {
    return this.svc.getSyncStatus(this.tenant(req), designId, req.user);
  }
}
