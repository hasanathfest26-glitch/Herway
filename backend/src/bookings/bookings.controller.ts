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
import {
  CancelBookingDto,
  ConfirmBookingDto,
  CreateBookingDto,
  CreateReviewDto,
  RespondBookingDto,
  SendMessageDto,
} from './dto/bookings.dto';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.create(user.id, dto, idempotencyKey);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('filter') filter?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('paginated') paginated?: string,
  ) {
    if (
      paginated === 'true' ||
      paginated === '1' ||
      filter ||
      status ||
      search ||
      page
    ) {
      return this.bookingsService.listForUserFiltered(user.id, {
        limit,
        skip,
        page,
        filter,
        status,
        search,
        paginated: paginated === 'true' || paginated === '1',
      });
    }
    return this.bookingsService.listForUser(
      user.id,
      limit ? Number(limit) : undefined,
      skip ? Number(skip) : undefined,
    );
  }

  @Patch(':id/respond')
  respond(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondBookingDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.respond(user.id, id, dto, idempotencyKey);
  }

  @Patch(':id/confirm')
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmBookingDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.confirm(user.id, id, dto, idempotencyKey);
  }

  @Patch(':id/cancel')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.cancel(user.id, id, dto, idempotencyKey);
  }

  @Post(':id/share-contacts')
  shareContacts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('contactIds') contactIds: string[],
  ) {
    return this.bookingsService.shareActivityWithContacts(user.id, id, contactIds ?? []);
  }

  @Post(':id/check-in')
  activityCheckIn(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.activityCheckIn(user.id, id);
  }

  @Post(':id/no-show')
  reportNoShow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.bookingsService.reportNoShow(user.id, id, notes || 'Participant did not arrive');
  }

  @Post(':id/dispute')
  openDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.bookingsService.openDispute(user.id, id, notes);
  }

  @Patch(':id/dispute/resolve')
  @Roles(UserRole.ADMIN)
  resolveDispute(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body('notes') notes: string,
  ) {
    return this.bookingsService.adminResolveDispute(admin.id, id, notes);
  }

  @Patch(':id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.complete(user.id, id, idempotencyKey);
  }

  @Get(':id/messages')
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    return this.bookingsService.listMessages(
      user.id,
      id,
      limit ? Number(limit) : undefined,
      before,
    );
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.bookingsService.sendMessage(user.id, id, dto);
  }

  @Post(':id/reviews')
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookingsService.createReview(user.id, id, dto, idempotencyKey);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  adminList(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('status') status?: string,
    @Query('disputeStatus') disputeStatus?: string,
    @Query('search') search?: string,
    @Query('paginated') paginated?: string,
  ) {
    return this.bookingsService.adminListAllBookings({
      limit,
      skip,
      page,
      status,
      disputeStatus,
      search,
      paginated: paginated === 'true' || paginated === '1',
    });
  }

  @Patch('admin/:id/status')
  @Roles(UserRole.ADMIN)
  adminUpdateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.bookingsService.adminUpdateStatus(admin.id, id, status);
  }
}
