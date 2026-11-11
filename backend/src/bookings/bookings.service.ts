import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingStatus, DisputeStatus, NotificationType, Prisma } from '@prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  buildPaginatedResponse,
  normalizePagination,
  normalizeSearchQuery,
} from '../common/utils/pagination.util';
import { sanitizeChatBody } from '../common/utils/privacy.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CancelBookingDto,
  ConfirmBookingDto,
  CreateBookingDto,
  CreateReviewDto,
  RespondBookingDto,
  SendMessageDto,
} from './dto/bookings.dto';

const BOOKING_INCLUDE = {
  traveller: { select: { id: true, fullName: true, homeCity: true, avatarUrl: true } },
  buddy: { select: { id: true, fullName: true, homeCity: true, avatarUrl: true } },
  reviews: true,
} as const;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly idempotency?: IdempotencyService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  private runIdempotent<T>(
    userId: string,
    scope: string,
    idempotencyKey: string | undefined,
    payload: unknown,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!this.idempotency || !idempotencyKey) return fn();
    return this.idempotency.execute({ userId, scope, idempotencyKey, payload, fn });
  }

  private emitBookingEvent(
    event: 'booking:created' | 'booking:updated',
    booking: { id: string; travellerId: string; buddyId: string },
  ): void {
    this.realtime?.emitToBooking(booking.id, event, booking);
    this.realtime?.emitToUser(booking.travellerId, event, booking);
    this.realtime?.emitToUser(booking.buddyId, event, booking);
  }

  async create(travellerId: string, dto: CreateBookingDto, idempotencyKey?: string) {
    if (travellerId === dto.buddyId) {
      throw new BadRequestException('Cannot book yourself as a Travel Buddy');
    }

    return this.runIdempotent(travellerId, 'bookings:create', idempotencyKey, dto, async () => {
      const recentWindow = new Date(Date.now() - 120_000);
      const startAt = new Date(dto.startAt);
      const endAt = new Date(dto.endAt);

      const [blocked, buddyProfile, recentDuplicate] = await Promise.all([
        this.prisma.userBlockReport.findFirst({
          where: {
            actionType: 'BLOCK',
            OR: [
              { reporterId: travellerId, targetUserId: dto.buddyId },
              { reporterId: dto.buddyId, targetUserId: travellerId },
            ],
          },
          select: { id: true },
        }),
        this.prisma.travelBuddyProfile.findUnique({
          where: { userId: dto.buddyId },
          select: { id: true, isVerified: true, isAvailable: true },
        }),
        this.prisma.buddyBooking.findFirst({
          where: {
            travellerId,
            buddyId: dto.buddyId,
            status: BookingStatus.REQUESTED,
            startAt,
            createdAt: { gte: recentWindow },
          },
          include: BOOKING_INCLUDE,
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      if (blocked) {
        throw new ForbiddenException('Booking unavailable due to user safety block');
      }
      if (!buddyProfile || !buddyProfile.isVerified || !buddyProfile.isAvailable) {
        throw new BadRequestException('Selected Travel Buddy is unavailable or unverified');
      }
      if (recentDuplicate) {
        return recentDuplicate;
      }

      const booking = await this.prisma.buddyBooking.create({
        data: {
          travellerId,
          buddyId: dto.buddyId,
          startAt,
          endAt,
          activitySummary: dto.activitySummary,
          meetingPointName: dto.meetingPointName,
          meetingPointAddress: dto.meetingPointAddress,
          meetingPointLat: dto.meetingPointLat,
          meetingPointLng: dto.meetingPointLng,
        },
        include: BOOKING_INCLUDE,
      });

      this.emitBookingEvent('booking:created', booking);
      this.notifications.enqueue(
        {
          userId: dto.buddyId,
          type: NotificationType.BOOKING_REQUEST,
          title: 'New Travel Buddy booking request',
          body: `${booking.traveller.fullName} requested: ${dto.activitySummary}`,
          metadata: { bookingId: booking.id },
        },
        `booking-req-${booking.id}`,
      );

      return booking;
    });
  }

  async listForUser(userId: string, limit = 50, skip = 0) {
    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 100);
    const safeSkip = Math.max(0, Number(skip) || 0);
    return this.prisma.buddyBooking.findMany({
      where: { OR: [{ travellerId: userId }, { buddyId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      skip: safeSkip,
      include: BOOKING_INCLUDE,
    });
  }

  async listForUserFiltered(
    userId: string,
    options: {
      limit?: string | number;
      skip?: string | number;
      page?: string | number;
      filter?: string;
      status?: string;
      search?: string;
      paginated?: boolean;
    },
  ) {
    const pagination = normalizePagination({
      limit: options.limit,
      skip: options.skip,
      page: options.page,
      defaultLimit: 25,
      maxLimit: 100,
    });
    const search = normalizeSearchQuery(options.search);
    const baseUserWhere: Prisma.BuddyBookingWhereInput = {
      OR: [{ travellerId: userId }, { buddyId: userId }],
    };

    const filterUpper = options.filter?.toUpperCase();
    const statusFilterClause: Prisma.BuddyBookingWhereInput = {};
    if (options.status && Object.values(BookingStatus).includes(options.status as BookingStatus)) {
      statusFilterClause.status = options.status as BookingStatus;
    } else if (filterUpper === 'INCOMING_REQUESTS') {
      statusFilterClause.buddyId = userId;
      statusFilterClause.status = BookingStatus.REQUESTED;
    } else if (filterUpper === 'REQUESTS') {
      statusFilterClause.status = { in: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED] };
    } else if (filterUpper === 'CONFIRMED') {
      statusFilterClause.status = { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] };
    } else if (filterUpper === 'HISTORY') {
      statusFilterClause.status = {
        in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED],
      };
    }

    const searchClause: Prisma.BuddyBookingWhereInput = search
      ? {
          OR: [
            { activitySummary: { contains: search, mode: 'insensitive' } },
            { meetingPointName: { contains: search, mode: 'insensitive' } },
            { meetingPointAddress: { contains: search, mode: 'insensitive' } },
            { traveller: { fullName: { contains: search, mode: 'insensitive' } } },
            { buddy: { fullName: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const where: Prisma.BuddyBookingWhereInput = {
      AND: [baseUserWhere, statusFilterClause, searchClause],
    };

    if (!options.paginated) {
      return this.prisma.buddyBooking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: BOOKING_INCLUDE,
      });
    }

    const [items, total, allCount, incomingCount, requestsCount, confirmedCount, historyCount] =
      await Promise.all([
        this.prisma.buddyBooking.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: pagination.limit,
          skip: pagination.skip,
          include: BOOKING_INCLUDE,
        }),
        this.prisma.buddyBooking.count({ where }),
        this.prisma.buddyBooking.count({ where: baseUserWhere }),
        this.prisma.buddyBooking.count({
          where: { buddyId: userId, status: BookingStatus.REQUESTED },
        }),
        this.prisma.buddyBooking.count({
          where: {
            AND: [
              baseUserWhere,
              { status: { in: [BookingStatus.REQUESTED, BookingStatus.ACCEPTED] } },
            ],
          },
        }),
        this.prisma.buddyBooking.count({
          where: {
            AND: [
              baseUserWhere,
              { status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] } },
            ],
          },
        }),
        this.prisma.buddyBooking.count({
          where: {
            AND: [
              baseUserWhere,
              {
                status: {
                  in: [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.REJECTED],
                },
              },
            ],
          },
        }),
      ]);

    return buildPaginatedResponse(items, total, pagination, {
      counts: {
        all: allCount,
        incomingRequests: incomingCount,
        requests: requestsCount,
        confirmed: confirmedCount,
        history: historyCount,
      },
    });
  }

  async assertParticipant(userId: string, bookingId: string) {
    const booking = await this.prisma.buddyBooking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.travellerId !== userId && booking.buddyId !== userId) {
      throw new ForbiddenException('Not a participant of this booking');
    }
    return booking;
  }

  async respond(
    buddyUserId: string,
    bookingId: string,
    dto: RespondBookingDto,
    idempotencyKey?: string,
  ) {
    return this.runIdempotent(
      buddyUserId,
      `bookings:respond:${bookingId}`,
      idempotencyKey,
      dto,
      async () => {
        const booking = await this.prisma.buddyBooking.findUnique({ where: { id: bookingId } });
        if (!booking) throw new NotFoundException('Booking not found');
        if (booking.buddyId !== buddyUserId) {
          throw new ForbiddenException('Only the assigned Travel Buddy can respond to this request');
        }
        if (booking.status !== BookingStatus.REQUESTED) {
          throw new BadRequestException(`Booking cannot be responded to in status ${booking.status}`);
        }

        const status =
          dto.decision === 'ACCEPTED' ? BookingStatus.ACCEPTED : BookingStatus.REJECTED;
        const updated = await this.prisma.buddyBooking.update({
          where: { id: bookingId },
          data: { status, buddyConfirmed: status === BookingStatus.ACCEPTED },
          include: BOOKING_INCLUDE,
        });

        this.emitBookingEvent('booking:updated', updated);
        this.notifications.enqueue(
          {
            userId: booking.travellerId,
            type:
              status === BookingStatus.ACCEPTED
                ? NotificationType.BOOKING_CONFIRMED
                : NotificationType.BOOKING_CANCELLED,
            title: `Booking request ${status.toLowerCase()}`,
            body:
              status === BookingStatus.ACCEPTED
                ? 'Your Travel Buddy accepted. Confirm a public meeting point to finalize.'
                : 'Your Travel Buddy declined the booking request.',
            metadata: { bookingId },
          },
          `booking-resp-${bookingId}-${status}`,
        );

        return updated;
      },
    );
  }

  async confirm(
    userId: string,
    bookingId: string,
    dto: ConfirmBookingDto,
    idempotencyKey?: string,
  ) {
    return this.runIdempotent(
      userId,
      `bookings:confirm:${bookingId}`,
      idempotencyKey,
      dto,
      async () => {
        const booking = await this.assertParticipant(userId, bookingId);
        if (
          booking.status === BookingStatus.COMPLETED ||
          booking.status === BookingStatus.CANCELLED ||
          booking.status === BookingStatus.REJECTED
        ) {
          throw new BadRequestException(
            `Public meeting spot cannot be changed in status ${booking.status}`,
          );
        }
        if (!dto.isPublicMeetingPoint) {
          throw new BadRequestException(
            'For safety, Travel Buddy meetups must select a public meeting point',
          );
        }

        const nextSpotName = dto.meetingPointName.trim();
        if (!nextSpotName) {
          throw new BadRequestException('A valid public meeting point name is required');
        }
        const nextSpotAddress = dto.meetingPointAddress?.trim() || null;

        const prevName = (booking.meetingPointName || '').trim().toLowerCase();
        const prevAddr = (booking.meetingPointAddress || '').trim().toLowerCase();
        const spotChanged =
          (prevName.length > 0 && prevName !== nextSpotName.toLowerCase()) ||
          (nextSpotAddress !== null && prevAddr !== nextSpotAddress.toLowerCase());

        const isTraveller = booking.travellerId === userId;
        const travellerConfirmed = spotChanged
          ? isTraveller
          : isTraveller
            ? true
            : booking.travellerConfirmed;
        const buddyConfirmed = spotChanged
          ? !isTraveller
          : !isTraveller
            ? true
            : booking.buddyConfirmed;
        const bothConfirmed = travellerConfirmed && buddyConfirmed;

        const updated = await this.prisma.buddyBooking.update({
          where: { id: bookingId },
          data: {
            travellerConfirmed,
            buddyConfirmed,
            status: bothConfirmed ? BookingStatus.CONFIRMED : BookingStatus.ACCEPTED,
            meetingPointName: nextSpotName,
            meetingPointAddress: nextSpotAddress ?? booking.meetingPointAddress,
            meetingPointLat: dto.meetingPointLat ?? booking.meetingPointLat,
            meetingPointLng: dto.meetingPointLng ?? booking.meetingPointLng,
            isPublicMeetingPoint: true,
          },
          include: BOOKING_INCLUDE,
        });

        this.emitBookingEvent('booking:updated', updated);
        const otherUserId = isTraveller ? booking.buddyId : booking.travellerId;
        this.notifications.enqueue(
          {
            userId: otherUserId,
            type: NotificationType.BOOKING_CONFIRMED,
            title: bothConfirmed
              ? 'Booking confirmed by both users'
              : spotChanged
                ? 'Public meeting point updated'
                : 'Public meeting point proposed',
            body: `Public meeting point: ${nextSpotName}.`,
            metadata: { bookingId },
          },
          `booking-confirm-${bookingId}-${updated.status}-${nextSpotName}`,
        );

        return updated;
      },
    );
  }

  async cancel(
    userId: string,
    bookingId: string,
    dto: CancelBookingDto,
    idempotencyKey?: string,
  ) {
    return this.runIdempotent(
      userId,
      `bookings:cancel:${bookingId}`,
      idempotencyKey,
      dto,
      async () => {
        const booking = await this.assertParticipant(userId, bookingId);
        const hoursUntilStart = (booking.startAt.getTime() - Date.now()) / 3600_000;
        const policy =
          hoursUntilStart >= 12
            ? 'FREE_CANCELLATION_12H_PLUS'
            : 'LATE_CANCELLATION_UNDER_12H';

        const updated = await this.prisma.buddyBooking.update({
          where: { id: bookingId },
          data: {
            status: BookingStatus.CANCELLED,
            cancellationReason: dto.reason,
            cancellationPolicyApplied: policy,
            cancelledById: userId,
          },
          include: BOOKING_INCLUDE,
        });

        this.emitBookingEvent('booking:updated', updated);
        const otherUserId = booking.travellerId === userId ? booking.buddyId : booking.travellerId;
        this.notifications.enqueue(
          {
            userId: otherUserId,
            type: NotificationType.BOOKING_CANCELLED,
            title: 'Booking cancelled',
            body: `Policy: ${policy}. Reason: ${dto.reason}`,
            metadata: { bookingId },
          },
          `booking-cancel-${bookingId}`,
        );

        return updated;
      },
    );
  }

  async shareActivityWithContacts(userId: string, bookingId: string, contactIds: string[]) {
    const booking = await this.assertParticipant(userId, bookingId);
    if (booking.travellerId !== userId) {
      throw new ForbiddenException('Only the traveller can share activity with trusted contacts');
    }
    return this.prisma.buddyBooking.update({
      where: { id: bookingId },
      data: { sharedWithContactIds: contactIds },
    });
  }

  async activityCheckIn(userId: string, bookingId: string) {
    await this.assertParticipant(userId, bookingId);
    const updated = await this.prisma.buddyBooking.update({
      where: { id: bookingId },
      data: { lastActivityCheckInAt: new Date(), status: BookingStatus.IN_PROGRESS },
      include: BOOKING_INCLUDE,
    });
    this.emitBookingEvent('booking:updated', updated);
    return updated;
  }

  async reportNoShow(userId: string, bookingId: string, notes: string) {
    await this.assertParticipant(userId, bookingId);
    const updated = await this.prisma.buddyBooking.update({
      where: { id: bookingId },
      data: {
        noShowReportedById: userId,
        disputeStatus: DisputeStatus.OPEN,
        disputeNotes: `No-show reported: ${notes}`,
      },
      include: BOOKING_INCLUDE,
    });
    this.emitBookingEvent('booking:updated', updated);
    return updated;
  }

  async openDispute(userId: string, bookingId: string, notes: string) {
    await this.assertParticipant(userId, bookingId);
    const updated = await this.prisma.buddyBooking.update({
      where: { id: bookingId },
      data: {
        disputeStatus: DisputeStatus.OPEN,
        disputeNotes: notes,
      },
      include: BOOKING_INCLUDE,
    });
    this.emitBookingEvent('booking:updated', updated);
    return updated;
  }

  async adminResolveDispute(adminId: string, bookingId: string, notes: string) {
    const [updated] = await this.prisma.$transaction([
      this.prisma.buddyBooking.update({
        where: { id: bookingId },
        data: {
          disputeStatus: DisputeStatus.RESOLVED,
          disputeNotes: notes,
          disputeResolvedById: adminId,
        },
        include: BOOKING_INCLUDE,
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'BOOKING_DISPUTE_RESOLVED',
          targetType: 'BUDDY_BOOKING',
          targetId: bookingId,
          detailsJson: { notes },
        },
      }),
    ]);
    this.emitBookingEvent('booking:updated', updated);
    return updated;
  }

  async complete(userId: string, bookingId: string, idempotencyKey?: string) {
    return this.runIdempotent(
      userId,
      `bookings:complete:${bookingId}`,
      idempotencyKey,
      {},
      async () => {
        await this.assertParticipant(userId, bookingId);
        const updated = await this.prisma.buddyBooking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.COMPLETED },
          include: BOOKING_INCLUDE,
        });
        this.emitBookingEvent('booking:updated', updated);
        return updated;
      },
    );
  }

  async listMessages(userId: string, bookingId: string, limit = 60, beforeIso?: string) {
    await this.assertParticipant(userId, bookingId);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 60), 100);
    const beforeDate = beforeIso ? new Date(beforeIso) : null;

    const latestDesc = await this.prisma.bookingMessage.findMany({
      where: {
        bookingId,
        ...(beforeDate && !Number.isNaN(beforeDate.getTime())
          ? { createdAt: { lt: beforeDate } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      include: { sender: { select: { id: true, fullName: true } } },
    });

    return latestDesc.reverse();
  }

  async sendMessage(userId: string, bookingId: string, dto: SendMessageDto) {
    const booking = await this.assertParticipant(userId, bookingId);
    const cleanClientId = dto.clientMessageId?.trim().slice(0, 128) || undefined;

    if (cleanClientId) {
      const existing = await this.prisma.bookingMessage.findFirst({
        where: { bookingId, senderId: userId, clientMessageId: cleanClientId },
        include: { sender: { select: { id: true, fullName: true } } },
      });
      if (existing) return existing;
    }

    const { sanitized, masked } = sanitizeChatBody(dto.body);
    let message;
    try {
      message = await this.prisma.bookingMessage.create({
        data: {
          bookingId,
          senderId: userId,
          clientMessageId: cleanClientId,
          body: sanitized,
          maskedPhoneNotice: masked,
        },
        include: { sender: { select: { id: true, fullName: true } } },
      });
    } catch (err) {
      if (
        cleanClientId &&
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const existing = await this.prisma.bookingMessage.findFirst({
          where: { bookingId, senderId: userId, clientMessageId: cleanClientId },
          include: { sender: { select: { id: true, fullName: true } } },
        });
        if (existing) return existing;
      }
      throw err;
    }

    const recipientId = booking.travellerId === userId ? booking.buddyId : booking.travellerId;
    this.realtime?.emitToBooking(bookingId, 'booking:new_message', message);
    this.realtime?.emitToUser(recipientId, 'booking:new_message', message);

    this.notifications.enqueue(
      {
        userId: recipientId,
        type: NotificationType.CHAT_MESSAGE,
        title: `New message from ${message.sender.fullName}`,
        body: sanitized.slice(0, 80),
        metadata: { bookingId },
      },
      `chat-msg-${message.id}`,
    );

    return message;
  }

  async createReview(
    userId: string,
    bookingId: string,
    dto: CreateReviewDto,
    idempotencyKey?: string,
  ) {
    return this.runIdempotent(
      userId,
      `bookings:review:${bookingId}`,
      idempotencyKey,
      dto,
      async () => {
        const booking = await this.assertParticipant(userId, bookingId);
        if (booking.status !== BookingStatus.COMPLETED) {
          throw new BadRequestException('Reviews can only be submitted after activity completion');
        }

        const review = await this.prisma.$transaction(async (tx) => {
          const existing = await tx.buddyReview.findUnique({
            where: { bookingId_reviewerId: { bookingId, reviewerId: userId } },
          });
          if (existing) return existing;

          const created = await tx.buddyReview.create({
            data: {
              bookingId,
              reviewerId: userId,
              buddyUserId: booking.buddyId,
              rating: dto.rating,
              safetyScore: dto.safetyScore ?? dto.rating,
              comment: dto.comment,
            },
          });

          const stats = await tx.buddyReview.aggregate({
            where: { buddyUserId: booking.buddyId },
            _avg: { rating: true },
            _count: { rating: true },
          });

          await tx.travelBuddyProfile.updateMany({
            where: { userId: booking.buddyId },
            data: {
              ratingAverage: Number((stats._avg.rating ?? 5).toFixed(2)),
              reviewCount: stats._count.rating,
            },
          });

          return created;
        });

        return review;
      },
    );
  }

  async adminListAllBookings(options?: {
    limit?: string | number;
    skip?: string | number;
    page?: string | number;
    status?: string;
    disputeStatus?: string;
    search?: string;
    paginated?: boolean;
  }) {
    const pagination = normalizePagination({
      limit: options?.limit,
      skip: options?.skip,
      page: options?.page,
      defaultLimit: 25,
      maxLimit: 100,
    });
    const search = normalizeSearchQuery(options?.search);
    const statusFilter =
      options?.status && Object.values(BookingStatus).includes(options.status as BookingStatus)
        ? (options.status as BookingStatus)
        : undefined;
    const disputeFilter =
      options?.disputeStatus &&
      Object.values(DisputeStatus).includes(options.disputeStatus as DisputeStatus)
        ? (options.disputeStatus as DisputeStatus)
        : undefined;

    const where: Prisma.BuddyBookingWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(disputeFilter ? { disputeStatus: disputeFilter } : {}),
      ...(search
        ? {
            OR: [
              { activitySummary: { contains: search, mode: 'insensitive' } },
              { meetingPointName: { contains: search, mode: 'insensitive' } },
              { traveller: { fullName: { contains: search, mode: 'insensitive' } } },
              { buddy: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    if (!options?.paginated) {
      return this.prisma.buddyBooking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          traveller: { select: { id: true, fullName: true, email: true } },
          buddy: { select: { id: true, fullName: true, email: true } },
        },
      });
    }

    const [items, total, openDisputeCount] = await Promise.all([
      this.prisma.buddyBooking.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          traveller: { select: { id: true, fullName: true, email: true } },
          buddy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.buddyBooking.count({ where }),
      this.prisma.buddyBooking.count({ where: { disputeStatus: DisputeStatus.OPEN } }),
    ]);

    return buildPaginatedResponse(items, total, pagination, { openDisputeCount });
  }

  async adminUpdateStatus(adminId: string, bookingId: string, status: string) {
    const allowed = new Set<string>(Object.values(BookingStatus));
    if (!allowed.has(status)) {
      throw new BadRequestException(`Invalid booking status: ${status}`);
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.buddyBooking.update({
        where: { id: bookingId },
        data: { status: status as BookingStatus },
        include: {
          traveller: { select: { id: true, fullName: true, email: true } },
          buddy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'ADMIN_BOOKING_STATUS_UPDATED',
          targetType: 'BUDDY_BOOKING',
          targetId: bookingId,
          detailsJson: { status },
        },
      }),
    ]);
    this.emitBookingEvent('booking:updated', updated);
    return updated;
  }
}
