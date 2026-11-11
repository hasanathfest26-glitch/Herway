import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateTrustedContactDto {
  @IsString()
  name: string;

  @IsString()
  relationship: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  canReceiveTripUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveCheckIns?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveSos?: boolean;
}

export class UpdateTrustedContactDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  canReceiveTripUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewLocation?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveCheckIns?: boolean;

  @IsOptional()
  @IsBoolean()
  canReceiveSos?: boolean;
}
