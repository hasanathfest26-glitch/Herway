import { Global, Module } from '@nestjs/common';
import { WsAuthHelper } from '../guards/ws-auth.helper';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { HealthController } from '../observability/health.controller';
import { ObservabilityService } from '../observability/observability.service';
import { BackgroundQueueService } from '../queue/background-queue.service';
import { PrismaService } from './prisma.service';
import { SpatialService } from './spatial.service';

@Global()
@Module({
  controllers: [HealthController],
  providers: [
    ObservabilityService,
    PrismaService,
    SpatialService,
    WsAuthHelper,
    IdempotencyService,
    BackgroundQueueService,
  ],
  exports: [
    ObservabilityService,
    PrismaService,
    SpatialService,
    WsAuthHelper,
    IdempotencyService,
    BackgroundQueueService,
  ],
})
export class PrismaModule {}
