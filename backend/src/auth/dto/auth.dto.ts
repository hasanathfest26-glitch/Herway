import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  fullName: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  homeCity?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  requestedRoles?: UserRole[];

  @IsOptional()
  @IsBoolean()
  consentAccepted?: boolean;
}

export class LoginDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  code: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email: string;
}

export class RequestPhoneOtpDto {
  @IsString()
  phone: string;
}

export class VerifyPhoneOtpDto {
  @IsString()
  phone: string;

  @IsString()
  otp: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class SupabaseExchangeDto {
  @IsString()
  supabaseAccessToken: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;
}
