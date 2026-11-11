import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SafeHavenCategory, UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  ApproveSafeHavenDto,
  RegisterSafeHavenDto,
  ReportSafeHavenDto,
  ResolveSafeHavenReportDto,
  UpdatePartnerSafeHavenDto,
} from './dto/safe-havens.dto';
import { SafeHavensService } from './safe-havens.service';

@Controller('safe-havens')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SafeHavensController {
  constructor(private readonly safeHavensService: SafeHavensService) {}

  @Post('register')
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterSafeHavenDto) {
    return this.safeHavensService.register(user.id, dto);
  }

  @Get('nearby')
  nearby(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('city') city?: string,
    @Query('category') category?: SafeHavenCategory,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.safeHavensService.findNearbyVerified(
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      city,
      category,
      { search, limit, skip, page, paginated: paginated === 'true' || paginated === '1' },
    );
  }

  @Get('demo')
  demoPending(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('city') city?: string,
    @Query('category') category?: SafeHavenCategory,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.safeHavensService.findDemoPending(
      lat ? Number(lat) : undefined,
      lng ? Number(lng) : undefined,
      city,
      category,
      { search, limit, skip, page, paginated: paginated === 'true' || paginated === '1' },
    );
  }

  @Get('places-nearby')
  placesNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('type') type: 'hospital' | 'pharmacy' | 'lodging' = 'hospital',
  ) {
    return this.safeHavensService.findOrdinaryGooglePlaces(
      Number(lat || 9.9658),
      Number(lng || 76.2421),
      type,
    );
  }

  @Post(':id/report')
  report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReportSafeHavenDto,
  ) {
    return this.safeHavensService.reportInaccuracy(user.id, id, dto);
  }

  @Get('partner/mine')
  partnerMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.safeHavensService.listForPartner(user.id, {
      search,
      status,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Patch(':id/partner')
  updateAsPartner(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePartnerSafeHavenDto,
  ) {
    return this.safeHavensService.updateAsPartner(user.id, id, dto);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  adminAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('city') city?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.safeHavensService.adminListAll({
      search,
      status,
      city,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Get('admin/reports')
  @Roles(UserRole.ADMIN)
  adminReports(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.safeHavensService.adminListReports({
      status,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Patch('admin/reports/:reportId')
  @Roles(UserRole.ADMIN)
  adminResolveReport(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('reportId') reportId: string,
    @Body() dto: ResolveSafeHavenReportDto,
  ) {
    return this.safeHavensService.adminResolveReport(admin.id, reportId, dto);
  }

  @Patch(':id/recheck')
  @Roles(UserRole.ADMIN)
  adminRecheck(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body('notes') notes?: string,
  ) {
    return this.safeHavensService.adminMarkRechecked(admin.id, id, notes);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  adminApprove(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ApproveSafeHavenDto,
  ) {
    return this.safeHavensService.adminApprove(admin.id, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  adminDelete(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.safeHavensService.adminDelete(admin.id, id);
  }
}
