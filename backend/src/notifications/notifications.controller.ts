import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.notificationsService.listForUser(user.id, {
      limit,
      skip,
      page,
      unreadOnly: unreadOnly === 'true' || unreadOnly === '1',
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: Partial<{
      bookingUpdates: boolean;
      chatMessages: boolean;
      tripReminders: boolean;
      checkInReminders: boolean;
      locationEvents: boolean;
      partnerUpdates: boolean;
    }>,
  ) {
    return this.notificationsService.updatePreferences(user.id, body);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Post('device-token')
  registerDeviceToken(@CurrentUser() user: AuthenticatedUser, @Body('fcmToken') fcmToken: string) {
    return this.notificationsService.registerDeviceToken(user.id, fcmToken);
  }

  @Post('admin/broadcast')
  @Roles(UserRole.ADMIN)
  broadcast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { title: string; body: string },
  ) {
    return this.notificationsService.broadcastAdminAnnouncement(user.id, body.title, body.body);
  }
}
