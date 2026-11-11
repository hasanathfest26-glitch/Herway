import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  ReportStatus,
  SafeHavenApprovalStatus,
  SafeHavenCategory,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { SpatialService } from '../common/prisma/spatial.service';
import {
  buildPaginatedResponse,
  normalizePagination,
  normalizeSearchQuery,
} from '../common/utils/pagination.util';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ApproveSafeHavenDto,
  RegisterSafeHavenDto,
  ReportSafeHavenDto,
  ResolveSafeHavenReportDto,
  UpdatePartnerSafeHavenDto,
} from './dto/safe-havens.dto';

@Injectable()
export class SafeHavensService {
  private readonly listCache = new Map<string, { data: unknown; expiresAtMs: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly spatial: SpatialService,
    private readonly notifications: NotificationsService,
  ) {}

  private clearListCache(): void {
    this.listCache.clear();
  }

  private getCached<T>(key: string): T | null {
    const entry = this.listCache.get(key);
    if (!entry || entry.expiresAtMs <= Date.now()) {
      this.listCache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCached(key: string, data: unknown, ttlMs = 30_000): void {
    this.listCache.set(key, { data, expiresAtMs: Date.now() + ttlMs });
  }

  async register(partnerUserId: string, dto: RegisterSafeHavenDto) {
    if (dto.agreementAccepted === false) {
      throw new BadRequestException(
        'Safe Haven partners must accept the partnership assistance commitment terms',
      );
    }

    const created = await this.prisma.safeHaven.create({
      data: {
        partnerUserId,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        logoUrl: dto.logoUrl,
        address: dto.address,
        city: dto.city,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone,
        contactEmail: dto.contactEmail,
        responsiblePersonName: dto.responsiblePersonName,
        responsiblePersonPhone: dto.responsiblePersonPhone,
        operatingHoursJson: dto.operatingHoursJson as object,
        assistanceServices: dto.assistanceServices,
        assistanceCommitments: dto.assistanceCommitments,
        licenceNumber: dto.licenceNumber,
        verificationDocumentsJson: dto.verificationDocumentsJson as object | undefined,
        partnershipAgreementJson: (dto.partnershipAgreementJson ?? {
          accepted: true,
          version: '2026.1',
        }) as object,
        agreementAcceptedAt: new Date(),
        approvalStatus: SafeHavenApprovalStatus.PENDING,
        verifiedBadge: false,
      },
    });
    this.clearListCache();
    return created;
  }

  /**
   * Returns ONLY admin-approved Safe Haven Partners with verifiedBadge=true.
   */
  async findNearbyVerified(
    lat?: number,
    lng?: number,
    city?: string,
    category?: SafeHavenCategory,
    options?: { search?: string; limit?: string; skip?: string; page?: string; paginated?: boolean },
  ) {
    const cacheKey = `verified:${city ?? ''}:${category ?? ''}`;
    let havens = this.getCached<Awaited<ReturnType<typeof this.prisma.safeHaven.findMany>>>(cacheKey);
    if (!havens) {
      havens = await this.prisma.safeHaven.findMany({
        where: {
          approvalStatus: SafeHavenApprovalStatus.APPROVED,
          verifiedBadge: true,
          isActive: true,
          ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
          ...(category ? { category } : {}),
        },
        take: 200,
      });
      this.setCached(cacheKey, havens, 30_000);
    }

    const search = normalizeSearchQuery(options?.search)?.toLowerCase();
    const sorted = havens
      .filter((h) =>
        search
          ? h.name.toLowerCase().includes(search) ||
            h.address.toLowerCase().includes(search) ||
            h.city.toLowerCase().includes(search) ||
            h.assistanceServices.some((s) => s.toLowerCase().includes(search))
          : true,
      )
      .map((h) => ({
        ...h,
        distanceKm:
          lat !== undefined && lng !== undefined
            ? this.spatial.computeDistanceKm(lat, lng, h.latitude, h.longitude)
            : null,
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    if (!options?.paginated) {
      return options?.limit ? sorted.slice(0, Number(options.limit)) : sorted;
    }

    const pagination = normalizePagination({
      limit: options.limit,
      skip: options.skip,
      page: options.page,
      defaultLimit: 18,
      maxLimit: 100,
    });
    const slice = sorted.slice(pagination.skip, pagination.skip + pagination.limit);
    return buildPaginatedResponse(slice, sorted.length, pagination);
  }

  /**
   * Returns pending demo Safe Haven records strictly marked isDemoData=true for Explore/filter/map testing.
   * Never exposes verifiedBadge=true unless admin has explicitly approved them.
   */
  async findDemoPending(
    lat?: number,
    lng?: number,
    city?: string,
    category?: SafeHavenCategory,
    options?: { search?: string; limit?: string; skip?: string; page?: string; paginated?: boolean },
  ) {
    const cacheKey = `demo:${city ?? ''}:${category ?? ''}`;
    let havens = this.getCached<Awaited<ReturnType<typeof this.prisma.safeHaven.findMany>>>(cacheKey);
    if (!havens) {
      havens = await this.prisma.safeHaven.findMany({
        where: {
          isDemoData: true,
          isActive: true,
          ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
          ...(category ? { category } : {}),
        },
        orderBy: { name: 'asc' },
        take: 200,
      });
      this.setCached(cacheKey, havens, 30_000);
    }

    const search = normalizeSearchQuery(options?.search)?.toLowerCase();
    const sorted = havens
      .filter((h) =>
        search
          ? h.name.toLowerCase().includes(search) ||
            h.address.toLowerCase().includes(search) ||
            h.city.toLowerCase().includes(search)
          : true,
      )
      .map((h) => ({
        ...h,
        distanceKm:
          lat !== undefined && lng !== undefined
            ? this.spatial.computeDistanceKm(lat, lng, h.latitude, h.longitude)
            : null,
      }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    if (!options?.paginated) {
      return options?.limit ? sorted.slice(0, Number(options.limit)) : sorted;
    }

    const pagination = normalizePagination({
      limit: options.limit,
      skip: options.skip,
      page: options.page,
      defaultLimit: 18,
      maxLimit: 100,
    });
    const slice = sorted.slice(pagination.skip, pagination.skip + pagination.limit);
    return buildPaginatedResponse(slice, sorted.length, pagination);
  }

  /**
   * Server-side Google Places Nearby proxy returning ordinary public map places
   * explicitly tagged verifiedSafeHaven=false so API keys never leak to clients.
   */
  async findOrdinaryGooglePlaces(lat: number, lng: number, type: 'hospital' | 'pharmacy' | 'lodging') {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey.includes('your-google-maps')) {
      return {
        source: 'GOOGLE_MAPS_UNCONFIGURED',
        places: [],
        note: 'Configure GOOGLE_MAPS_API_KEY on backend to display live unverified Google Places separately.',
      };
    }

    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=5000&type=${type}&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { source: 'GOOGLE_MAPS_ERROR', places: [] };
    }
    const json = (await res.json()) as {
      results?: Array<{
        place_id: string;
        name: string;
        vicinity?: string;
        geometry?: { location?: { lat: number; lng: number } };
        opening_hours?: { open_now?: boolean };
      }>;
    };

    return {
      source: 'GOOGLE_MAPS_PLACES',
      places: (json.results ?? []).slice(0, 15).map((p) => ({
        id: p.place_id,
        name: p.name,
        address: p.vicinity ?? '',
        latitude: p.geometry?.location?.lat,
        longitude: p.geometry?.location?.lng,
        openNow: p.opening_hours?.open_now ?? null,
        verifiedSafeHaven: false,
      })),
    };
  }

  async reportInaccuracy(reporterId: string, safeHavenId: string, dto: ReportSafeHavenDto) {
    const haven = await this.prisma.safeHaven.findUnique({ where: { id: safeHavenId } });
    if (!haven) throw new NotFoundException('Safe Haven not found');

    return this.prisma.safeHavenReport.create({
      data: {
        safeHavenId,
        reporterId,
        reason: dto.reason,
        details: dto.details,
      },
    });
  }

  async listForPartner(
    partnerUserId: string,
    options?: {
      search?: string;
      status?: string;
      limit?: string;
      skip?: string;
      page?: string;
      paginated?: boolean;
    },
  ) {
    const search = normalizeSearchQuery(options?.search);
    const statusFilter =
      options?.status &&
      Object.values(SafeHavenApprovalStatus).includes(options.status as SafeHavenApprovalStatus)
        ? (options.status as SafeHavenApprovalStatus)
        : undefined;
    const where: Prisma.SafeHavenWhereInput = {
      partnerUserId,
      ...(statusFilter ? { approvalStatus: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { licenceNumber: { contains: search, mode: 'insensitive' } },
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

    if (!options?.paginated) {
      return this.prisma.safeHaven.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.safeHaven.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
      }),
      this.prisma.safeHaven.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, pagination);
  }

  async updateAsPartner(partnerUserId: string, havenId: string, dto: UpdatePartnerSafeHavenDto) {
    const haven = await this.prisma.safeHaven.findUnique({ where: { id: havenId } });
    if (!haven) throw new NotFoundException('Safe Haven not found');
    if (haven.partnerUserId !== partnerUserId) {
      throw new ForbiddenException('Only the owning Safe Haven Partner can modify this listing');
    }

    const updated = await this.prisma.safeHaven.update({
      where: { id: havenId },
      data: {
        description: dto.description,
        logoUrl: dto.logoUrl,
        phone: dto.phone,
        contactEmail: dto.contactEmail,
        responsiblePersonName: dto.responsiblePersonName,
        responsiblePersonPhone: dto.responsiblePersonPhone,
        operatingHoursJson: dto.operatingHoursJson as object | undefined,
        assistanceServices: dto.assistanceServices,
        isActive: dto.isActive,
      },
    });
    this.clearListCache();
    return updated;
  }

  async adminListAll(options?: {
    search?: string;
    status?: string;
    city?: string;
    limit?: string;
    skip?: string;
    page?: string;
    paginated?: boolean;
  }) {
    const search = normalizeSearchQuery(options?.search);
    const statusUpper = options?.status?.toUpperCase();
    const statusWhere: Prisma.SafeHavenWhereInput =
      statusUpper === 'REJECTED_OR_SUSPENDED'
        ? { approvalStatus: { in: [SafeHavenApprovalStatus.REJECTED, SafeHavenApprovalStatus.SUSPENDED] } }
        : statusUpper &&
            Object.values(SafeHavenApprovalStatus).includes(statusUpper as SafeHavenApprovalStatus)
          ? { approvalStatus: statusUpper as SafeHavenApprovalStatus }
          : {};

    const where: Prisma.SafeHavenWhereInput = {
      ...statusWhere,
      ...(options?.city ? { city: { contains: options.city, mode: 'insensitive' } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { licenceNumber: { contains: search, mode: 'insensitive' } },
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

    if (!options?.paginated) {
      return this.prisma.safeHaven.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          partnerUser: { select: { id: true, fullName: true, email: true } },
          _count: { select: { reports: true } },
        },
      });
    }

    const [items, total, pendingCount] = await Promise.all([
      this.prisma.safeHaven.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          partnerUser: { select: { id: true, fullName: true, email: true } },
          _count: { select: { reports: true } },
        },
      }),
      this.prisma.safeHaven.count({ where }),
      this.prisma.safeHaven.count({ where: { approvalStatus: SafeHavenApprovalStatus.PENDING } }),
    ]);

    return buildPaginatedResponse(items, total, pagination, { pendingCount });
  }

  async adminListReports(options?: {
    status?: string;
    limit?: string;
    skip?: string;
    page?: string;
    paginated?: boolean;
  }) {
    const statusFilter =
      options?.status && Object.values(ReportStatus).includes(options.status as ReportStatus)
        ? (options.status as ReportStatus)
        : undefined;
    const where: Prisma.SafeHavenReportWhereInput = statusFilter ? { status: statusFilter } : {};
    const pagination = normalizePagination({
      limit: options?.limit,
      skip: options?.skip,
      page: options?.page,
      defaultLimit: 20,
      maxLimit: 100,
    });

    if (!options?.paginated) {
      return this.prisma.safeHavenReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          safeHaven: { select: { id: true, name: true, city: true } },
          reporter: { select: { id: true, fullName: true, email: true } },
        },
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.safeHavenReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pagination.limit,
        skip: pagination.skip,
        include: {
          safeHaven: { select: { id: true, name: true, city: true } },
          reporter: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.safeHavenReport.count({ where }),
    ]);

    return buildPaginatedResponse(items, total, pagination);
  }

  async adminResolveReport(adminId: string, reportId: string, dto: ResolveSafeHavenReportDto) {
    const updated = await this.prisma.safeHavenReport.update({
      where: { id: reportId },
      data: { status: dto.status, adminNotes: dto.adminNotes },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'SAFE_HAVEN_REPORT_RESOLVED',
        targetType: 'SAFE_HAVEN_REPORT',
        targetId: reportId,
        detailsJson: { status: dto.status },
      },
    });
    return updated;
  }

  async adminMarkRechecked(adminId: string, havenId: string, notes?: string) {
    const now = new Date();
    const nextRecheckDueAt = new Date(now.getTime() + 90 * 86400_000);
    const updated = await this.prisma.safeHaven.update({
      where: { id: havenId },
      data: { lastRecheckedAt: now, nextRecheckDueAt, approvalNotes: notes },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'SAFE_HAVEN_PERIODIC_RECHECK',
        targetType: 'SAFE_HAVEN',
        targetId: havenId,
        detailsJson: { nextRecheckDueAt, notes },
      },
    });
    return updated;
  }

