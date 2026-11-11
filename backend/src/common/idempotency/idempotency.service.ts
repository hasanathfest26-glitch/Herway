import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ObservabilityService } from '../observability/observability.service';
import { PrismaService } from '../prisma/prisma.service';

interface CacheEntry {
  response: unknown;
  expiresAtMs: number;
}

@Injectable()
export class IdempotencyService {
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly defaultTtlMs = 24 * 3600_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: ObservabilityService,
  ) {}

  async execute<T>(params: {
    userId: string;
    scope: string;
    idempotencyKey?: string | null;
    payload?: unknown;
    ttlMs?: number;
    fn: () => Promise<T>;
  }): Promise<T> {
    const cleanKey = params.idempotencyKey?.trim().slice(0, 128);
    if (!cleanKey) {
      return params.fn();
    }

    const compositeKey = `${params.userId}:${params.scope}:${cleanKey}`;
    const existingFlight = this.inFlight.get(compositeKey);
    if (existingFlight) {
      this.observability.recordDuplicateReplay();
      return (await existingFlight) as T;
    }

    const cachedMem = this.memoryCache.get(compositeKey);
    if (cachedMem && cachedMem.expiresAtMs > Date.now()) {
      this.observability.recordDuplicateReplay();
      return cachedMem.response as T;
    }

    const runPromise = (async () => {
      const existingDb = await this.prisma.idempotencyRecord.findUnique({
        where: {
          userId_scope_key: {
            userId: params.userId,
            scope: params.scope,
            key: cleanKey,
          },
        },
        select: { responseJson: true, expiresAt: true },
      });

      if (existingDb && existingDb.expiresAt.getTime() > Date.now()) {
        this.observability.recordDuplicateReplay();
        this.setMemoryCache(compositeKey, existingDb.responseJson, 5 * 60_000);
        return existingDb.responseJson as T;
      }

      const result = await params.fn();
      const ttl = params.ttlMs ?? this.defaultTtlMs;
      const expiresAt = new Date(Date.now() + ttl);
      const requestHash = params.payload
        ? crypto.createHash('sha256').update(JSON.stringify(params.payload)).digest('hex')
        : null;

      this.setMemoryCache(compositeKey, result, Math.min(ttl, 5 * 60_000));

      // Persist asynchronously after the durable business DB commit so first-click response returns immediately
      void this.prisma.idempotencyRecord
        .upsert({
          where: {
            userId_scope_key: {
              userId: params.userId,
              scope: params.scope,
              key: cleanKey,
            },
          },
          update: {
            requestHash,
            responseJson: result as object,
            expiresAt,
          },
          create: {
            userId: params.userId,
            scope: params.scope,
            key: cleanKey,
            requestHash,
            statusCode: 200,
            responseJson: result as object,
            expiresAt,
          },
        })
        .catch(() => {
          // Non-fatal if concurrent replay already persisted it
        });

      return result;
    })();

    this.inFlight.set(compositeKey, runPromise);
    try {
      return await runPromise;
    } finally {
      this.inFlight.delete(compositeKey);
    }
  }

  private setMemoryCache(key: string, response: unknown, ttlMs: number): void {
    if (this.memoryCache.size > 1500) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest) this.memoryCache.delete(oldest);
    }
    this.memoryCache.set(key, {
      response,
      expiresAtMs: Date.now() + ttlMs,
    });
  }
}
