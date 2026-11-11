import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, Logger } from '@nestjs/common';

interface RequestContextStore {
  requestId: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(requestId: string, fn: () => T): T {
  return requestContextStorage.run({ requestId }, fn);
}

export function getCurrentRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly apiLatenciesMs: number[] = [];
  private readonly dbQueryLatenciesMs: number[] = [];
  private readonly maxSamples = 500;

  private totalRequests = 0;
  private failedRequests = 0;
  private duplicateMutationReplays = 0;
  private slowDbQueries = 0;
  private activeSockets = 0;

  recordApiLatency(method: string, path: string, statusCode: number, durationMs: number): void {
    this.totalRequests += 1;
    if (statusCode >= 500) {
      this.failedRequests += 1;
    }
    this.pushSample(this.apiLatenciesMs, durationMs);
    if (durationMs >= 750) {
      const reqId = getCurrentRequestId();
      this.logger.warn(
        `Slow API ${method} ${path} status=${statusCode} duration=${durationMs.toFixed(1)}ms reqId=${reqId ?? '-'}`,
      );
    }
  }

  recordDbQuery(durationMs: number, queryHint?: string): void {
    this.pushSample(this.dbQueryLatenciesMs, durationMs);
    if (durationMs >= 250) {
      this.slowDbQueries += 1;
      const reqId = getCurrentRequestId();
      this.logger.warn(
        `Slow DB query (${durationMs.toFixed(1)}ms) reqId=${reqId ?? '-'} ${queryHint ? queryHint.slice(0, 120) : ''}`,
      );
    }
  }

  recordDuplicateReplay(): void {
    this.duplicateMutationReplays += 1;
  }

  adjustActiveSockets(delta: number): void {
    this.activeSockets = Math.max(0, this.activeSockets + delta);
  }

  getMetricsSnapshot() {
    return {
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      failedRatePercent:
        this.totalRequests > 0
          ? Number(((this.failedRequests / this.totalRequests) * 100).toFixed(2))
          : 0,
      duplicateMutationReplays: this.duplicateMutationReplays,
      slowDbQueries: this.slowDbQueries,
      activeRealtimeSockets: this.activeSockets,
      apiLatencyMs: this.computePercentiles(this.apiLatenciesMs),
      dbQueryLatencyMs: this.computePercentiles(this.dbQueryLatenciesMs),
    };
  }

  private pushSample(arr: number[], value: number): void {
    arr.push(Number(value.toFixed(2)));
    if (arr.length > this.maxSamples) {
      arr.shift();
    }
  }

  private computePercentiles(samples: number[]) {
    if (samples.length === 0) {
      return { count: 0, p50: 0, p95: 0, p99: 0, max: 0 };
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const pick = (pct: number) =>
      sorted[Math.min(sorted.length - 1, Math.floor((pct / 100) * sorted.length))];
    return {
      count: sorted.length,
      p50: pick(50),
      p95: pick(95),
      p99: pick(99),
      max: sorted[sorted.length - 1],
    };
  }
}
