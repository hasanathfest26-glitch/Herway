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
import { BookingsService } from './bookings.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class BookingsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly bookingsService: BookingsService,
    private readonly wsAuth: WsAuthHelper,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime?.registerServer(server);
  }

  async handleConnection(client: Socket) {
    this.realtime?.trackSocketConnect();
    await this.wsAuth.authenticateSocket(client);
  }

  handleDisconnect() {
    this.realtime?.trackSocketDisconnect();
  }

  @SubscribeMessage('booking:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookingId: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('Unauthorized');
    await this.bookingsService.assertParticipant(userId, payload.bookingId);
    await client.join(`booking:${payload.bookingId}`);
    return { joined: payload.bookingId };
  }

  @SubscribeMessage('booking:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { bookingId: string; body: string; clientMessageId?: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) throw new WsException('Unauthorized');
    return this.bookingsService.sendMessage(userId, payload.bookingId, {
      body: payload.body,
      clientMessageId: payload.clientMessageId,
    });
  }
}
