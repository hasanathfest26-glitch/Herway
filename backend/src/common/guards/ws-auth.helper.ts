import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { getJwtSecret } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WsAuthHelper {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async authenticateSocket(client: Socket): Promise<{ userId: string; fullName: string } | null> {
    const rawToken =
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.headers?.authorization?.replace('Bearer ', '') as string | undefined);

    if (!rawToken) return null;

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string; sid?: string }>(rawToken, {
        secret: getJwtSecret(),
      });

      let user: { id: string; fullName: string } | null = null;

      if (payload.sid) {
        const session = await this.prisma.userSession.findUnique({
          where: { id: payload.sid },
          select: {
            revokedAt: true,
            expiresAt: true,
            user: { select: { id: true, fullName: true, status: true, deletedAt: true } },
          },
        });
        if (
          !session ||
          session.revokedAt ||
          session.expiresAt <= new Date() ||
          session.user.status !== 'ACTIVE' ||
          session.user.deletedAt
        ) {
          return null;
        }
        user = { id: session.user.id, fullName: session.user.fullName };
      } else {
        user = await this.prisma.user.findFirst({
          where: { OR: [{ id: payload.sub }, { supabaseAuthId: payload.sub }], status: 'ACTIVE', deletedAt: null },
          select: { id: true, fullName: true },
        });
      }

      if (!user) return null;
      client.data.userId = user.id;
      client.data.fullName = user.fullName;
      await client.join(`user:${user.id}`);
      return { userId: user.id, fullName: user.fullName };
    } catch {
      return null;
    }
  }
}
