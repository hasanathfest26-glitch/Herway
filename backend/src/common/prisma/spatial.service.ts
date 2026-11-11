import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { haversineDistanceKm } from '../utils/geo.util';

@Injectable()
export class SpatialService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes PostGIS ST_DWithin radius lookup when USE_POSTGIS_RAW=true,
   * otherwise computes accurate WGS84 great-circle distance in-process.
   */
  async findIdsWithinRadius(
    table: 'TravelBuddyProfile' | 'SafeHaven',
    lat: number,
    lng: number,
    radiusKm: number,
  ): Promise<Map<string, number> | null> {
    if (process.env.USE_POSTGIS_RAW !== 'true') {
      return null;
    }

    const latCol = table === 'SafeHaven' ? 'latitude' : 'baseLatitude';
    const lngCol = table === 'SafeHaven' ? 'longitude' : 'baseLongitude';
    const meters = radiusKm * 1000;

    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; distance_km: number }>>(
      `SELECT id,
              ROUND((extensions.ST_Distance(
                extensions.ST_SetSRID(extensions.ST_MakePoint("${lngCol}", "${latCol}"), 4326)::extensions.geography,
                extensions.ST_SetSRID(extensions.ST_MakePoint($1, $2), 4326)::extensions.geography
              ) / 1000.0)::numeric, 2)::float AS distance_km
       FROM "${table}"
       WHERE extensions.ST_DWithin(
         extensions.ST_SetSRID(extensions.ST_MakePoint("${lngCol}", "${latCol}"), 4326)::extensions.geography,
         extensions.ST_SetSRID(extensions.ST_MakePoint($1, $2), 4326)::extensions.geography,
         $3
       )`,
      lng,
      lat,
      meters,
    );

    return new Map(rows.map((r) => [r.id, r.distance_km]));
  }

  computeDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    return haversineDistanceKm(lat1, lng1, lat2, lng2);
  }
}
