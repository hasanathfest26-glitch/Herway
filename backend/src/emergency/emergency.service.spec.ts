import { SosStatus } from '@prisma/client';
import { EmergencyService } from './emergency.service';

describe('EmergencyService', () => {
  it('alerts SOS trusted contacts and returns 112 emergency numbers', async () => {
    const mockPrisma = {
      trustedContact: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', name: 'Radha Menon', phone: '+919847011223', canReceiveSos: true },
        ]),
      },
      sosIncident: {
        create: jest.fn().mockResolvedValue({ id: 'inc-1', status: SosStatus.ACTIVE }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'inc-1',
          status: SosStatus.ACTIVE,
          deliveries: [{ id: 'd1', recipientType: 'TRUSTED_CONTACT', deliveryStatus: 'DELIVERED' }],
        }),
      },
      sosAlertDelivery: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;

    const mockNotifications = { send: jest.fn().mockResolvedValue({}) } as any;
    const service = new EmergencyService(mockPrisma, mockNotifications);

    const incident = await service.triggerSos('user-1', {
      latitude: 9.9658,
      longitude: 76.2421,
    });

    expect(incident?.status).toBe(SosStatus.ACTIVE);
    expect(mockPrisma.sosAlertDelivery.createMany).toHaveBeenCalledTimes(1);
    const numbers = service.getEmergencyNumbers('Kerala, India');
    expect(numbers.some((n) => n.code === '112')).toBe(true);
  });
});
