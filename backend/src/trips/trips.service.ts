import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  CheckInStatus,
  NotificationType,
  SafeHavenApprovalStatus,
  TripStatus,
} from '@prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { CheckInSchedulerService } from './checkin-scheduler.service';
import { CreateTripDto, ScheduleCheckInDto, TripStopDto, UpdateTripDto } from './dto/trips.dto';

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly checkInScheduler: CheckInSchedulerService,
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

  async create(userId: string, dto: CreateTripDto, idempotencyKey?: string) {
    return this.runIdempotent(userId, 'trips:create', idempotencyKey, dto, async () => {
      const trip = await this.prisma.trip.create({
        data: {
          userId,
          title: dto.title,
          startingLocation: dto.startingLocation,
          destinationCity: dto.destinationCity,
          region: dto.region ?? 'Kerala',
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          accommodationJson: (dto.accommodationJson ?? {}) as object,
          transportJson: (dto.transportJson ?? {}) as object,
          notes: dto.notes,
          sharedWithContactIds: dto.sharedWithContactIds ?? [],
          status: TripStatus.PLANNED,
          stops: dto.stops
            ? {
                create: dto.stops.map((s, idx) => ({
                  title: s.title,
                  stopType: s.stopType,
                  scheduledAt: s.scheduledAt ? new Date(s.scheduledAt) : null,
                  latitude: s.latitude,
                  longitude: s.longitude,
                  address: s.address,
                  notes: s.notes,
                  sortOrder: idx,
                })),
              }
            : undefined,
        },
        include: { stops: { orderBy: { sortOrder: 'asc' } }, checkIns: true },
      });

      this.realtime?.emitToUser(userId, 'trip:updated', trip);
      this.notifications.enqueue(
        {
          userId,
          type: NotificationType.TRIP_REMINDER,
          title: `Trip planned: ${trip.title}`,
          body: `Your itinerary for ${trip.destinationCity} is saved. Download the Offline Safety Pack before departing.`,
          metadata: { tripId: trip.id },
        },
        `trip-created-${trip.id}`,
      );

      return trip;
    });
  }

  async listForUser(userId: string, limit = 50) {
    return this.prisma.trip.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
      take: Math.min(Math.max(1, Number(limit) || 50), 100),
      include: {
        stops: { orderBy: { sortOrder: 'asc' } },
        checkIns: { orderBy: { scheduledAt: 'asc' } },
      },
    });
  }

  private async assertTripOwnership(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        userId: true,
        title: true,
        destinationCity: true,
        _count: { select: { stops: true } },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.userId !== userId) throw new ForbiddenException('Access denied');
    return trip;
  }

  async getById(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        stops: { orderBy: { sortOrder: 'asc' } },
        checkIns: { orderBy: { scheduledAt: 'asc' } },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found');
    if (trip.userId !== userId) throw new ForbiddenException('Access denied');
    return trip;
  }

  async updateTrip(userId: string, tripId: string, dto: UpdateTripDto) {
    await this.assertTripOwnership(userId, tripId);
    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        title: dto.title,
        startingLocation: dto.startingLocation,
        destinationCity: dto.destinationCity,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        accommodationJson: dto.accommodationJson as object | undefined,
        transportJson: dto.transportJson as object | undefined,
        notes: dto.notes,
        sharedWithContactIds: dto.sharedWithContactIds,
        status: dto.status,
      },
      include: { stops: { orderBy: { sortOrder: 'asc' } }, checkIns: true },
    });
    this.realtime?.emitToUser(userId, 'trip:updated', updated);
    return updated;
  }

  async addStop(userId: string, tripId: string, dto: TripStopDto, idempotencyKey?: string) {
    return this.runIdempotent(userId, `trips:add-stop:${tripId}`, idempotencyKey, dto, async () => {
      const trip = await this.assertTripOwnership(userId, tripId);
      const stop = await this.prisma.tripStop.create({
        data: {
          tripId,
          title: dto.title,
          stopType: dto.stopType,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          address: dto.address,
          notes: dto.notes,
          sortOrder: trip._count.stops,
        },
      });
      this.realtime?.emitToUser(userId, 'trip:updated', { id: tripId, addedStop: stop });
      return stop;
    });
  }

  async removeStop(userId: string, stopId: string) {
    const stop = await this.prisma.tripStop.findUnique({
      where: { id: stopId },
      include: { trip: { select: { userId: true } } },
    });
    if (!stop) throw new NotFoundException('Trip stop not found');
    if (stop.trip.userId !== userId) throw new ForbiddenException('Access denied');
    await this.prisma.tripStop.delete({ where: { id: stopId } });
    this.realtime?.emitToUser(userId, 'trip:updated', { id: stop.tripId, removedStopId: stopId });
    return { deleted: true, id: stopId };
  }

  async updateStatus(userId: string, tripId: string, status: TripStatus) {
    await this.assertTripOwnership(userId, tripId);
    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status },
    });
    this.realtime?.emitToUser(userId, 'trip:updated', updated);
    return updated;
  }

  async scheduleCheckIn(
    userId: string,
    tripId: string,
    dto: ScheduleCheckInDto,
    idempotencyKey?: string,
  ) {
    return this.runIdempotent(
      userId,
      `trips:schedule-checkin:${tripId}`,
      idempotencyKey,
      dto,
      async () => {
        await this.assertTripOwnership(userId, tripId);
        const scheduledAt = new Date(dto.scheduledAt);
        const graceMinutes = dto.graceMinutes ?? 20;

        const checkIn = await this.prisma.journeyCheckIn.create({
          data: {
            tripId,
            userId,
            title: dto.title,
            scheduledAt,
            graceMinutes,
            notes: dto.notes,
          },
        });

        await this.checkInScheduler.scheduleCheckInJobs(checkIn.id, scheduledAt, graceMinutes);
        this.realtime?.emitToUser(userId, 'checkin:updated', checkIn);
        return checkIn;
      },
    );
  }

  async manualSafeCheckIn(
    userId: string,
    tripId: string,
    title?: string,
    idempotencyKey?: string,
  ) {
    return this.runIdempotent(
      userId,
      `trips:manual-checkin:${tripId}`,
      idempotencyKey,
      { title },
      async () => {
        const trip = await this.assertTripOwnership(userId, tripId);
        const now = new Date();
        const checkIn = await this.prisma.journeyCheckIn.create({
          data: {
            tripId,
            userId,
            title: title || `Safe check-in: ${trip.destinationCity}`,
            scheduledAt: now,
            status: CheckInStatus.CONFIRMED,
            isManual: true,
            confirmedAt: now,
          },
        });

        this.realtime?.emitToUser(userId, 'checkin:updated', checkIn);
        this.notifications.enqueue(
          {
            userId,
            type: NotificationType.SAFE_ARRIVAL,
            title: 'Manual safe check-in recorded',
            body: `Confirmed safe status for ${trip.title}.`,
            metadata: { checkInId: checkIn.id, tripId },
          },
          `manual-checkin-${checkIn.id}`,
        );

        return checkIn;
      },
    );
  }

  async confirmCheckIn(userId: string, checkInId: string, idempotencyKey?: string) {
    return this.runIdempotent(
      userId,
      `trips:confirm-checkin:${checkInId}`,
      idempotencyKey,
      {},
      async () => {
        const checkIn = await this.prisma.journeyCheckIn.findUnique({
          where: { id: checkInId },
          include: { trip: { select: { title: true } } },
        });
        if (!checkIn) throw new NotFoundException('Check-in not found');
        if (checkIn.userId !== userId) throw new ForbiddenException('Access denied');

        const updated = await this.prisma.journeyCheckIn.update({
          where: { id: checkInId },
          data: { status: CheckInStatus.CONFIRMED, confirmedAt: new Date() },
        });

        this.realtime?.emitToUser(userId, 'checkin:updated', updated);
        this.notifications.enqueue(
          {
            userId,
            type: NotificationType.SAFE_ARRIVAL,
            title: `Safe arrival confirmed: ${checkIn.title}`,
            body: `Your safe check-in for ${checkIn.trip.title} has been recorded.`,
            metadata: { checkInId, tripId: checkIn.tripId },
          },
          `confirm-checkin-${checkInId}`,
        );

        return updated;
      },
    );
  }

  async getOfflineSafetyPack(userId: string, tripId: string) {
    const trip = await this.getById(userId, tripId);

    const [nearbySafeHavens, emergencyContacts] = await Promise.all([
      this.prisma.safeHaven.findMany({
        where: {
          approvalStatus: SafeHavenApprovalStatus.APPROVED,
          verifiedBadge: true,
          isActive: true,
          city: { contains: trip.destinationCity, mode: 'insensitive' },
        },
        select: {
          id: true,
          name: true,
          category: true,
          address: true,
          city: true,
          latitude: true,
          longitude: true,
          phone: true,
          operatingHoursJson: true,
          assistanceServices: true,
          verifiedBadge: true,
        },
        take: 25,
      }),
      this.prisma.trustedContact.findMany({
        where: { userId, canReceiveSos: true },
        select: { id: true, name: true, relationship: true, phone: true },
      }),
    ]);

    return {
      trip,
      nearbySafeHavens,
      trustedSosContacts: emergencyContacts,
      emergencyHelplines: [
        { number: '112', label: 'India National Emergency' },
        { number: '181', label: 'Women Helpline' },
        { number: '1515', label: 'Kerala Pink Patrol' },
      ],
      safetyGuidance:
        'Keep phone charged above 20%, verify Buddy meeting points in public plazas/stations, and call 112 in immediate danger.',
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}
