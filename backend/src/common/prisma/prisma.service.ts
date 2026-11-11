import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ObservabilityService } from '../observability/observability.service';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Optional() private readonly observability?: ObservabilityService) {
    super({
      log: [{ emit: 'event', level: 'query' }],
    });

    this.$on('query', (event) => {
      this.observability?.recordDbQuery(event.duration, event.query);
    });
  }

  async onModuleInit(): Promise<void> {
    if (process.env.SKIP_DB_CONNECT === 'true') return;
    try {
      await this.$connect();
    } catch (err) {
      console.warn('Prisma initial connection deferred:', (err as Error).message);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
