import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LocationShareStatus } from '@prisma/client';

export class CreateLocationShareDto {
  @IsOptional()
  @IsString()
  tripId?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  shareTripContext?: boolean;

  @IsInt()
  @Min(15)
  @Max(1440)
  durationMinutes: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedContactIds?: string[];

  @IsOptional()
  @IsNumber()
  initialLatitude?: number;

  @IsOptional()
  @IsNumber()
  initialLongitude?: number;
}

export class PingLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;
}

export class UpdateShareStateDto {
  @IsEnum(LocationShareStatus)
  status: LocationShareStatus;
}
