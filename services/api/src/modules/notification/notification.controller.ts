import { Controller, Get, Param, Put, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { NotificationService } from './notification.service';
import { JwtPayload } from '../auth/auth.service';

@UseGuards(AuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Get()
  list(@Request() req: { user: JwtPayload }) {
    return this.svc.list(req.user);
  }

  @Put(':id/read')
  markRead(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.svc.markRead(req.user, id);
  }
}
