import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { ObservabilityService } from '../common/observability/observability.service';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  constructor(private readonly observability: ObservabilityService) {}

  registerServer(server: Server): void {
    this.server = server;
  }

  trackSocketConnect(): void {
    this.observability.adjustActiveSockets(1);
  }

  trackSocketDisconnect(): void {
    this.observability.adjustActiveSockets(-1);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    try {
      this.server.to(`user:${userId}`).emit(event, payload);
    } catch (err) {
      this.logger.warn(`Realtime emitToUser error: ${(err as Error).message}`);
    }
  }

  emitToBooking(bookingId: string, event: string, payload: unknown): void {
    if (!this.server) return;
    try {
      this.server.to(`booking:${bookingId}`).emit(event, payload);
    } catch (err) {
      this.logger.warn(`Realtime emitToBooking error: ${(err as Error).message}`);
    }
  }

  emitToTrack(shareToken: string, event: string, payload: unknown): void {
    if (!this.server) return;
    try {
      this.server.to(`track:${shareToken}`).emit(event, payload);
    } catch (err) {
      this.logger.warn(`Realtime emitToTrack error: ${(err as Error).message}`);
    }
  }
}
