import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TripStatus } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateTripDto, ScheduleCheckInDto, TripStopDto, UpdateTripDto } from './dto/trips.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTripDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.tripsService.create(user.id, dto, idempotencyKey);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.tripsService.listForUser(user.id, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tripsService.getById(user.id, id);
  }

  @Put(':id')
  updateTrip(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTripDto,
  ) {
    return this.tripsService.updateTrip(user.id, id, dto);
  }

  @Patch(':id')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: TripStatus,
  ) {
    return this.tripsService.updateStatus(user.id, id, status);
  }

  @Post(':id/stops')
  addStop(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TripStopDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.tripsService.addStop(user.id, id, dto, idempotencyKey);
  }

  @Delete('stops/:stopId')
  removeStop(@CurrentUser() user: AuthenticatedUser, @Param('stopId') stopId: string) {
    return this.tripsService.removeStop(user.id, stopId);
  }

  @Get(':id/offline-pack')
  getOfflinePack(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tripsService.getOfflineSafetyPack(user.id, id);
  }

  @Post(':id/check-ins')
  scheduleCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ScheduleCheckInDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.tripsService.scheduleCheckIn(user.id, id, dto, idempotencyKey);
  }

  @Post(':id/manual-check-in')
  manualCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('title') title?: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.tripsService.manualSafeCheckIn(user.id, id, title, idempotencyKey);
  }

  @Post('check-ins/:checkInId/confirm')
  confirmCheckIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('checkInId') checkInId: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.tripsService.confirmCheckIn(user.id, checkInId, idempotencyKey);
  }
}
