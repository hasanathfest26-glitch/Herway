import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { NotificationType, Prisma, UserRole, VerificationStatus } from '@prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { resolveKeralaCoordinates } from '../common/utils/kerala-locations';
import {
  buildPaginatedResponse,
  normalizePagination,
  normalizeSearchQuery,
} from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../realtime/realtime.service';
import { ReviewVerificationDto, SubmitVerificationDto } from './dto/verification.dto';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly idempotency?: IdempotencyService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  async apply(
    userId: string,
    dto: SubmitVerificationDto,
    files?: {
      selfie?: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>;
      idDocument?: Array<{ buffer: Buffer; mimetype: string; size: number; originalname: string }>;
    },
    idempotencyKey?: string,
  ) {
    if (
      dto.role !== UserRole.TRAVEL_BUDDY &&
      dto.role !== UserRole.SAFE_HAVEN_PARTNER
    ) {
      throw new BadRequestException(
        'Verification applies to TRAVEL_BUDDY or SAFE_HAVEN_PARTNER roles',
      );
    }

    const run = async () => {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      const [storedSelfie, storedId] = await Promise.all([
        files?.selfie?.[0]
          ? this.storage.storePrivateEncryptedFile('verification', userId, files.selfie[0])
          : Promise.resolve(null),
        files?.idDocument?.[0]
          ? this.storage.storePrivateEncryptedFile('verification', userId, files.idDocument[0])
          : Promise.resolve(null),
      ]);

      const selfiePath = storedSelfie?.storagePath ?? dto.liveSelfiePath;
      const idPath = storedId?.storagePath ?? dto.idDocumentPath;

      const persistApplication = async (tx: PrismaService) => {
        const application = await tx.verificationApplication.create({
          data: {
            userId,
            role: dto.role,
            liveSelfiePath: selfiePath,
            idDocumentPath: idPath,
            licenceReference: dto.licenceReference,
            ageVerified18Plus: true,
            notes: dto.notes,
            status: VerificationStatus.APPROVED,
            reviewedAt: new Date(),
          },
        });

        const currentRoles = new Set(user.roles);
        currentRoles.add(dto.role);
        await tx.user.update({
          where: { id: userId },
          data: { roles: Array.from(currentRoles) },
        });

        if (dto.role === UserRole.TRAVEL_BUDDY) {
          const cityCoords = resolveKeralaCoordinates(user.homeCity);
          const baseLat = user.approxLatitude ?? cityCoords?.latitude ?? 9.9658;
          const baseLng = user.approxLongitude ?? cityCoords?.longitude ?? 76.2421;
          await tx.travelBuddyProfile.upsert({
            where: { userId },
            update: {
              isVerified: true,
              isAvailable: true,
              city: user.homeCity ?? 'Kochi',
              baseLatitude: baseLat,
              baseLongitude: baseLng,
              verifiedAt: new Date(),
            },
            create: {
              userId,
              headline: `Travel Buddy in ${user.homeCity ?? 'Kochi'}`,
              servicesOffered: ['City Companion', 'Local Guidance'],
              languages: user.languages,
              city: user.homeCity ?? 'Kochi',
              baseLatitude: baseLat,
              baseLongitude: baseLng,
              isVerified: true,
              isAvailable: true,
              verifiedAt: new Date(),
            },
          });
        }

        return application;
      };

      const application =
        typeof this.prisma.$transaction === 'function'
          ? await this.prisma.$transaction((tx) =>
              persistApplication(tx as unknown as PrismaService),
            )
          : await persistApplication(this.prisma);

      this.realtime?.emitToUser(userId, 'verification:updated', application);
      return application;
    };

    if (!this.idempotency || !idempotencyKey) return run();
    return this.idempotency.execute({
      userId,
      scope: `verification:apply:${dto.role}`,
      idempotencyKey,
      payload: { role: dto.role, licenceReference: dto.licenceReference },
      fn: run,
    });
  }

  async listMine(userId: string) {
    return this.prisma.verificationApplication.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
  }

  async listPendingForAdmin() {
    return this.prisma.verificationApplication.findMany({
      where: {
        status: { in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW] },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            homeCity: true,
            dateOfBirth: true,
            gender: true,
            roles: true,
          },
        },
      },
    });
  }

  async listAllForAdmin(options?: {
    status?: string;
    search?: string;
    limit?: string;
    skip?: string;
    page?: string;
    paginated?: boolean;
  }) {
    const search = normalizeSearchQuery(options?.search);
    const statusUpper = options?.status?.toUpperCase();
    const statusWhere: Prisma.VerificationApplicationWhereInput =
      statusUpper === 'PENDING'
        ? { status: { in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW] } }
        : statusUpper &&
            Object.values(VerificationStatus).includes(statusUpper as VerificationStatus)
          ? { status: statusUpper as VerificationStatus }
          : {};

    const where: Prisma.VerificationApplicationWhereInput = {
      ...statusWhere,
      ...(search
        ? {
            OR: [
              { licenceReference: { contains: search, mode: 'insensitive' } },
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
      defaultLimit: 20,
      maxLimit: 100,
    });

    const userSelect = {
      id: true,
      fullName: true,
      email: true,
      homeCity: true,
      dateOfBirth: true,
      gender: true,
      roles: true,
    } as const;

    if (!options?.paginated) {
      return this.prisma.verificationApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: { user: { select: userSelect } },
      });
    }

    const [items, total, pendingCount] = await Promise.all([
      this.prisma.verificationApplication.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: { user: { select: userSelect } },
      }),
      this.prisma.verificationApplication.count({ where }),
      this.prisma.verificationApplication.count({
        where: { status: { in: [VerificationStatus.PENDING, VerificationStatus.UNDER_REVIEW] } },
      }),
    ]);

    return buildPaginatedResponse(items, total, pagination, { pendingCount });
  }

  async review(adminId: string, applicationId: string, dto: ReviewVerificationDto) {
    const application = await this.prisma.verificationApplication.findUnique({
      where: { id: applicationId },
      include: { user: true },
    });
    if (!application) throw new NotFoundException('Verification application not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const app = await tx.verificationApplication.update({
        where: { id: applicationId },
        data: {
          status: dto.status,
          reviewerId: adminId,
          reviewNotes: dto.reviewNotes,
          reviewedAt: new Date(),
        },
      });

      if (dto.status === VerificationStatus.APPROVED) {
        const currentRoles = new Set(application.user.roles);
        currentRoles.add(application.role);

        await tx.user.update({
          where: { id: application.userId },
          data: { roles: Array.from(currentRoles) },
        });

        if (application.role === UserRole.TRAVEL_BUDDY) {
          await tx.travelBuddyProfile.upsert({
            where: { userId: application.userId },
            update: { isVerified: true, verifiedAt: new Date() },
            create: {
              userId: application.userId,
              headline: `Travel Buddy in ${application.user.homeCity ?? 'Kochi'}`,
              servicesOffered: ['City Companion', 'Local Guidance'],
              languages: application.user.languages,
              city: application.user.homeCity ?? 'Kochi',
              baseLatitude: application.user.approxLatitude ?? 9.9658,
              baseLongitude: application.user.approxLongitude ?? 76.2421,
              isVerified: true,
              verifiedAt: new Date(),
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'VERIFICATION_REVIEWED',
          targetType: 'VERIFICATION_APPLICATION',
          targetId: applicationId,
          detailsJson: { role: application.role, status: dto.status },
        },
      });

      return app;
    });

    this.realtime?.emitToUser(application.userId, 'verification:updated', updated);
    this.notifications.enqueue(
      {
        userId: application.userId,
        type: NotificationType.VERIFICATION_UPDATE,
        title: `Verification ${dto.status.toLowerCase()}`,
        body:
          dto.status === VerificationStatus.APPROVED
            ? `Your ${application.role.replace(/_/g, ' ')} role has been activated.`
            : `Your ${application.role.replace(/_/g, ' ')} verification status changed to ${dto.status}.`,
        metadata: { applicationId, role: application.role, status: dto.status },
      },
      `verif-review-${applicationId}-${dto.status}`,
    );

    return updated;
  }
}
