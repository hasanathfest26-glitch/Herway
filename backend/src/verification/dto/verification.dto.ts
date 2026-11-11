import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRole, VerificationStatus } from '@prisma/client';

export class SubmitVerificationDto {
  @IsEnum(UserRole)
  role: UserRole;

  @IsOptional()
  @IsString()
  liveSelfiePath?: string;

  @IsOptional()
  @IsString()
  idDocumentPath?: string;

  @IsOptional()
  selfie?: unknown;

  @IsOptional()
  idDocument?: unknown;

  @IsOptional()
  @IsString()
  licenceReference?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  confirmAge18Plus?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReviewVerificationDto {
  @IsEnum(VerificationStatus)
  status: VerificationStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
