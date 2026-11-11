import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { getJwtSecret } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';

interface CachedAuthIdentity {
  id: string;
  sessionId?: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  expiresAtMs: number;
}

const AUTH_CACHE_TTL_MS = 30_000;
const authCache = new Map<string, CachedAuthIdentity>();

export function invalidateAuthCacheForSession(sessionId?: string) {
  if (sessionId) authCache.delete(`sid:${sessionId}`);
}

export function invalidateAuthCacheForUser(userId: string) {
  for (const [key, entry] of authCache.entries()) {
    if (entry.id === userId) authCache.delete(key);
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.slice(7).trim();
    const secret = getJwtSecret();

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        sid?: string;
        email?: string;
      }>(token, { secret });

      const cacheKey = payload.sid ? `sid:${payload.sid}` : `sub:${payload.sub}`;
      const cached = authCache.get(cacheKey);
      if (cached && cached.expiresAtMs > Date.now()) {
        request.user = {
          id: cached.id,
          sessionId: cached.sessionId,
          email: cached.email,
          fullName: cached.fullName,
          roles: cached.roles,
        };
        return true;
      }

      let resolvedUser: {
        id: string;
        email: string;
        fullName: string;
        roles: UserRole[];
        status: string;
      } | null = null;

      if (payload.sid) {
        // Single combined query for session revocation + user lookup
        const session = await this.prisma.userSession.findUnique({
          where: { id: payload.sid },
          select: {
            revokedAt: true,
            expiresAt: true,
            user: {
              select: {
                id: true,
                email: true,
                fullName: true,
                roles: true,
                status: true,
                deletedAt: true,
              },
            },
          },
        });

        if (
          !session ||
          session.revokedAt ||
          session.expiresAt <= new Date() ||
          session.user.deletedAt
        ) {
          authCache.delete(cacheKey);
          throw new UnauthorizedException('Session has been revoked or expired');
        }
        resolvedUser = session.user;
      } else {
        resolvedUser = await this.prisma.user.findFirst({
          where: {
            OR: [{ id: payload.sub }, { supabaseAuthId: payload.sub }],
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            fullName: true,
            roles: true,
            status: true,
          },
        });
      }

      if (!resolvedUser || resolvedUser.status !== 'ACTIVE') {
        authCache.delete(cacheKey);
        throw new UnauthorizedException('Account not active or not found');
      }

      const identity: CachedAuthIdentity = {
        id: resolvedUser.id,
        sessionId: payload.sid,
        email: resolvedUser.email,
        fullName: resolvedUser.fullName,
        roles: resolvedUser.roles,
        expiresAtMs: Date.now() + AUTH_CACHE_TTL_MS,
      };

      if (authCache.size > 1000) {
        authCache.clear();
      }
      authCache.set(cacheKey, identity);

      request.user = {
        id: identity.id,
        sessionId: identity.sessionId,
        email: identity.email,
        fullName: identity.fullName,
        roles: identity.roles,
      };
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
