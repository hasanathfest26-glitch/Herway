import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma, ReportStatus, SafetyActionType, UserRole } from '@prisma/client';
import { invalidateAuthCacheForUser } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../common/storage/storage.service';
import { generateEncryptedDocumentKey } from '../common/utils/crypto.util';
import { coarsenCoordinate } from '../common/utils/geo.util';
import { resolveKeralaCoordinates } from '../common/utils/kerala-locations';
import {
  buildPaginatedResponse,
  normalizePagination,
  normalizeSearchQuery,
} from '../common/utils/pagination.util';
import {
  CreateDocumentDto,
  ResolveReportDto,
  SafetyActionDto,
  UpdatePlatformSettingDto,
  UpdateProfileDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    let nextRoles: UserRole[] | undefined;
    if (dto.roles && dto.roles.length > 0) {
      const safeRoles = dto.roles.filter((r) => r !== UserRole.ADMIN);
      if (safeRoles.length > 0) {
        nextRoles = Array.from(new Set(safeRoles));
      }
    }

    const cityCoords = dto.homeCity ? resolveKeralaCoordinates(dto.homeCity) : null;
    const nextApproxLat =
      dto.approxLatitude !== undefined
        ? coarsenCoordinate(dto.approxLatitude)
        : cityCoords?.latitude;
    const nextApproxLng =
      dto.approxLongitude !== undefined
        ? coarsenCoordinate(dto.approxLongitude)
        : cityCoords?.longitude;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName,
        bio: dto.bio,
        homeCity: dto.homeCity,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        gender: dto.gender,
        avatarUrl: dto.avatarUrl,
        languages: dto.languages,
        interests: dto.interests,
        preferredDestinations: dto.preferredDestinations,
        travelPreferencesJson: dto.travelPreferencesJson as object | undefined,
        discoverableAsTraveller: dto.discoverableAsTraveller,
        roles: nextRoles,
        approxLatitude: nextApproxLat,
        approxLongitude: nextApproxLng,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        dateOfBirth: true,
        gender: true,
        avatarUrl: true,
        bio: true,
        homeCity: true,
        preferredDestinations: true,
        travelPreferencesJson: true,
        languages: true,
        interests: true,
        roles: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        discoverableAsTraveller: true,
        approxLatitude: true,
        approxLongitude: true,
        buddyProfile: true,
        updatedAt: true,
      },
    });

    invalidateAuthCacheForUser(userId);

    if (nextRoles?.includes(UserRole.TRAVEL_BUDDY)) {
      const resolvedFallback = resolveKeralaCoordinates(updated.homeCity);
      const baseLat = updated.approxLatitude ?? resolvedFallback?.latitude ?? 9.9658;
      const baseLng = updated.approxLongitude ?? resolvedFallback?.longitude ?? 76.2421;
      const buddyProfile = await this.prisma.travelBuddyProfile.upsert({
        where: { userId },
        update: {
          isVerified: true,
          isAvailable: true,
          city: updated.homeCity ?? 'Kochi',
          languages: updated.languages,
          baseLatitude: baseLat,
          baseLongitude: baseLng,
        },
        create: {
          userId,
          headline: `Travel Buddy in ${updated.homeCity ?? 'Kochi'}`,
          servicesOffered: ['City Companion', 'Local Guidance'],
          languages: updated.languages,
          city: updated.homeCity ?? 'Kochi',
          baseLatitude: baseLat,
          baseLongitude: baseLng,
          isVerified: true,
          isAvailable: true,
          verifiedAt: new Date(),
        },
      });
      return { ...updated, buddyProfile };
    } else if (nextRoles && !nextRoles.includes(UserRole.TRAVEL_BUDDY)) {
      await this.prisma.travelBuddyProfile.updateMany({
        where: { userId },
        data: { isAvailable: false },
      });
    }

    return updated;
  }

  async exportMyData(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        homeCity: true,
        languages: true,
        interests: true,
        preferredDestinations: true,
        roles: true,
        consentAcceptedAt: true,
        createdAt: true,
        trips: { include: { stops: true, checkIns: true } },
        trustedContacts: true,
        documents: {
          select: { id: true, documentType: true, title: true, mimeType: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return { exportedAt: new Date().toISOString(), user };
  }

  async deleteMyAccount(userId: string) {
    // Delete private documents, revoke sessions, and anonymize PII per DPDP data retention rules
    const docs = await this.prisma.travelDocument.findMany({ where: { userId } });
    for (const d of docs) {
      await this.storage.deleteStoredFile(d.storageProvider, d.storagePath);
    }

    await this.prisma.$transaction([
      this.prisma.travelDocument.deleteMany({ where: { userId } }),
      this.prisma.trustedContact.deleteMany({ where: { userId } }),
      this.prisma.locationShareSession.updateMany({
        where: { userId },
        data: { status: 'REVOKED', lastLatitude: null, lastLongitude: null },
      }),
      this.prisma.userSession.updateMany({
        where: { userId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: `deleted+${userId}@anonymized.herway.in`,
          fullName: 'Deleted User',
          phoneEncrypted: null,
          passwordHash: null,
          bio: null,
          discoverableAsTraveller: false,
          approxLatitude: null,
          approxLongitude: null,
          status: AccountStatus.DEACTIVATED,
          deletedAt: new Date(),
        },
      }),
    ]);

    return { deleted: true };
  }

  async toggleFavourite(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new ForbiddenException('Cannot favourite your own account');
    }
    const existing = await this.prisma.userFavourite.findUnique({
      where: { userId_targetUserId: { userId, targetUserId } },
    });
    if (existing) {
      await this.prisma.userFavourite.delete({ where: { id: existing.id } });
      return { favourited: false };
    }
    await this.prisma.userFavourite.create({ data: { userId, targetUserId } });
    return { favourited: true };
  }

  async listFavourites(userId: string) {
    return this.prisma.userFavourite.findMany({
      where: { userId },
      include: {
        targetUser: {
          select: {
            id: true,
            fullName: true,
            homeCity: true,
            roles: true,
            buddyProfile: true,
          },
        },
      },
    });
  }

  async createSafetyAction(reporterId: string, dto: SafetyActionDto) {
    if (reporterId === dto.targetUserId) {
      throw new ForbiddenException('Cannot report or block yourself');
    }

    const existing = await this.prisma.userBlockReport.findFirst({
      where: {
        reporterId,
        targetUserId: dto.targetUserId,
        actionType: dto.actionType,
        status: 'OPEN',
      },
    });
    if (existing) return existing;

    return this.prisma.userBlockReport.create({
      data: {
        reporterId,
        targetUserId: dto.targetUserId,
        actionType: dto.actionType,
        reason: dto.reason,
        details: dto.details,
      },
    });
  }

  async listMyBlockedUsers(userId: string) {
    return this.prisma.userBlockReport.findMany({
      where: { reporterId: userId, actionType: 'BLOCK' },
      include: {
        targetUser: { select: { id: true, fullName: true, homeCity: true } },
      },
    });
  }

  // Admin Methods
  async adminListUsers(options?: {
    search?: string;
    status?: string;
    role?: string;
    limit?: string;
    skip?: string;
    page?: string;
    paginated?: boolean;
  }) {
    const search = normalizeSearchQuery(options?.search);
    const statusFilter =
      options?.status && Object.values(AccountStatus).includes(options.status as AccountStatus)
        ? (options.status as AccountStatus)
        : undefined;
    const roleFilter =
      options?.role && Object.values(UserRole).includes(options.role as UserRole)
        ? (options.role as UserRole)
        : undefined;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(roleFilter ? { roles: { has: roleFilter } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { homeCity: { contains: search, mode: 'insensitive' } },
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

    const userSelect = {
      id: true,
      email: true,
      fullName: true,
      homeCity: true,
      roles: true,
      status: true,
      emailVerifiedAt: true,
      createdAt: true,
    } as const;

    if (!options?.paginated) {
      return this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        select: userSelect,
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        select: userSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, pagination);
  }

  async adminUpdateUserStatus(adminId: string, targetUserId: string, status: AccountStatus) {
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: { id: true, email: true, fullName: true, status: true },
    });
    if (status !== AccountStatus.ACTIVE) {
      await this.prisma.userSession.updateMany({
        where: { userId: targetUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ADMIN_USER_STATUS_UPDATED',
        targetType: 'USER',
        targetId: targetUserId,
        detailsJson: { status },
      },
    });
    return updated;
  }

  async adminUpdateUserRoles(adminId: string, targetUserId: string, roles: UserRole[]) {
    const cleanRoles = roles.length > 0 ? Array.from(new Set(roles)) : [UserRole.TRAVELLER];
    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { roles: cleanRoles },
      select: { id: true, email: true, fullName: true, roles: true, status: true },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ADMIN_USER_ROLES_UPDATED',
        targetType: 'USER',
        targetId: targetUserId,
        detailsJson: { roles: cleanRoles },
      },
    });
    return updated;
  }

  async adminListReports(options?: {
    status?: string;
    actionType?: string;
    search?: string;
    limit?: string;
    skip?: string;
    page?: string;
    paginated?: boolean;
  }) {
    const search = normalizeSearchQuery(options?.search);
    const statusFilter =
      options?.status && Object.values(ReportStatus).includes(options.status as ReportStatus)
        ? (options.status as ReportStatus)
        : undefined;
    const actionFilter =
      options?.actionType &&
      Object.values(SafetyActionType).includes(options.actionType as SafetyActionType)
        ? (options.actionType as SafetyActionType)
        : undefined;

    const where: Prisma.UserBlockReportWhereInput = {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(actionFilter ? { actionType: actionFilter } : {}),
      ...(search
        ? {
            OR: [
              { reason: { contains: search, mode: 'insensitive' } },
              { reporter: { fullName: { contains: search, mode: 'insensitive' } } },
              { targetUser: { fullName: { contains: search, mode: 'insensitive' } } },
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
      reporter: { select: { id: true, fullName: true, email: true } },
      targetUser: { select: { id: true, fullName: true, email: true, status: true } },
    } as const;

    if (!options?.paginated) {
      return this.prisma.userBlockReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include,
      });
    }

    const [items, total, openCount] = await Promise.all([
      this.prisma.userBlockReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include,
      }),
      this.prisma.userBlockReport.count({ where }),
      this.prisma.userBlockReport.count({ where: { status: ReportStatus.OPEN } }),
    ]);

    return buildPaginatedResponse(items, total, pagination, { openCount });
  }

  async adminResolveReport(adminId: string, reportId: string, dto: ResolveReportDto) {
    const updated = await this.prisma.userBlockReport.update({
      where: { id: reportId },
      data: { status: dto.status, adminNotes: dto.adminNotes },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'ADMIN_REPORT_RESOLVED',
        targetType: 'USER_BLOCK_REPORT',
        targetId: reportId,
        detailsJson: { status: dto.status },
      },
    });
    return updated;
  }

  async adminListSettings() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async adminUpsertSetting(adminId: string, dto: UpdatePlatformSettingDto) {
    const setting = await this.prisma.platformSetting.upsert({
      where: { key: dto.key },
      update: { valueJson: dto.valueJson as object, description: dto.description, updatedById: adminId },
      create: {
        key: dto.key,
        valueJson: dto.valueJson as object,
        description: dto.description,
        updatedById: adminId,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'PLATFORM_SETTING_UPDATED',
        targetType: 'PLATFORM_SETTING',
        targetId: dto.key,
        detailsJson: dto.valueJson as object,
      },
    });
    return setting;
  }

  async adminListAuditLogs(options?: {
    search?: string;
    action?: string;
    limit?: string;
    skip?: string;
    page?: string;
    paginated?: boolean;
  }) {
    const search = normalizeSearchQuery(options?.search);
    const where: Prisma.AuditLogWhereInput = {
      ...(options?.action ? { action: { contains: options.action, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { targetType: { contains: search, mode: 'insensitive' } },
              { actor: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const pagination = normalizePagination({
      limit: options?.limit,
      skip: options?.skip,
      page: options?.page,
      defaultLimit: 30,
      maxLimit: 150,
    });

    const include = {
      actor: { select: { id: true, fullName: true, email: true } },
    } as const;

    if (!options?.paginated) {
      return this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include,
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, pagination);
  }

  // Travel Document Vault (Strictly isolated to owning user with real encrypted storage)
  async listDocuments(userId: string) {
    return this.prisma.travelDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentType: true,
        title: true,
        originalFilename: true,
        storageProvider: true,
        mimeType: true,
        fileSizeBytes: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createDocument(
    userId: string,
    dto: CreateDocumentDto,
    file?: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ) {
    if (file) {
      const stored = await this.storage.storePrivateEncryptedFile('documents', userId, file);
      return this.prisma.travelDocument.create({
        data: {
          userId,
          documentType: dto.documentType,
          title: dto.title,
          originalFilename: stored.originalFilename,
          storageProvider: stored.storageProvider,
          storagePath: stored.storagePath,
          encryptedDek: stored.encryptedDek,
          iv: stored.iv,
          authTag: stored.authTag,
          mimeType: stored.mimeType,
          fileSizeBytes: stored.fileSizeBytes,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
        select: {
          id: true,
          documentType: true,
          title: true,
          originalFilename: true,
          storageProvider: true,
          mimeType: true,
          fileSizeBytes: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    if (!dto.storagePath) {
      throw new BadRequestException('A multipart document file or storagePath is required');
    }

    const { encryptedDek, iv } = generateEncryptedDocumentKey();
    const scopedPath = dto.storagePath.startsWith(`${userId}/`)
      ? dto.storagePath
      : `${userId}/${dto.storagePath}`;

    return this.prisma.travelDocument.create({
      data: {
        userId,
        documentType: dto.documentType,
        title: dto.title,
        storageProvider: 'SUPABASE_PRIVATE',
        storagePath: scopedPath,
        encryptedDek,
        iv,
        mimeType: dto.mimeType ?? 'application/pdf',
        fileSizeBytes: dto.fileSizeBytes ?? 0,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      select: {
        id: true,
        documentType: true,
        title: true,
        mimeType: true,
        fileSizeBytes: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async replaceDocument(
    userId: string,
    docId: string,
    dto: CreateDocumentDto,
    file?: { buffer: Buffer; mimetype: string; size: number; originalname: string },
  ) {
    const existing = await this.prisma.travelDocument.findUnique({ where: { id: docId } });
    if (!existing) throw new NotFoundException('Document not found');
    if (existing.userId !== userId) throw new ForbiddenException('Access restricted to document owner');

    if (file) {
      await this.storage.deleteStoredFile(existing.storageProvider, existing.storagePath);
      const stored = await this.storage.storePrivateEncryptedFile('documents', userId, file);
      return this.prisma.travelDocument.update({
        where: { id: docId },
        data: {
          documentType: dto.documentType,
          title: dto.title,
          originalFilename: stored.originalFilename,
          storageProvider: stored.storageProvider,
          storagePath: stored.storagePath,
          encryptedDek: stored.encryptedDek,
          iv: stored.iv,
          authTag: stored.authTag,
          mimeType: stored.mimeType,
          fileSizeBytes: stored.fileSizeBytes,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
    }

    const { encryptedDek, iv } = generateEncryptedDocumentKey();
    return this.prisma.travelDocument.update({
      where: { id: docId },
      data: {
        documentType: dto.documentType,
        title: dto.title,
        storagePath: dto.storagePath
          ? `${userId}/${dto.storagePath.replace(`${userId}/`, '')}`
          : existing.storagePath,
        encryptedDek,
        iv,
        mimeType: dto.mimeType ?? existing.mimeType,
        fileSizeBytes: dto.fileSizeBytes ?? existing.fileSizeBytes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async downloadDecryptedDocument(userId: string, docId: string) {
    const doc = await this.prisma.travelDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId) throw new ForbiddenException('Access restricted to document owner');
    if (!doc.authTag) {
      throw new BadRequestException('Document metadata uses external signed upload without stored cipher bytes');
    }

    const buffer = await this.storage.readDecryptedFile({
      storageProvider: doc.storageProvider,
      storagePath: doc.storagePath,
      encryptedDek: doc.encryptedDek,
      iv: doc.iv,
      authTag: doc.authTag,
    });

    return {
      buffer,
      mimeType: doc.mimeType,
      filename: doc.originalFilename || `${doc.title}.bin`,
    };
  }

  async deleteDocument(userId: string, docId: string) {
    const doc = await this.prisma.travelDocument.findUnique({ where: { id: docId } });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.userId !== userId) throw new ForbiddenException('Access restricted to document owner');

    await this.storage.deleteStoredFile(doc.storageProvider, doc.storagePath);
    await this.prisma.travelDocument.delete({ where: { id: docId } });
    return { deleted: true, id: docId };
  }
}
