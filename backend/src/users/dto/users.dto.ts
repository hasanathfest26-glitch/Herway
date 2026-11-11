import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DocumentType, ReportStatus, SafetyActionType, UserRole } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsArray()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  homeCity?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['FEMALE', 'MALE', 'OTHER'])
  gender?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredDestinations?: string[];

  @IsOptional()
  travelPreferencesJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  discoverableAsTraveller?: boolean;

  @IsOptional()
  @IsNumber()
  approxLatitude?: number;

  @IsOptional()
  @IsNumber()
  approxLongitude?: number;
}

export class SafetyActionDto {
  @IsString()
  targetUserId: string;

  @IsEnum(SafetyActionType)
  actionType: SafetyActionType;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class ResolveReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class CreateDocumentDto {
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  storagePath?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  fileSizeBytes?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdatePlatformSettingDto {
  @IsString()
  key: string;

  valueJson: Record<string, unknown>;

  @IsOptional()
  @IsString()
  description?: string;
}
