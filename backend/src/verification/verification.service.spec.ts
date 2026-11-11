import { UserRole, VerificationStatus } from '@prisma/client';
import { VerificationService } from './verification.service';

describe('VerificationService', () => {
  it('auto-approves Travel Buddy role in demo mode without requiring 18+ or selfie upload', async () => {
    const updateUser = jest.fn().mockResolvedValue({});
    const mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          homeCity: 'Kochi',
          languages: ['English', 'Malayalam'],
          roles: [UserRole.TRAVELLER],
          approxLatitude: 9.96,
          approxLongitude: 76.24,
        }),
        update: updateUser,
      },
      verificationApplication: {
        create: jest.fn().mockResolvedValue({
          id: 'app-1',
          role: UserRole.TRAVEL_BUDDY,
          status: VerificationStatus.APPROVED,
        }),
      },
      travelBuddyProfile: { upsert: jest.fn().mockResolvedValue({}) },
    } as any;

    const mockStorage = { storePrivateEncryptedFile: jest.fn() } as any;
    const service = new VerificationService(mockPrisma, mockStorage, { send: jest.fn() } as any);

    const res = await service.apply('u1', { role: UserRole.TRAVEL_BUDDY });
    expect(res.status).toBe(VerificationStatus.APPROVED);
    const grantedRoles = updateUser.mock.calls[0][0].data.roles as UserRole[];
    expect(grantedRoles).toContain(UserRole.TRAVEL_BUDDY);
  });
});
