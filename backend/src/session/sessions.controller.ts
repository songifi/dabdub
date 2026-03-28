import { Controller, Get, Delete, Param, Req, UnauthorizedException } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async getSessions(@Req() req: any) {
    const userId = req.user.userId;
    const sessions = await this.sessionsService.getAllSessions(userId);
    const currentSessionId = req.user.sessionId;

    return sessions.map((session) => ({
      ...session,
      isCurrentSession: session.id === currentSessionId,
    }));
  }

  @Delete(':id')
  async revokeSession(@Param('id') sessionId: string, @Req() req: any) {
    const userId = req.user.userId;
    await this.sessionsService.revoke(sessionId, userId);
  }

  @Delete()
  async revokeAllSessions(@Req() req: any) {
    const userId = req.user.userId;
    const currentSessionId = req.user.sessionId;
    await this.sessionsService.revokeAllExceptCurrent(userId, currentSessionId);
  }
}