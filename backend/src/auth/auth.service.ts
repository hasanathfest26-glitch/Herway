import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenType, UserRole } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { getJwtSecret } from '../common/config/env.validation';
import {
  invalidateAuthCacheForSession,
  invalidateAuthCacheForUser,
} from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  encryptSensitiveValue,
  generateOpaqueShareToken,
  sha256Hash,
} from '../common/utils/crypto.util';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestPhoneOtpDto,
  ResetPasswordDto,
  SupabaseExchangeDto,
  VerifyEmailDto,
  VerifyPhoneOtpDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private getSupabaseClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key || url.includes('your-project')) {
      return null;
    }
    return createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  async register(dto: RegisterDto, ipAddress?: string) {
    if (dto.consentAccepted === false) {
      throw new BadRequestException(
        'Privacy policy and safety terms consent is required to register',
      );
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const encryptedPhone = dto.phone ? encryptSensitiveValue(dto.phone) : null;

    const initialRoles: UserRole[] = [UserRole.TRAVELLER];
    if (dto.requestedRoles?.includes(UserRole.SAFE_HAVEN_PARTNER)) {
      initialRoles.push(UserRole.SAFE_HAVEN_PARTNER);
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName: dto.fullName.trim(),
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
        homeCity: dto.homeCity ?? 'Kochi',
        phoneEncrypted: encryptedPhone
          ? `${encryptedPhone.iv}:${encryptedPhone.cipherText}`
          : null,
        roles: initialRoles,
        consentAcceptedAt: new Date(),
        notificationPreferences: { create: {} },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        homeCity: true,
        roles: true,
        languages: true,
        interests: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    await this.issueVerificationToken(user.id, AuthTokenType.EMAIL_VERIFY, email);
    const session = await this.createSessionTokens(user.id, user.email, 'registration', ipAddress);

    return {
      ...session,
      user,
      verificationNotice:
        dto.requestedRoles?.some((r) => r === UserRole.TRAVEL_BUDDY)
          ? 'Please verify your email and submit your live selfie & ID verification to activate your Travel Buddy role.'
          : 'Please check your email for your verification code.',
    };
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.passwordHash || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is suspended or deactivated');
    }

    const tokens = await this.createSessionTokens(user.id, user.email, dto.deviceInfo, ipAddress);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        homeCity: user.homeCity,
        roles: user.roles,
        languages: user.languages,
        interests: user.interests,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async exchangeSupabaseToken(dto: SupabaseExchangeDto, ipAddress?: string) {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !anonKey || url.includes('your-project')) {
      throw new BadRequestException('Supabase Auth is not configured on this server');
    }

    const supabase = createClient(url, anonKey);
    const { data, error } = await supabase.auth.getUser(dto.supabaseAccessToken);
    if (error || !data.user || !data.user.email) {
      throw new UnauthorizedException('Invalid Supabase access token');
    }

    const email = data.user.email.toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ supabaseAuthId: data.user.id }, { email }] },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          supabaseAuthId: data.user.id,
          email,
          fullName: (data.user.user_metadata?.full_name as string) || email.split('@')[0],
          emailVerifiedAt: data.user.email_confirmed_at ? new Date() : null,
          consentAcceptedAt: new Date(),
          roles: [UserRole.TRAVELLER],
          notificationPreferences: { create: {} },
        },
      });
    } else if (!user.supabaseAuthId || (data.user.email_confirmed_at && !user.emailVerifiedAt)) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          ...(!user.supabaseAuthId ? { supabaseAuthId: data.user.id } : {}),
          ...(data.user.email_confirmed_at && !user.emailVerifiedAt
            ? { emailVerifiedAt: new Date() }
            : {}),
        },
      });
    }

    if (user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('Account is not active');
    }

    const tokens = await this.createSessionTokens(user.id, user.email, dto.deviceInfo, ipAddress);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        homeCity: user.homeCity,
        roles: user.roles,
        languages: user.languages,
        interests: user.interests,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  async refreshSession(dto: RefreshTokenDto) {
    const [sessionId, rawSecret] = dto.refreshToken.split('.');
    if (!sessionId || !rawSecret) {
      throw new UnauthorizedException('Malformed refresh token');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh session expired or revoked');
    }

    const incomingHash = sha256Hash(rawSecret);
    if (incomingHash !== session.refreshTokenHash) {
      // Token reuse detected -> revoke entire session immediately
      await this.prisma.userSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token invalid; session revoked');
    }

    const nextSecret = generateOpaqueShareToken(32);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: sha256Hash(nextSecret),
        expiresAt: new Date(Date.now() + 30 * 86400_000),
      },
    });

    const accessToken = await this.signAccessToken(session.userId, session.user.email, session.id);
    return {
      accessToken,
      refreshToken: `${session.id}.${nextSecret}`,
    };
  }

  async logout(userId: string, sessionId?: string) {
    invalidateAuthCacheForSession(sessionId);
    if (sessionId) {
      await this.prisma.userSession.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { loggedOut: true };
  }

  async logoutAll(userId: string) {
    invalidateAuthCacheForUser(userId);
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revokedAllSessions: true };
  }

  async listSessions(userId: string) {
    return this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, expiresAt: true },
    });
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.toLowerCase().trim();
    const code = dto.code.trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('Invalid verification code');

    const record = await this.prisma.authVerificationToken.findFirst({
      where: {
        userId: user.id,
        type: AuthTokenType.EMAIL_VERIFY,
        tokenHash: sha256Hash(code),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (record) {
      await this.prisma.$transaction([
        this.prisma.authVerificationToken.update({
          where: { id: record.id },
          data: { usedAt: new Date() },
        }),
        this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        }),
      ]);
      return { emailVerified: true };
    }

    const supabase = this.getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      });
      if (!error && data.user) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: new Date(),
            ...(!user.supabaseAuthId ? { supabaseAuthId: data.user.id } : {}),
          },
        });
        return { emailVerified: true };
      }
      if (error) {
        throw new BadRequestException(error.message || 'Verification code invalid or expired');
      }
    }

    throw new BadRequestException('Verification code invalid or expired');
  }

  async resendVerification(email: string) {
    const cleanEmail = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: cleanEmail } });
    if (user && !user.emailVerifiedAt) {
      await this.issueVerificationToken(user.id, AuthTokenType.EMAIL_VERIFY, user.email, true);
    }
    return { sent: true };
  }

  async requestPhoneOtp(userId: string, dto: RequestPhoneOtpDto) {
    const phone = dto.phone.trim();
    if (phone.length < 8) {
      throw new BadRequestException('Please enter a valid phone number with country code (e.g. +919876543210).');
    }

    const supabase = this.getSupabaseClient();
    if (!supabase) {
      throw new BadRequestException('Supabase is not configured on this server.');
    }

    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) {
      throw new BadRequestException(
        error.message.toLowerCase().includes('unsupported phone provider') ||
          error.message.toLowerCase().includes('not enabled')
          ? 'SMS OTP is not enabled yet. Enable Phone / Twilio in Supabase Dashboard -> Authentication -> Providers, or verify via Email.'
          : error.message,
      );
    }

    const encryptedPhone = encryptSensitiveValue(phone);
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneEncrypted: `${encryptedPhone.iv}:${encryptedPhone.cipherText}` },
    });
    return { sent: true };
  }

  async verifyPhoneOtp(userId: string, dto: VerifyPhoneOtpDto) {
    const phone = dto.phone.trim();
    const otp = dto.otp.trim();
    if (!phone || !otp) {
      throw new BadRequestException('Phone number and verification code are required.');
    }

    const supabase = this.getSupabaseClient();
    if (!supabase) {
      throw new BadRequestException('Supabase is not configured on this server.');
    }

    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });
    if (error) {
      throw new BadRequestException(error.message || 'Invalid or expired phone OTP');
    }

    const encryptedPhone = encryptSensitiveValue(phone);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phoneEncrypted: `${encryptedPhone.iv}:${encryptedPhone.cipherText}`,
        phoneVerifiedAt: new Date(),
      },
    });
    return { phoneVerified: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (user) {
      await this.issueVerificationToken(user.id, AuthTokenType.PASSWORD_RESET, user.email);
    }
    // Always return identical success message to prevent email enumeration
    return {
      message: 'If an account matches that email, password recovery instructions have been issued.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user) throw new BadRequestException('Invalid or expired reset token');

    const record = await this.prisma.authVerificationToken.findFirst({
      where: {
        userId: user.id,
        type: AuthTokenType.PASSWORD_RESET,
        tokenHash: sha256Hash(dto.token.trim()),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!record) throw new BadRequestException('Invalid or expired reset token');

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.authVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // Revoke all active sessions on password reset
      this.prisma.userSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { passwordReset: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) {
      throw new NotFoundException('User not found');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('Password login is not enabled on this account.');
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new BadRequestException('Current password is incorrect.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { passwordChanged: true };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        dateOfBirth: true,
        gender: true,
        bio: true,
        avatarUrl: true,
        homeCity: true,
        preferredDestinations: true,
        travelPreferencesJson: true,
        languages: true,
        interests: true,
        roles: true,
        status: true,
        emailVerifiedAt: true,
        phoneVerifiedAt: true,
        discoverableAsTraveller: true,
        buddyProfile: true,
      },
    });
  }

  private async issueVerificationToken(
    userId: string,
    type: AuthTokenType,
    target: string,
    throwOnDeliveryError = false,
  ) {
    const code =
      type === AuthTokenType.EMAIL_VERIFY
        ? String(crypto.randomInt(100000, 999999))
        : generateOpaqueShareToken(20);

    await this.prisma.authVerificationToken.create({
      data: {
        userId,
        type,
        target,
        tokenHash: sha256Hash(code),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });

    if (type === AuthTokenType.EMAIL_VERIFY) {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (resendApiKey) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Herway Safety <onboarding@resend.dev>',
            to: target,
            subject: `${code} is your Herway verification code`,
            html: `<p>Your Herway verification code is <strong>${code}</strong>. It expires in 30 minutes.</p>`,
          }),
        });
        if (!res.ok) {
          const msg = await res.text();
          this.logger.warn(`Resend email delivery failed for ${target}: ${msg}`);
          if (throwOnDeliveryError) {
            throw new BadRequestException('Failed to dispatch verification email via Resend.');
          }
        }
        return;
      }

      const supabase = this.getSupabaseClient();
      if (supabase) {
        const emailRedirectTo =
          process.env.MOBILE_VERIFY_REDIRECT_URL || 'http://localhost:8081/verify-account';
        const { error } = await supabase.auth.signInWithOtp({
          email: target,
          options: { shouldCreateUser: true, emailRedirectTo },
        });
        if (error) {
          this.logger.warn(`Supabase Auth OTP email failed for ${target}: ${error.message}`);
          if (throwOnDeliveryError) {
            throw new BadRequestException(error.message);
          }
        } else {
          this.logger.log(`Dispatched Supabase Email OTP to ${target}`);
        }
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`Auth token [${type}] issued for ${target}: ${code}`);
    }
  }

  private async createSessionTokens(
    userId: string,
    email: string,
    deviceInfo?: string,
    ipAddress?: string,
  ) {
    const rawSecret = generateOpaqueShareToken(32);
    const session = await this.prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash: sha256Hash(rawSecret),
        deviceInfo: deviceInfo ?? 'Herway Client',
        ipAddress,
        expiresAt: new Date(Date.now() + 30 * 86400_000),
      },
    });

    const accessToken = await this.signAccessToken(userId, email, session.id);
    return {
      accessToken,
      refreshToken: `${session.id}.${rawSecret}`,
      sessionId: session.id,
    };
  }

  private async signAccessToken(userId: string, email: string, sessionId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email, sid: sessionId },
      { secret: getJwtSecret(), expiresIn: '15m' },
    );
  }
}
