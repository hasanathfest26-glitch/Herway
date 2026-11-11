import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ReportStatus, SafeHavenApprovalStatus, SafeHavenCategory } from '@prisma/client';

export class RegisterSafeHavenDto {
  @IsString()
  name: string;

  @IsEnum(SafeHavenCategory)
  category: SafeHavenCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  responsiblePersonName?: string;

  @IsOptional()
  @IsString()
  responsiblePersonPhone?: string;

  operatingHoursJson: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  assistanceServices: string[];

  @IsOptional()
  @IsString()
  assistanceCommitments?: string;

  @IsString()
  licenceNumber: string;

  @IsOptional()
  verificationDocumentsJson?: Record<string, unknown>;

  @IsOptional()
  partnershipAgreementJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  agreementAccepted?: boolean;
}

export class UpdatePartnerSafeHavenDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  responsiblePersonName?: string;

  @IsOptional()
  @IsString()
  responsiblePersonPhone?: string;

  @IsOptional()
  operatingHoursJson?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assistanceServices?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ApproveSafeHavenDto {
  @IsEnum(SafeHavenApprovalStatus)
  approvalStatus: SafeHavenApprovalStatus;

  @IsOptional()
  @IsString()
  approvalNotes?: string;
}

export class ReportSafeHavenDto {
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class ResolveSafeHavenReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
