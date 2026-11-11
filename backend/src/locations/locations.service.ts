import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { LocationShareStatus, NotificationType } from '@prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateOpaqueShareToken } from '../common/utils/crypto.util';
import { coarsenCoordinate } from '../common/utils/geo.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  CreateLocationShareDto,
  PingLocationDto,
  UpdateShareStateDto,
} from './dto/locations.dto';

const STALE_LOCATION_THRESHOLD_SECONDS = 120;

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly idempotency?: IdempotencyService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async createShare(
    userId: string,
    dto: CreateLocationShareDto,
    idempotencyKey?: string,
  ) {
    const run = async () => {
      const shareToken = generateOpaqueShareToken(24);
      const expiresAt = new Date(Date.now() + dto.durationMinutes * 60_000);

      const session = await this.prisma.locationShareSession.create({
        data: {
          userId,
          tripId: dto.tripId,
          shareToken,
          label: dto.label ?? 'Live Journey Share',
          shareTripContext: dto.shareTripContext ?? Boolean(dto.tripId),
          status: LocationShareStatus.ACTIVE,
          expiresAt,
          allowedContactIds: dto.allowedContactIds ?? [],
          lastLatitude: dto.initialLatitude,
          lastLongitude: dto.initialLongitude,
          lastUpdatedAt:
            dto.initialLatitude !== undefined && dto.initialLongitude !== undefined
              ? new Date()
              : null,
        },
      });

      const baseUrl = process.env.PUBLIC_TRACKING_BASE_URL || 'http://localhost:3000/track';
      const trackingUrl = `${baseUrl}/${session.shareToken}`;
      const enriched = { ...session, trackingUrl };

      this.realtime?.emitToUser(userId, 'location:state_changed', enriched);
      if (typeof this.notifications.enqueue === 'function') {
        this.notifications.enqueue(
          {
            userId,
            type: NotificationType.LOCATION_SHARE,
            title: 'Live location sharing started',
            body: `Private link active for ${dto.durationMinutes} minutes. You can pause or revoke anytime.`,
            metadata: { shareId: session.id, trackingUrl, expiresAt: session.expiresAt },
          },
          `loc-share-${session.id}`,
        );
      }

      return enriched;
    };

    if (!this.idempotency || !idempotencyKey) return run();
    return this.idempotency.execute({
      userId,
      scope: 'locations:createShare',
      idempotencyKey,
      payload: dto,
      fn: run,
    });
  }

  async listShares(userId: string) {
    const baseUrl = process.env.PUBLIC_TRACKING_BASE_URL || 'http://localhost:3000/track';
    const shares = await this.prisma.locationShareSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return shares.map((s) => ({
      ...s,
      trackingUrl: `${baseUrl}/${s.shareToken}`,
    }));
  }

  async pingLocation(userId: string, dto: PingLocationDto) {
    const now = new Date();

    const [, activeSessions] = await Promise.all([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          approxLatitude: coarsenCoordinate(dto.latitude),
          approxLongitude: coarsenCoordinate(dto.longitude),
        },
      }),
      this.prisma.locationShareSession.findMany({
        where: {
          userId,
          status: LocationShareStatus.ACTIVE,
          expiresAt: { gt: now },
        },
        select: { id: true, shareToken: true },
      }),
    ]);

    if (activeSessions.length > 0) {
      await this.prisma.locationShareSession.updateMany({
        where: { id: { in: activeSessions.map((s) => s.id) } },
        data: {
          lastLatitude: dto.latitude,
          lastLongitude: dto.longitude,
          lastAccuracyMeters: dto.accuracyMeters,
          lastUpdatedAt: now,
        },
      });
    }

    return {
      updatedSessionTokens: activeSessions.map((s) => s.shareToken),
      lastUpdatedAt: now.toISOString(),
    };
  }

  async updateShareState(userId: string, shareId: string, dto: UpdateShareStateDto) {
    const session = await this.prisma.locationShareSession.findUnique({ where: { id: shareId } });
    if (!session) throw new NotFoundException('Location share session not found');
    if (session.userId !== userId) throw new ForbiddenException('Access denied');

    const updated = await this.prisma.locationShareSession.update({
      where: { id: shareId },
      data: { status: dto.status },
    });

    this.realtime?.emitToUser(userId, 'location:state_changed', updated);
    this.realtime?.emitToTrack(session.shareToken, 'location:state_changed', {
      status: updated.status,
    });

    if (typeof this.notifications.enqueue === 'function') {
      this.notifications.enqueue(
        {
          userId,
          type: NotificationType.LOCATION_SHARE,
          title: `Location sharing ${dto.status.toLowerCase()}`,
          body: `Your private tracking link "${session.label}" is now ${dto.status}.`,
          metadata: { shareId },
        },
        `loc-state-${shareId}-${dto.status}`,
      );
    }

    return updated;
  }

  async getPublicShareByToken(token: string) {
    const session = await this.prisma.locationShareSession.findUnique({
      where: { shareToken: token },
      include: {
        user: { select: { fullName: true, homeCity: true } },
        trip: { select: { title: true, destinationCity: true, status: true, startDate: true, endDate: true } },
      },
    });

    if (!session) {
      throw new NotFoundException('Tracking link is invalid or does not exist');
    }

    const isExpired = session.expiresAt.getTime() <= Date.now();
    const effectiveStatus =
      isExpired && session.status === LocationShareStatus.ACTIVE
        ? LocationShareStatus.EXPIRED
        : session.status;

    if (effectiveStatus === LocationShareStatus.REVOKED || effectiveStatus === LocationShareStatus.STOPPED) {
      return {
        status: effectiveStatus,
        label: session.label,
        travellerFirstName: session.user.fullName.split(' ')[0],
        message: 'Location sharing has been stopped or revoked by the traveller.',
        coordinatesVisible: false,
        isUpdating: false,
      };
    }

    if (effectiveStatus === LocationShareStatus.EXPIRED) {
      return {
        status: LocationShareStatus.EXPIRED,
        label: session.label,
        travellerFirstName: session.user.fullName.split(' ')[0],
        message: 'This private live location link has expired.',
        coordinatesVisible: false,
        isUpdating: false,
      };
    }

    if (effectiveStatus === LocationShareStatus.PAUSED) {
      return {
        status: LocationShareStatus.PAUSED,
        label: session.label,
        travellerFirstName: session.user.fullName.split(' ')[0],
        trip: session.shareTripContext ? session.trip : null,
        expiresAt: session.expiresAt,
        lastUpdatedAt: session.lastUpdatedAt,
        message: 'Location sharing is temporarily paused by the traveller.',
        coordinatesVisible: false,
        isUpdating: false,
      };
    }

    const secondsSinceLastUpdate = session.lastUpdatedAt
      ? Math.max(0, Math.floor((Date.now() - session.lastUpdatedAt.getTime()) / 1000))
      : null;

    const isUpdating =
      secondsSinceLastUpdate !== null && secondsSinceLastUpdate <= STALE_LOCATION_THRESHOLD_SECONDS;

    const staleWarning =
      secondsSinceLastUpdate === null
        ? 'Waiting for the traveller device to send its first location update.'
        : !isUpdating
          ? `Location is not currently updating (last signal ${Math.ceil(secondsSinceLastUpdate / 60)} min ago). Showing last known location.`
          : null;

    return {
      status: LocationShareStatus.ACTIVE,
      label: session.label,
      travellerName: session.user.fullName,
      trip: session.shareTripContext ? session.trip : null,
      latitude: session.lastLatitude,
      longitude: session.lastLongitude,
      accuracyMeters: session.lastAccuracyMeters,
      lastUpdatedAt: session.lastUpdatedAt,
      secondsSinceLastUpdate,
      isUpdating,
      staleWarning,
      expiresAt: session.expiresAt,
      coordinatesVisible: session.lastLatitude !== null && session.lastLongitude !== null,
    };
  }
}
