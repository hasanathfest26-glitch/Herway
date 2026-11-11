import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Observable, tap } from 'rxjs';
import {
  ObservabilityService,
  runWithRequestContext,
} from './observability.service';

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  constructor(private readonly observability: ObservabilityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const res = http.getResponse<{
      statusCode: number;
      setHeader: (name: string, value: string) => void;
    }>();

    const headerReqId = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(headerReqId) ? headerReqId[0] : headerReqId)?.trim() ||
      crypto.randomUUID();

    const startedAt = process.hrtime.bigint();
    res.setHeader('X-Request-Id', requestId);

    return runWithRequestContext(requestId, () =>
      next.handle().pipe(
        tap({
          next: () => {
            const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            res.setHeader('X-Response-Time-Ms', elapsedMs.toFixed(1));
            this.observability.recordApiLatency(
              req.method,
              req.originalUrl || req.url || '',
              res.statusCode || 200,
              elapsedMs,
            );
          },
          error: (err: { status?: number }) => {
            const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
            const status = err?.status || res.statusCode || 500;
            res.setHeader('X-Response-Time-Ms', elapsedMs.toFixed(1));
            this.observability.recordApiLatency(
              req.method,
              req.originalUrl || req.url || '',
              status,
              elapsedMs,
            );
          },
        }),
      ),
    );
  }
}
