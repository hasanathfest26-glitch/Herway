import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { CheckInStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { BackgroundQueueService } from '../common/queue/background-queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';

const CHECKIN_STAGE_JOB = 'checkin:stage';

@Injectable()
export class CheckInSchedulerService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly queue?: BackgroundQueueService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.queue?.registerHandler(CHECKIN_STAGE_JOB, async (data) => {
      const { checkInId, stage } = data as {
        checkInId: string;
        stage: 'REMIND' | 'ESCALATE';
      };
      await this.processCheckInStage(checkInId, stage);
    });
  }

  async scheduleCheckInJobs(
    checkInId: string,
    scheduledAt: Date,
    graceMinutes: number,
  ): Promise<void> {
    if (!this.queue) return;

    const now = Date.now();
    const remindDelay = Math.max(0, scheduledAt.getTime() - now);
    const escalateDelay = Math.max(0, scheduledAt.getTime() + graceMinutes * 60_000 - now);

    // Non-blocking enqueue with deterministic deduplicated jobIds
    await Promise.all([
      this.queue.enqueue(
        CHECKIN_STAGE_JOB,
        { checkInId, stage: 'REMIND' },
        { jobId: `checkin:${checkInId}:REMIND`, delayMs: remindDelay },
      ),
      this.queue.enqueue(
        CHECKIN_STAGE_JOB,
        { checkInId, stage: 'ESCALATE' },
        { jobId: `checkin:${checkInId}:ESCALATE`, delayMs: escalateDelay },
      ),
    ]);
  }

  async processCheckInStage(checkInId: string, stage: 'REMIND' | 'ESCALATE') {
    const checkIn = await this.prisma.journeyCheckIn.findUnique({
      where: { id: checkInId },
      include: {
        user: { select: { id: true, fullName: true } },
        trip: { select: { id: true, title: true, destinationCity: true } },
      },
    });
    if (
      !checkIn ||
      checkIn.status === CheckInStatus.CONFIRMED ||
      checkIn.status === CheckInStatus.CANCELLED
    ) {
      return;
    }

    if (stage === 'REMIND' && checkIn.status === CheckInStatus.SCHEDULED) {
      const updated = await this.prisma.journeyCheckIn.update({
        where: { id: checkInId },
        data: { status: CheckInStatus.REMINDED, remindedAt: new Date() },
      });
      this.realtime?.emitToUser(checkIn.userId, 'checkin:updated', updated);
      this.notifications.enqueue(
        {
          userId: checkIn.userId,
          type: NotificationType.CHECK_IN_REMINDER,
          title: `Check-in due: ${checkIn.title}`,
          body: `Please confirm your safe arrival/status for ${checkIn.trip.title}.`,
          metadata: { checkInId, tripId: checkIn.tripId },
        },
        `checkin-remind-${checkInId}`,
      );
      return;
    }

    if (stage === 'ESCALATE') {
      const [updated, contacts] = await Promise.all([
        this.prisma.journeyCheckIn.update({
          where: { id: checkInId },
          data: { status: CheckInStatus.ESCALATED, escalatedAt: new Date() },
        }),
        this.prisma.trustedContact.findMany({
          where: { userId: checkIn.userId, canReceiveCheckIns: true },
        }),
      ]);

      this.realtime?.emitToUser(checkIn.userId, 'checkin:updated', updated);
      this.notifications.enqueue(
        {
          userId: checkIn.userId,
          type: NotificationType.CHECK_IN_ESCALATED,
          title: `Missed check-in notice sent to ${contacts.length} contact(s)`,
          body: `You missed "${checkIn.title}". Designated check-in contacts were asked to check in gently—this is not marked as an SOS emergency.`,
          metadata: { checkInId, notifiedContactCount: contacts.length },
        },
        `checkin-escalate-${checkInId}`,
      );
    }
  }
}
