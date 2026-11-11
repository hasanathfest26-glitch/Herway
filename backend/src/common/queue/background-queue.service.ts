import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as net from 'node:net';
import { Queue, Worker } from 'bullmq';

export type BackgroundJobHandler = (data: Record<string, unknown>) => Promise<void>;

@Injectable()
export class BackgroundQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackgroundQueueService.name);
  private readonly handlers = new Map<string, BackgroundJobHandler>();
  private readonly fallbackTimers = new Set<NodeJS.Timeout>();
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redisAvailable = false;

  async onModuleInit(): Promise<void> {
    if (process.env.DISABLE_BULLMQ === 'true' || !process.env.REDIS_HOST) {
      return;
    }

    const host = process.env.REDIS_HOST || 'localhost';
    const port = Number(process.env.REDIS_PORT || 6379);

    this.redisAvailable = await this.probeRedisPort(host, port, 500);
    if (!this.redisAvailable) {
      this.logger.warn(
        `Redis unreachable at ${host}:${port}; running non-blocking in-process background fallback so API mutations never stall.`,
      );
      return;
    }

    const connection = {
      host,
      port,
      maxRetriesPerRequest: null as null,
      enableOfflineQueue: false,
      connectTimeout: 1500,
    };

    try {
      this.queue = new Queue('herway-background', { connection });
      this.worker = new Worker(
        'herway-background',
        async (job) => {
          const handler = this.handlers.get(job.name);
          if (handler) {
            await handler(job.data as Record<string, unknown>);
          }
        },
        { connection, concurrency: 8 },
      );
      this.worker.on('failed', (job, err) => {
        this.logger.warn(`Job ${job?.name}(${job?.id}) failed: ${err.message}`);
      });
    } catch (err) {
      this.redisAvailable = false;
      this.logger.warn(`BullMQ setup fallback: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const t of this.fallbackTimers) {
      clearTimeout(t);
    }
    this.fallbackTimers.clear();
    await this.worker?.close();
    await this.queue?.close();
  }

  registerHandler(jobName: string, handler: BackgroundJobHandler): void {
    this.handlers.set(jobName, handler);
  }

  isRedisBacked(): boolean {
    return this.redisAvailable && Boolean(this.queue);
  }

  async enqueue(
    jobName: string,
    data: Record<string, unknown>,
    options?: { jobId?: string; delayMs?: number },
  ): Promise<void> {
    const delayMs = Math.max(0, options?.delayMs ?? 0);

    if (this.redisAvailable && this.queue) {
      try {
        await this.queue.add(jobName, data, {
          jobId: options?.jobId,
          delay: delayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 500 },
          removeOnComplete: true,
          removeOnFail: 100,
        });
        return;
      } catch (err) {
        this.logger.warn(
          `Redis enqueue fallback for ${jobName}: ${(err as Error).message}`,
        );
      }
    }

    const runFallback = () => {
      const handler = this.handlers.get(jobName);
      if (!handler) return;
      void handler(data).catch((err) => {
        this.logger.warn(`In-process job ${jobName} failed: ${(err as Error).message}`);
      });
    };

    if (delayMs === 0) {
      setImmediate(runFallback);
    } else {
      const timer = setTimeout(() => {
        this.fallbackTimers.delete(timer);
        runFallback();
      }, delayMs);
      if (typeof timer.unref === 'function') timer.unref();
      this.fallbackTimers.add(timer);
    }
  }

  private probeRedisPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(ok);
      };
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => done(true));
      socket.once('timeout', () => done(false));
      socket.once('error', () => done(false));
    });
  }
}
