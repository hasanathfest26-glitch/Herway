import { LocationShareStatus } from '@prisma/client';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  const baseSession = {
    id: 'share-1',
    userId: 'u1',
    shareToken: 'tok123',
    label: 'Kochi Ferry Ride',
    shareTripContext: true,
    expiresAt: new Date(Date.now() + 3600_000),
    lastLatitude: 9.9658,
    lastLongitude: 76.2421,
    lastAccuracyMeters: 12,
    lastUpdatedAt: new Date(),
    user: { fullName: 'Ananya Menon', homeCity: 'Kochi' },
    trip: { title: 'Kochi Trip', destinationCity: 'Kochi', status: 'ACTIVE' },
  };

  it('hides coordinates when sharing is PAUSED or REVOKED', async () => {
    const mockPrisma = {
      locationShareSession: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ ...baseSession, status: LocationShareStatus.PAUSED })
          .mockResolvedValueOnce({ ...baseSession, status: LocationShareStatus.REVOKED }),
      },
    } as any;
    const service = new LocationsService(mockPrisma, { send: jest.fn() } as any);

    const paused = await service.getPublicShareByToken('tok123');
    expect(paused.coordinatesVisible).toBe(false);
    expect(paused.isUpdating).toBe(false);

    const revoked = await service.getPublicShareByToken('tok123');
    expect(revoked.coordinatesVisible).toBe(false);
    expect(revoked.isUpdating).toBe(false);
  });

  it('marks stale locations as isUpdating=false so old coordinates are never shown as live', async () => {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60_000);
    const mockPrisma = {
      locationShareSession: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseSession,
          status: LocationShareStatus.ACTIVE,
          lastUpdatedAt: fiveMinsAgo,
        }),
      },
    } as any;
    const service = new LocationsService(mockPrisma, { send: jest.fn() } as any);

    const stale = await service.getPublicShareByToken('tok123');
    expect(stale.isUpdating).toBe(false);
    expect(stale.staleWarning).toContain('not currently updating');
  });

  it('marks link EXPIRED once expiresAt has passed', async () => {
    const mockPrisma = {
      locationShareSession: {
        findUnique: jest.fn().mockResolvedValue({
          ...baseSession,
          status: LocationShareStatus.ACTIVE,
          expiresAt: new Date(Date.now() - 10_000),
        }),
      },
    } as any;
    const service = new LocationsService(mockPrisma, { send: jest.fn() } as any);

    const expired = await service.getPublicShareByToken('tok123');
    expect(expired.status).toBe(LocationShareStatus.EXPIRED);
    expect(expired.coordinatesVisible).toBe(false);
  });
});
