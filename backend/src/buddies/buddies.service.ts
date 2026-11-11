import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  coarsenCoordinate,
  formatDistanceBand,
  haversineDistanceKm,
} from '../common/utils/geo.util';
import { resolveKeralaCoordinates } from '../common/utils/kerala-locations';
import {
  buildPaginatedResponse,
  normalizePagination,
  normalizeSearchQuery,
} from '../common/utils/pagination.util';
import { DiscoverPeopleQueryDto, UpsertBuddyProfileDto } from './dto/buddies.dto';

@Injectable()
export class BuddiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBlockedUserIds(viewerId: string): Promise<string[]> {
    const blocks = await this.prisma.userBlockReport.findMany({
      where: {
        actionType: 'BLOCK',
        OR: [{ reporterId: viewerId }, { targetUserId: viewerId }],
      },
      select: { reporterId: true, targetUserId: true },
    });
    const ids = new Set<string>([viewerId]);
    for (const b of blocks) {
      ids.add(b.reporterId);
      ids.add(b.targetUserId);
    }
    return Array.from(ids);
  }

  async discoverNearbyTravellers(viewerId: string, query: DiscoverPeopleQueryDto) {
    const excludedIds = await this.getBlockedUserIds(viewerId);
    const enforceRadius = query.radiusKm !== undefined && !query.city;
    const radiusKm = query.radiusKm ?? 50;
    const search = normalizeSearchQuery(query.search);
    const pagination = normalizePagination({
      limit: query.limit,
      skip: query.skip,
      page: query.page,
      defaultLimit: query.paginated ? 18 : 50,
      maxLimit: 100,
    });

    const where: Prisma.UserWhereInput = {
      id: { notIn: excludedIds },
      status: 'ACTIVE',
      deletedAt: null,
      discoverableAsTraveller: true,
      roles: { has: UserRole.TRAVELLER },
      ...(query.city ? { homeCity: { contains: query.city, mode: 'insensitive' } } : {}),
      ...(query.language ? { languages: { has: query.language } } : {}),
      ...(query.interest ? { interests: { has: query.interest } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { homeCity: { contains: search, mode: 'insensitive' } },
              { bio: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const hasPostFilter = Boolean(query.travelDate || enforceRadius || (query.lat !== undefined && query.lng !== undefined));

    const candidates = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        homeCity: true,
        bio: true,
        avatarUrl: true,
        languages: true,
        interests: true,
        approxLatitude: true,
        approxLongitude: true,
        trips: {
          where: { status: { in: ['PLANNED', 'ACTIVE'] } },
          select: {
            id: true,
            title: true,
            destinationCity: true,
            startDate: true,
            endDate: true,
          },
          take: 2,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: hasPostFilter ? 200 : pagination.limit,
      skip: hasPostFilter ? 0 : pagination.skip,
    });

    const targetDate = query.travelDate ? new Date(query.travelDate) : null;

    const mapped = candidates
      .map((person) => {
        const cityCoords = resolveKeralaCoordinates(person.homeCity);
        const pLat = person.approxLatitude ?? cityCoords?.latitude ?? null;
        const pLng = person.approxLongitude ?? cityCoords?.longitude ?? null;
        const distanceKm =
          query.lat !== undefined && query.lng !== undefined && pLat !== null && pLng !== null
            ? haversineDistanceKm(query.lat, query.lng, pLat, pLng)
            : null;
        return { person, distanceKm };
      })
      .filter(({ person, distanceKm }) => {
        if (targetDate) {
          const matchesTrip = person.trips.some(
            (t) => t.startDate <= targetDate && t.endDate >= targetDate,
          );
          if (!matchesTrip) return false;
        }
        if (enforceRadius && distanceKm !== null) {
          return distanceKm <= radiusKm;
        }
        return true;
      })
      .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
      .map(({ person, distanceKm }) => ({
        id: person.id,
        category: 'NEARBY_TRAVELLER',
        fullName: person.fullName,
        homeCity: person.homeCity,
        bio: person.bio,
        avatarUrl: person.avatarUrl,
        languages: person.languages,
        interests: person.interests,
        upcomingTrips: person.trips,
        distanceBand: distanceKm !== null ? formatDistanceBand(distanceKm) : person.homeCity || 'Kerala',
        distanceKm,
      }));

    if (!query.paginated) {
      return hasPostFilter ? mapped.slice(0, pagination.limit) : mapped;
    }

    if (hasPostFilter) {
      const slice = mapped.slice(pagination.skip, pagination.skip + pagination.limit);
      return buildPaginatedResponse(slice, mapped.length, pagination);
    }

    const total = await this.prisma.user.count({ where });
    return buildPaginatedResponse(mapped, total, pagination);
  }

  async discoverNearbyBuddies(viewerId: string, query: DiscoverPeopleQueryDto) {
    const excludedIds = await this.getBlockedUserIds(viewerId);
    const enforceRadius = query.radiusKm !== undefined && !query.city;
    const radiusKm = query.radiusKm ?? 50;
    const search = normalizeSearchQuery(query.search);
    const pagination = normalizePagination({
      limit: query.limit,
      skip: query.skip,
      page: query.page,
      defaultLimit: query.paginated ? 18 : 50,
      maxLimit: 100,
    });

    const where: Prisma.TravelBuddyProfileWhereInput = {
      userId: { notIn: excludedIds },
      isVerified: true,
      ...(query.availableOnly !== false ? { isAvailable: true } : {}),
      ...(query.city ? { city: { contains: query.city, mode: 'insensitive' } } : {}),
      ...(query.language ? { languages: { has: query.language } } : {}),
      ...(query.minRating !== undefined ? { ratingAverage: { gte: query.minRating } } : {}),
      ...(search
        ? {
            OR: [
              { headline: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { user: { fullName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
      user: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(query.interest ? { interests: { has: query.interest } } : {}),
      },
    };

    const hasPostFilter = Boolean(enforceRadius || (query.lat !== undefined && query.lng !== undefined));

    const buddies = await this.prisma.travelBuddyProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            bio: true,
            avatarUrl: true,
            interests: true,
            homeCity: true,
          },
        },
      },
      orderBy: [{ ratingAverage: 'desc' }, { reviewCount: 'desc' }],
      take: hasPostFilter ? 200 : pagination.limit,
      skip: hasPostFilter ? 0 : pagination.skip,
    });

    const mapped = buddies
      .map((b) => {
        const cityCoords = resolveKeralaCoordinates(b.city);
        const bLat =
          b.baseLatitude === 9.9658 && b.baseLongitude === 76.2421 && b.city.toLowerCase() !== 'kochi' && cityCoords
            ? cityCoords.latitude
            : b.baseLatitude;
        const bLng =
          b.baseLatitude === 9.9658 && b.baseLongitude === 76.2421 && b.city.toLowerCase() !== 'kochi' && cityCoords
            ? cityCoords.longitude
            : b.baseLongitude;
        const distanceKm =
          query.lat !== undefined && query.lng !== undefined
            ? haversineDistanceKm(query.lat, query.lng, bLat, bLng)
            : null;
        return { b, distanceKm };
      })
      .filter(({ distanceKm }) => {
        if (enforceRadius && distanceKm !== null) {
          return distanceKm <= radiusKm;
        }
        return true;
      })
      .sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER))
      .map(({ b, distanceKm }) => ({
        id: b.user.id,
        buddyProfileId: b.id,
        category: 'NEARBY_TRAVEL_BUDDY',
        fullName: b.user.fullName,
        avatarUrl: b.user.avatarUrl,
        headline: b.headline,
        city: b.city,
        servicesOffered: b.servicesOffered,
        languages: b.languages,
        interests: b.user.interests,
        hourlyRateInr: b.hourlyRateInr,
        isAvailable: b.isAvailable,
        isVerified: b.isVerified,
        ratingAverage: b.ratingAverage,
        reviewCount: b.reviewCount,
        distanceBand: distanceKm !== null ? formatDistanceBand(distanceKm) : b.city,
        distanceKm,
      }));

    if (!query.paginated) {
      return hasPostFilter ? mapped.slice(0, pagination.limit) : mapped;
    }

    if (hasPostFilter) {
      const slice = mapped.slice(pagination.skip, pagination.skip + pagination.limit);
      return buildPaginatedResponse(slice, mapped.length, pagination);
    }

    const total = await this.prisma.travelBuddyProfile.count({ where });
    return buildPaginatedResponse(mapped, total, pagination);
  }

  async upsertBuddyProfile(userId: string, dto: UpsertBuddyProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.roles.includes(UserRole.TRAVEL_BUDDY)) {
      throw new ForbiddenException(
        'Complete Travel Buddy 18+ selfie & identity verification before publishing a Buddy profile',
      );
    }

    return this.prisma.travelBuddyProfile.upsert({
      where: { userId },
      update: {
        headline: dto.headline,
        servicesOffered: dto.servicesOffered,
        languages: dto.languages,
        hourlyRateInr: dto.hourlyRateInr,
        isAvailable: dto.isAvailable,
        city: dto.city,
        baseLatitude: coarsenCoordinate(dto.baseLatitude),
        baseLongitude: coarsenCoordinate(dto.baseLongitude),
        availabilitySlots: (dto.availabilitySlots ?? {}) as object,
      },
      create: {
        userId,
        headline: dto.headline,
        servicesOffered: dto.servicesOffered,
        languages: dto.languages,
        hourlyRateInr: dto.hourlyRateInr,
        isAvailable: dto.isAvailable,
        city: dto.city,
        baseLatitude: coarsenCoordinate(dto.baseLatitude),
        baseLongitude: coarsenCoordinate(dto.baseLongitude),
        availabilitySlots: (dto.availabilitySlots ?? {}) as object,
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
  }

  async getBuddyPublicProfile(userId: string) {
    const buddy = await this.prisma.travelBuddyProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            bio: true,
            avatarUrl: true,
            interests: true,
            reviewsReceived: {
              orderBy: { createdAt: 'desc' },
              take: 20,
              include: {
                reviewer: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
    });
    if (!buddy) throw new NotFoundException('Travel Buddy profile not found');
    return buddy;
  }
}
