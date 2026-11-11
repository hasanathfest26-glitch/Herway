import { BookingStatus } from '@prisma/client';
import { IdempotencyService } from '../common/idempotency/idempotency.service';
import { ObservabilityService } from '../common/observability/observability.service';
import { BookingsService } from './bookings.service';

describe('BookingsService & IdempotencyService', () => {
  it('deduplicates concurrent double-click mutations with same idempotencyKey', async () => {
    const obs = new ObservabilityService();
    const stored = new Map<string, { responseJson: unknown; expiresAt: Date }>();
    const mockPrisma = {
      idempotencyRecord: {
        findUnique: jest.fn(async ({ where }) => {
          const k = `${where.userId_scope_key.userId}:${where.userId_scope_key.scope}:${where.userId_scope_key.key}`;
          return stored.get(k) ?? null;
        }),
        upsert: jest.fn(async ({ where, create }) => {
          const k = `${where.userId_scope_key.userId}:${where.userId_scope_key.scope}:${where.userId_scope_key.key}`;
          stored.set(k, { responseJson: create.responseJson, expiresAt: create.expiresAt });
          return create;
        }),
      },
    } as any;

    const idempotency = new IdempotencyService(mockPrisma, obs);
    const createFn = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { id: 'book-1', status: BookingStatus.REQUESTED };
    });

    const [first, second] = await Promise.all([
      idempotency.execute({
        userId: 'u1',
        scope: 'bookings:create',
        idempotencyKey: 'idem-abc',
        payload: { buddyId: 'b1' },
        fn: createFn,
      }),
      idempotency.execute({
        userId: 'u1',
        scope: 'bookings:create',
        idempotencyKey: 'idem-abc',
        payload: { buddyId: 'b1' },
        fn: createFn,
      }),
    ]);

    expect(createFn).toHaveBeenCalledTimes(1);
    expect(first.id).toBe('book-1');
    expect(second.id).toBe('book-1');

    // Legitimate replay with same key hits cache and still returns original booking
    const replay = await idempotency.execute({
      userId: 'u1',
      scope: 'bookings:create',
      idempotencyKey: 'idem-abc',
      payload: { buddyId: 'b1' },
      fn: createFn,
    });
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(replay.id).toBe('book-1');
    expect(obs.getMetricsSnapshot().duplicateMutationReplays).toBeGreaterThanOrEqual(2);
  });

  it('deduplicates repeated chat message retry via clientMessageId while allowing distinct messages', async () => {
    const messages: Array<{ id: string; clientMessageId?: string; body: string }> = [];
    const mockPrisma = {
      buddyBooking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'book-1',
          travellerId: 'u1',
          buddyId: 'b1',
        }),
      },
      bookingMessage: {
        findFirst: jest.fn(async ({ where }) => {
          return (
            messages.find(
              (m) => m.clientMessageId && m.clientMessageId === where.clientMessageId,
            ) ?? null
          );
        }),
        create: jest.fn(async ({ data }) => {
          const row = {
            id: `msg-${messages.length + 1}`,
            bookingId: data.bookingId,
            senderId: data.senderId,
            clientMessageId: data.clientMessageId,
            body: data.body,
            maskedPhoneNotice: false,
            sender: { id: data.senderId, fullName: 'Traveller' },
          };
          messages.push(row);
          return row;
        }),
      },
    } as any;

    const mockNotifications = { enqueue: jest.fn(), send: jest.fn() } as any;
    const service = new BookingsService(mockPrisma, mockNotifications);

    const m1 = await service.sendMessage('u1', 'book-1', {
      body: 'At main gate',
      clientMessageId: 'cid-1',
    });
    const m1Retry = await service.sendMessage('u1', 'book-1', {
      body: 'At main gate',
      clientMessageId: 'cid-1',
    });
    const m2 = await service.sendMessage('u1', 'book-1', {
      body: 'At main gate',
      clientMessageId: 'cid-2',
    });

    expect(m1.id).toBe('msg-1');
    expect(m1Retry.id).toBe('msg-1');
    expect(m2.id).toBe('msg-2');
    expect(messages).toHaveLength(2);
  });

  it('returns paginated booking slices and status counts when paginated=true', async () => {
    const sampleItems = [
      { id: 'b-1', status: BookingStatus.REQUESTED },
      { id: 'b-2', status: BookingStatus.CONFIRMED },
    ];
    const mockPrisma = {
      buddyBooking: {
        findMany: jest.fn().mockResolvedValue(sampleItems),
        count: jest
          .fn()
          .mockResolvedValueOnce(25) // total filtered
          .mockResolvedValueOnce(25) // allCount
          .mockResolvedValueOnce(10) // incomingCount
          .mockResolvedValueOnce(12) // requestsCount
          .mockResolvedValueOnce(8) // confirmedCount
          .mockResolvedValueOnce(5), // historyCount
      },
    } as any;

    const service = new BookingsService(mockPrisma, { enqueue: jest.fn(), send: jest.fn() } as any);
    const res = await service.listForUserFiltered('u-buddy', {
      paginated: true,
      limit: '2',
      skip: '0',
    });

    expect((res as any).items).toHaveLength(2);
    expect((res as any).total).toBe(25);
    expect((res as any).hasMore).toBe(true);
    expect((res as any).meta.counts.incomingRequests).toBe(10);
  });

  it('resets the other participant confirmation when public meeting spot is changed', async () => {
    const updateFn = jest.fn(async ({ data }) => ({
      id: 'book-2',
      ...data,
      traveller: { fullName: 'Ananya' },
      buddy: { fullName: 'Muhammed' },
    }));
    const mockPrisma = {
      buddyBooking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'book-2',
          travellerId: 'u-trav',
          buddyId: 'u-buddy',
          status: BookingStatus.CONFIRMED,
          travellerConfirmed: true,
          buddyConfirmed: true,
          meetingPointName: 'Alappuzha Public Transit / Plaza',
          meetingPointAddress: 'Main Junction',
          meetingPointLat: null,
          meetingPointLng: null,
        }),
        update: updateFn,
      },
    } as any;

    const notifications = { enqueue: jest.fn(), send: jest.fn() } as any;
    const service = new BookingsService(mockPrisma, notifications);

    const updated = await service.confirm('u-trav', 'book-2', {
      meetingPointName: 'Alappuzha Railway Station Entrance',
      meetingPointAddress: 'Station Rd',
      isPublicMeetingPoint: true,
    });

    expect(updated.status).toBe(BookingStatus.ACCEPTED);
    expect(updated.travellerConfirmed).toBe(true);
    expect(updated.buddyConfirmed).toBe(false);
    expect(updated.meetingPointName).toBe('Alappuzha Railway Station Entrance');
  });
});
