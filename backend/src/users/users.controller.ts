import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AccountStatus, UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  ResolveReportDto,
  SafetyActionDto,
  UpdatePlatformSettingDto,
  UpdateProfileDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Get('me/export')
  exportMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.exportMyData(user.id);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deleteMyAccount(user.id);
  }

  @Get('me/favourites')
  listFavourites(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listFavourites(user.id);
  }

  @Post('me/favourites/:targetUserId')
  toggleFavourite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('targetUserId') targetUserId: string,
  ) {
    return this.usersService.toggleFavourite(user.id, targetUserId);
  }

  @Post('me/safety-action')
  safetyAction(@CurrentUser() user: AuthenticatedUser, @Body() dto: SafetyActionDto) {
    return this.usersService.createSafetyAction(user.id, dto);
  }

  @Get('me/blocked')
  listBlocked(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listMyBlockedUsers(user.id);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  adminListUsers(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('role') role?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.usersService.adminListUsers({
      search,
      status,
      role,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Patch('admin/:id/status')
  @Roles(UserRole.ADMIN)
  adminUpdateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: AccountStatus,
  ) {
    return this.usersService.adminUpdateUserStatus(admin.id, id, status);
  }

  @Patch('admin/:id/roles')
  @Roles(UserRole.ADMIN)
  adminUpdateRoles(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body('roles') roles: UserRole[],
  ) {
    return this.usersService.adminUpdateUserRoles(admin.id, id, roles);
  }

  @Get('admin/reports')
  @Roles(UserRole.ADMIN)
  adminListReports(
    @Query('status') status?: string,
    @Query('actionType') actionType?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.usersService.adminListReports({
      status,
      actionType,
      search,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Patch('admin/reports/:id')
  @Roles(UserRole.ADMIN)
  adminResolveReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return this.usersService.adminResolveReport(admin.id, id, dto);
  }

  @Get('admin/settings')
  @Roles(UserRole.ADMIN)
  adminListSettings() {
    return this.usersService.adminListSettings();
  }

  @Put('admin/settings')
  @Roles(UserRole.ADMIN)
  adminUpsertSetting(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdatePlatformSettingDto,
  ) {
    return this.usersService.adminUpsertSetting(admin.id, dto);
  }

  @Get('admin/audit-logs')
  @Roles(UserRole.ADMIN)
  adminAuditLogs(
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.usersService.adminListAuditLogs({
      search,
      action,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }
}
