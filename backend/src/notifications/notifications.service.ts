import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BackgroundQueueService } from '../common/queue/background-queue.service';
import {
  buildPaginatedResponse,
  normalizePagination,
} from '../common/utils/pagination.util';
import { RealtimeService } from '../realtime/realtime.service';

export interface DispatchNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

const MANDATORY_SAFETY_TYPES = new Set<NotificationType>([
  NotificationType.SOS_ALERT,
  NotificationType.CHECK_IN_ESCALATED,
  NotificationType.VERIFICATION_UPDATE,
]);

const NOTIFICATION_DISPATCH_JOB = 'notification:dispatch';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queue?: BackgroundQueueService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.queue?.registerHandler(NOTIFICATION_DISPATCH_JOB, async (data) => {
      await this.send(data as unknown as DispatchNotificationInput);
    });
  }

  enqueue(input: DispatchNotificationInput, dedupeId?: string): void {
    if (this.queue) {
      void this.queue.enqueue(
        NOTIFICATION_DISPATCH_JOB,
        input as unknown as Record<string, unknown>,
        dedupeId ? { jobId: `notif:${dedupeId}` } : undefined,
      );
      return;
    }
    void this.send(input).catch(() => {});
  }

  async send(input: DispatchNotificationInput) {
    // Collapse preference + fcmToken lookup into 1 query instead of 2 separate queries
    const userRow = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: {
        fcmToken: true,
        notificationPreferences: true,
      },
    });

    if (!MANDATORY_SAFETY_TYPES.has(input.type) && userRow?.notificationPreferences) {
      const prefs = userRow.notificationPreferences;
      if (
        (input.type === NotificationType.CHAT_MESSAGE && !prefs.chatMessages) ||
        (input.type === NotificationType.TRIP_REMINDER && !prefs.tripReminders) ||
        (input.type === NotificationType.CHECK_IN_REMINDER && !prefs.checkInReminders) ||
        (input.type === NotificationType.LOCATION_SHARE && !prefs.locationEvents) ||
        ((input.type === NotificationType.BOOKING_REQUEST ||
          input.type === NotificationType.BOOKING_CONFIRMED ||
          input.type === NotificationType.BOOKING_CANCELLED) &&
          !prefs.bookingUpdates)
      ) {
        return null;
      }
    }

    const record = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadataJson: (input.metadata ?? {}) as object,
      },
    });

    this.realtime?.emitToUser(input.userId, 'notification:new', record);

    if (userRow?.fcmToken && process.env.FIREBASE_PROJECT_ID) {
      this.logger.debug(`FCM push queued for user=${input.userId} type=${input.type}`);
    }

    return record;
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updatePreferences(
    userId: string,
    patch: Partial<{
      bookingUpdates: boolean;
      chatMessages: boolean;
      tripReminders: boolean;
      checkInReminders: boolean;
      locationEvents: boolean;
      partnerUpdates: boolean;
    }>,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: patch,
      create: { userId, ...patch },
    });
  }

  async listForUser(
    userId: string,
    options?: {
      limit?: string | number;
      skip?: string | number;
      page?: string | number;
      unreadOnly?: boolean;
      paginated?: boolean;
    },
  ) {
    const pagination = normalizePagination({
      limit: options?.limit,
      skip: options?.skip,
      page: options?.page,
      defaultLimit: 40,
      maxLimit: 100,
    });
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(options?.unreadOnly ? { isRead: false } : {}),
    };

    if (!options?.paginated) {
      return this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
      });
    }

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return buildPaginatedResponse(items, total, pagination, { unreadCount });
  }

  async markRead(userId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: res.count };
  }

  async registerDeviceToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
    return { registered: true };
  }

  async broadcastAdminAnnouncement(actorId: string, title: string, body: string) {
    const activeUsers = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });

    if (activeUsers.length > 0) {
      await this.prisma.notification.createMany({
        data: activeUsers.map((u) => ({
          userId: u.id,
          type: NotificationType.SYSTEM_ANNOUNCEMENT,
          title,
          body,
          metadataJson: { sentBy: actorId },
        })),
      });
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'ADMIN_BROADCAST_ANNOUNCEMENT',
        targetType: 'NOTIFICATION',
        detailsJson: { title, recipientCount: activeUsers.length },
      },
    });

    return { deliveredCount: activeUsers.length };
  }
}
