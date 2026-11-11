import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ObservabilityService } from './observability.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly observability: ObservabilityService,
  ) {}

  @Get()
  async health() {
    const start = process.hrtime.bigint();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbRttMs = Number((Number(process.hrtime.bigint() - start) / 1_000_000).toFixed(2));
    return {
      status: 'ok',
      dbRttMs,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('metrics')
  metrics() {
    return {
      ...this.observability.getMetricsSnapshot(),
      timestamp: new Date().toISOString(),
    };
  }
}
