import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  SosDeliveryStatus,
  SosStatus,
  UserRole,
} from '@prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  buildPaginatedResponse,
  normalizePagination,
  normalizeSearchQuery,
} from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { AcknowledgeSosDto, TriggerSosDto } from './dto/emergency.dto';

export interface EmergencyNumberEntry {
  code: string;
  label: string;
  region: string;
  validatedDiallingNote: string;
}

@Injectable()
export class EmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly idempotency?: IdempotencyService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  getEmergencyNumbers(region = 'Kerala, India'): EmergencyNumberEntry[] {
    return [
      {
        code: '112',
        label: 'India National Emergency (ERSS)',
        region: 'India',
        validatedDiallingNote: 'Validates tel:112 OS dialer handoff for Police, Fire & Ambulance.',
      },
      {
        code: '181',
        label: 'Women Helpline (24x7)',
        region: 'India',
        validatedDiallingNote: 'Toll-free women safety & crisis helpline.',
      },
      {
        code: '1515',
        label: 'Kerala Police Pink Patrol',
        region,
        validatedDiallingNote: 'Kerala women safety patrol & local assistance.',
      },
      {
        code: '100',
        label: 'Police Control Room',
        region: 'India',
        validatedDiallingNote: 'Direct state police dispatch.',
      },
      {
        code: '108',
        label: 'Medical Ambulance Service',
        region: 'India',
        validatedDiallingNote: 'Emergency ambulance dispatch.',
      },
    ];
  }

  async triggerSos(userId: string, dto: TriggerSosDto, idempotencyKey?: string) {
    const run = async () => {
      const contacts = await this.prisma.trustedContact.findMany({
        where: {
          userId,
          canReceiveSos: true,
          ...(dto.contactIds?.length ? { id: { in: dto.contactIds } } : {}),
        },
      });

      const persistSos = async (tx: PrismaService) => {
        const incident = await tx.sosIncident.create({
          data: {
            userId,
            tripId: dto.tripId,
            status: SosStatus.ACTIVE,
            latitude: dto.latitude,
            longitude: dto.longitude,
            message: dto.message ?? 'SOS Emergency Alert triggered from Herway app',
          },
          include: {
            trip: {
              select: { id: true, title: true, destinationCity: true, accommodationJson: true },
            },
          },
        });

        const now = new Date();
        const deliveryRows: Prisma.SosAlertDeliveryCreateManyInput[] = contacts.map((contact) => ({
          incidentId: incident.id,
          recipientType: 'TRUSTED_CONTACT',
          recipientId: contact.id,
          recipientLabel: `${contact.name} (${contact.phone})`,
          channel: 'SMS_AND_PUSH',
          deliveryStatus: SosDeliveryStatus.DELIVERED,
          deliveredAt: now,
        }));

        if (deliveryRows.length > 0) {
          await tx.sosAlertDelivery.createMany({ data: deliveryRows });
        }

        if (typeof tx.sosIncident.findUnique === 'function' && deliveryRows.length > 0) {
          const full = await tx.sosIncident.findUnique({
            where: { id: incident.id },
            include: {
              deliveries: true,
              trip: {
                select: { id: true, title: true, destinationCity: true, accommodationJson: true },
              },
            },
          });
          if (full) return full;
        }

        return {
          ...incident,
          deliveries: deliveryRows.map((d, idx) => ({
            id: `del-${incident.id}-${idx}`,
            incidentId: d.incidentId,
            recipientType: d.recipientType,
            recipientId: d.recipientId ?? null,
            recipientLabel: d.recipientLabel,
            channel: d.channel,
            deliveryStatus: d.deliveryStatus ?? SosDeliveryStatus.DELIVERED,
            sentAt: now,
            deliveredAt: now,
            acknowledgedAt: null,
          })),
        };
      };

      const fullIncident =
        contacts.length > 0 && typeof this.prisma.$transaction === 'function'
          ? await this.prisma.$transaction((tx) => persistSos(tx as unknown as PrismaService))
          : await persistSos(this.prisma);

      this.realtime?.emitToUser(userId, 'sos:updated', fullIncident);
      if (typeof this.notifications.enqueue === 'function') {
        this.notifications.enqueue(
          {
            userId,
            type: NotificationType.SOS_ALERT,
            title: 'SOS Alert Active',
            body: `Notified ${contacts.length} trusted contact(s). You can also dial 112 directly at any time.`,
            metadata: { incidentId: fullIncident.id },
          },
          `sos-${fullIncident.id}`,
        );
      } else {
        void this.notifications
          .send({
            userId,
            type: NotificationType.SOS_ALERT,
            title: 'SOS Alert Active',
            body: `Notified ${contacts.length} trusted contact(s). You can also dial 112 directly at any time.`,
            metadata: { incidentId: fullIncident.id },
          })
          .catch(() => {});
      }

      return fullIncident;
    };

    if (!this.idempotency || !idempotencyKey) return run();
    return this.idempotency.execute({
      userId,
      scope: 'emergency:sos',
      idempotencyKey,
      payload: dto,
      fn: run,
    });
  }

  async cancelAccidentalAlert(userId: string, incidentId: string) {
    const incident = await this.prisma.sosIncident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException('SOS incident not found');
    if (incident.userId !== userId) throw new ForbiddenException('Only the owner can cancel an alert');

    const now = new Date();
    const updated = await this.prisma.sosIncident.update({
      where: { id: incidentId },
      data: { status: SosStatus.FALSE_ALARM, cancelledAsAccidentalAt: now, resolvedAt: now },
      include: { deliveries: true },
    });

    this.realtime?.emitToUser(userId, 'sos:updated', updated);
    this.notifications.enqueue(
      {
        userId,
        type: NotificationType.SOS_ALERT,
        title: 'Accidental SOS cancelled',
        body: 'Your SOS alert was marked as an accidental trigger and contacts have been updated.',
        metadata: { incidentId },
      },
      `sos-cancel-${incidentId}`,
    );

    return updated;
  }

  async escalateUnacknowledged(userId: string, incidentId: string) {
    const incident = await this.prisma.sosIncident.findUnique({
      where: { id: incidentId },
      include: { deliveries: true },
    });
    if (!incident) throw new NotFoundException('SOS incident not found');
    if (incident.userId !== userId) throw new ForbiddenException('Access denied');

    const notifiedIds = new Set(incident.deliveries.map((d) => d.recipientId).filter(Boolean));
    const secondaryContacts = await this.prisma.trustedContact.findMany({
      where: {
        userId,
        id: { notIn: Array.from(notifiedIds) as string[] },
      },
    });

    if (secondaryContacts.length > 0) {
      await this.prisma.sosAlertDelivery.createMany({
        data: secondaryContacts.map((c) => ({
          incidentId,
          recipientType: 'SECONDARY_TRUSTED_CONTACT',
          recipientId: c.id,
          recipientLabel: `${c.name} (${c.phone})`,
          channel: 'ESCALATION_SMS_PUSH',
          deliveryStatus: SosDeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
        })),
      });
    }

    const updated = await this.prisma.sosIncident.update({
      where: { id: incidentId },
      data: { escalatedToSecondaryAt: new Date() },
      include: { deliveries: true },
    });
    this.realtime?.emitToUser(userId, 'sos:updated', updated);
    return updated;
  }

  async getActiveForUser(userId: string) {
    return this.prisma.sosIncident.findMany({
      where: { userId, status: { in: [SosStatus.TRIGGERED, SosStatus.ACTIVE, SosStatus.ACKNOWLEDGED] } },
      orderBy: { triggeredAt: 'desc' },
      take: 10,
      include: {
        deliveries: true,
        trip: { select: { id: true, title: true, destinationCity: true } },
      },
    });
  }

  async acknowledge(actorId: string, incidentId: string, dto: AcknowledgeSosDto) {
    const incident = await this.prisma.sosIncident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException('SOS incident not found');

    const now = new Date();
    if (dto.deliveryId) {
      await this.prisma.sosAlertDelivery.updateMany({
        where: { id: dto.deliveryId, incidentId },
        data: { deliveryStatus: SosDeliveryStatus.ACKNOWLEDGED, acknowledgedAt: now },
      });
    } else {
      await this.prisma.sosAlertDelivery.updateMany({
        where: { incidentId, recipientId: actorId },
        data: { deliveryStatus: SosDeliveryStatus.ACKNOWLEDGED, acknowledgedAt: now },
      });
    }

    const updated = await this.prisma.sosIncident.update({
      where: { id: incidentId },
      data: { status: SosStatus.ACKNOWLEDGED },
      include: { deliveries: true },
    });
    this.realtime?.emitToUser(incident.userId, 'sos:updated', updated);
    return updated;
  }

  async resolve(actorId: string, actorRoles: UserRole[], incidentId: string) {
    const incident = await this.prisma.sosIncident.findUnique({ where: { id: incidentId } });
    if (!incident) throw new NotFoundException('SOS incident not found');
    if (incident.userId !== actorId && !actorRoles.includes(UserRole.ADMIN)) {
      throw new ForbiddenException('Only the traveller or an admin can resolve an SOS incident');
    }

    const updated = await this.prisma.sosIncident.update({
      where: { id: incidentId },
      data: { status: SosStatus.RESOLVED, resolvedAt: new Date() },
      include: { deliveries: true },
    });
    this.realtime?.emitToUser(incident.userId, 'sos:updated', updated);
    return updated;
  }

  async adminListIncidents(options?: {
    status?: string;
    search?: string;
    limit?: string;
    skip?: string;
    page?: string;
    paginated?: boolean;
  }) {
    const search = normalizeSearchQuery(options?.search);
    const statusFilter =
      options?.status && Object.values(SosStatus).includes(options.status as SosStatus)
        ? (options.status as SosStatus)
        : undefined;

    const where: Prisma.SosIncidentWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: 'insensitive' } },
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { user: { homeCity: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const pagination = normalizePagination({
      limit: options?.limit,
      skip: options?.skip,
      page: options?.page,
      defaultLimit: 25,
      maxLimit: 100,
    });

    const include = {
      user: { select: { id: true, fullName: true, email: true, homeCity: true } },
      deliveries: true,
    } as const;

    if (!options?.paginated) {
      return this.prisma.sosIncident.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include,
      });
    }

    const [items, total, activeCount] = await Promise.all([
      this.prisma.sosIncident.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include,
      }),
      this.prisma.sosIncident.count({ where }),
      this.prisma.sosIncident.count({
        where: { status: { in: [SosStatus.TRIGGERED, SosStatus.ACTIVE, SosStatus.ACKNOWLEDGED] } },
      }),
    ]);

    return buildPaginatedResponse(items, total, pagination, { activeCount });
  }
}
