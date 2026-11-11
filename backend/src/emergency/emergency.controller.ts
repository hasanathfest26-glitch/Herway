import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AcknowledgeSosDto, TriggerSosDto } from './dto/emergency.dto';
import { EmergencyService } from './emergency.service';

@Controller('emergency')
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Get('numbers')
  getNumbers(@Query('region') region?: string) {
    return this.emergencyService.getEmergencyNumbers(region);
  }

  @Post('sos')
  @UseGuards(JwtAuthGuard)
  trigger(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerSosDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.emergencyService.triggerSos(user.id, dto, idempotencyKey);
  }

  @Get('sos/active')
  @UseGuards(JwtAuthGuard)
  active(@CurrentUser() user: AuthenticatedUser) {
    return this.emergencyService.getActiveForUser(user.id);
  }

  @Post('sos/:id/cancel-accidental')
  @UseGuards(JwtAuthGuard)
  cancelAccidental(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emergencyService.cancelAccidentalAlert(user.id, id);
  }

  @Post('sos/:id/escalate')
  @UseGuards(JwtAuthGuard)
  escalate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emergencyService.escalateUnacknowledged(user.id, id);
  }

  @Post('sos/:id/acknowledge')
  @UseGuards(JwtAuthGuard)
  acknowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AcknowledgeSosDto,
  ) {
    return this.emergencyService.acknowledge(user.id, id, dto);
  }

  @Patch('sos/:id/resolve')
  @UseGuards(JwtAuthGuard)
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.emergencyService.resolve(user.id, user.roles, id);
  }

  @Get('admin/incidents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminIncidents(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.emergencyService.adminListIncidents({
      status,
      search,
      limit,
      skip,
      page,
      paginated: paginated === 'true' || paginated === '1',
    });
  }
}
