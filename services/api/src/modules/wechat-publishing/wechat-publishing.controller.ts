import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { Permissions } from '../common/permissions.decorator';
import { JwtPayload } from '../auth/auth.service';
import { WechatPublishingService } from './wechat-publishing.service';

interface AuthRequest { user: JwtPayload; }

@Controller('marketing')
export class WechatPublishingController {
  constructor(private readonly service: WechatPublishingService) {}

  @Get('wechat/accounts')
  @Permissions('marketing.wechat_accounts.view')
  listAccounts(@Req() req: AuthRequest) {
    return this.service.listAccounts(req.user);
  }

  @Post('wechat/accounts')
  @Permissions('marketing.wechat_accounts.manage')
  createAccount(@Req() req: AuthRequest, @Body() body: any) {
    return this.service.createAccount(req.user, body);
  }

  @Patch('wechat/accounts/:accountId/secret')
  @Permissions('marketing.wechat_accounts.manage')
  updateSecret(@Req() req: AuthRequest, @Param('accountId') accountId: string, @Body() body: any) {
    return this.service.updateSecret(req.user, accountId, body);
  }

  @Patch('wechat/accounts/:accountId')
  @Permissions('marketing.wechat_accounts.manage')
  updateAccount(@Req() req: AuthRequest, @Param('accountId') accountId: string, @Body() body: any) {
    return this.service.updateAccount(req.user, accountId, body);
  }

  @Patch('wechat/accounts/:accountId/status')
  @Permissions('marketing.wechat_accounts.manage')
  updateStatus(@Req() req: AuthRequest, @Param('accountId') accountId: string, @Body() body: any) {
    return this.service.updateStatus(req.user, accountId, body);
  }

  @Post('wechat/accounts/:accountId/test-connection')
  @Permissions('marketing.wechat_accounts.manage')
  testConnection(@Req() req: AuthRequest, @Param('accountId') accountId: string) {
    return this.service.testConnection(req.user, accountId);
  }

  @Get('wechat/accounts/available')
  @Permissions('marketing.content.submit_review')
  availableAccounts(@Req() req: AuthRequest, @Query('brandId') brandId: string) {
    return this.service.availableAccounts(req.user, brandId);
  }

  @Post('content-review-versions')
  @Permissions('marketing.content.submit_review')
  createReviewVersion(@Req() req: AuthRequest, @Body() body: any) {
    return this.service.createReviewVersion(req.user, body);
  }

  @Get('content-review-versions/pending')
  @Permissions('marketing.content.review')
  listPending(@Req() req: AuthRequest, @Query() query: any) {
    return this.service.listPending(req.user, query);
  }

  @Get('content-review-versions/:versionId')
  @Permissions('marketing.content.review', 'marketing.content.submit_review')
  getVersion(@Req() req: AuthRequest, @Param('versionId') versionId: string) {
    return this.service.getVersion(req.user, versionId);
  }

  @Post('content-review-versions/:versionId/approve')
  @Permissions('marketing.content.review')
  approve(@Req() req: AuthRequest, @Param('versionId') versionId: string, @Body() body: any) {
    return this.service.approve(req.user, versionId, body);
  }

  @Post('content-review-versions/:versionId/request-changes')
  @Permissions('marketing.content.review')
  requestChanges(@Req() req: AuthRequest, @Param('versionId') versionId: string, @Body() body: any) {
    return this.service.requestChanges(req.user, versionId, body);
  }

  @Post('content-review-versions/:versionId/void')
  @Permissions('marketing.content.void')
  voidVersion(@Req() req: AuthRequest, @Param('versionId') versionId: string, @Body() body: any) {
    return this.service.voidVersion(req.user, versionId, body);
  }

  @Get('wechat/draft-sync-tasks')
  @Permissions('marketing.wechat_drafts.view')
  listTasks(@Req() req: AuthRequest) {
    return this.service.listTasks(req.user);
  }

  @Get('wechat/draft-sync-tasks/:taskId')
  @Permissions('marketing.wechat_drafts.view')
  getTask(@Req() req: AuthRequest, @Param('taskId') taskId: string) {
    return this.service.getTask(req.user, taskId);
  }

  @Post('wechat/draft-sync-tasks/:taskId/notes')
  @Permissions('marketing.wechat_drafts.note')
  addTaskNote(@Req() req: AuthRequest, @Param('taskId') taskId: string, @Body() body: any) {
    return this.service.addTaskNote(req.user, taskId, body);
  }

  @Post('wechat/draft-sync-tasks/process')
  @Permissions('marketing.wechat_drafts.view')
  processQueuedTasks(@Req() req: AuthRequest) {
    return this.service.processQueuedTasks(req.user);
  }
}
