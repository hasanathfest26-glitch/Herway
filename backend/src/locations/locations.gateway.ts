import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Optional } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthHelper } from '../common/guards/ws-auth.helper';
import { RealtimeService } from '../realtime/realtime.service';
import { LocationsService } from './locations.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class LocationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly locationsService: LocationsService,
    private readonly wsAuth: WsAuthHelper,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime?.registerServer(server);
  }

  async handleConnection(client: Socket) {
    await this.wsAuth.authenticateSocket(client);
  }

  handleDisconnect() {
    // Tracked cleanly by BookingsGateway
  }

  @SubscribeMessage('location:watch')
  async handleWatch(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { shareToken: string },
  ) {
    await this.locationsService.getPublicShareByToken(payload.shareToken);
    await client.join(`track:${payload.shareToken}`);
    return { watching: payload.shareToken };
  }

  @SubscribeMessage('location:ping')
  async handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: { latitude: number; longitude: number; accuracyMeters?: number },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('Authentication required to publish location pings');

    const res = await this.locationsService.pingLocation(userId, {
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracyMeters: payload.accuracyMeters,
    });

    for (const token of res.updatedSessionTokens) {
      this.server.to(`track:${token}`).emit('location:update', {
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracyMeters: payload.accuracyMeters,
        lastUpdatedAt: res.lastUpdatedAt,
        isUpdating: true,
      });
    }

    return res;
  }
}