  async adminApprove(adminId: string, havenId: string, dto: ApproveSafeHavenDto) {
    const haven = await this.prisma.safeHaven.findUnique({
      where: { id: havenId },
      include: { partnerUser: true },
    });
    if (!haven) throw new NotFoundException('Safe Haven not found');

    const approved = dto.approvalStatus === SafeHavenApprovalStatus.APPROVED;
    const now = new Date();
    const cleanedDescription =
      approved && haven.description?.startsWith('DEMO DATA')
        ? `Verified Safe Haven Partner in ${haven.city} supporting women travellers.`
        : haven.description;

    const [updated] = await this.prisma.$transaction(async (tx) => {
      const savedHaven = await tx.safeHaven.update({
        where: { id: havenId },
        data: {
          approvalStatus: dto.approvalStatus,
          verifiedBadge: approved,
          isDemoData: approved ? false : haven.isDemoData,
          description: cleanedDescription,
          approvalNotes: dto.approvalNotes,
          approvedAt: approved ? now : null,
          lastRecheckedAt: approved ? now : undefined,
          nextRecheckDueAt: approved ? new Date(now.getTime() + 90 * 86400_000) : null,
        },
      });

      if (approved && !haven.partnerUser.roles.includes(UserRole.SAFE_HAVEN_PARTNER)) {
        const roles = Array.from(new Set([...haven.partnerUser.roles, UserRole.SAFE_HAVEN_PARTNER]));
        await tx.user.update({
          where: { id: haven.partnerUserId },
          data: { roles },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'SAFE_HAVEN_REVIEWED',
          targetType: 'SAFE_HAVEN',
          targetId: havenId,
          detailsJson: { approvalStatus: dto.approvalStatus, verifiedBadge: approved },
        },
      });

      return [savedHaven];
    });

    this.clearListCache();
    this.notifications.enqueue(
      {
        userId: haven.partnerUserId,
        type: NotificationType.VERIFICATION_UPDATE,
        title: `Safe Haven ${dto.approvalStatus.toLowerCase()}`,
        body: approved
          ? `${haven.name} is now an approved Safe Haven Partner with a verified badge.`
          : `${haven.name} status updated to ${dto.approvalStatus}.`,
        metadata: { safeHavenId: havenId },
      },
      `haven-review-${havenId}-${dto.approvalStatus}`,
    );

    return updated;
  }

  async adminDelete(adminId: string, havenId: string) {
    const haven = await this.prisma.safeHaven.findUnique({ where: { id: havenId } });
    if (!haven) throw new NotFoundException('Safe Haven not found');
    await this.prisma.$transaction([
      this.prisma.safeHaven.delete({ where: { id: havenId } }),
      this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'SAFE_HAVEN_DELETED',
          targetType: 'SAFE_HAVEN',
          targetId: havenId,
          detailsJson: { name: haven.name },
        },
      }),
    ]);
    this.clearListCache();
    return { deleted: true, id: havenId };
  }
}
