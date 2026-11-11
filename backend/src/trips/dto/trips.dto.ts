import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { TripStatus } from '@prisma/client';

export class TripStopDto {
  @IsString()
  title: string;

  @IsString()
  stopType: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTripDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  startingLocation?: string;

  @IsString()
  destinationCity: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsOptional()
  accommodationJson?: Record<string, unknown>;

  @IsOptional()
  transportJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sharedWithContactIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripStopDto)
  stops?: TripStopDto[];
}

export class UpdateTripDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  startingLocation?: string;

  @IsOptional()
  @IsString()
  destinationCity?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  accommodationJson?: Record<string, unknown>;

  @IsOptional()
  transportJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sharedWithContactIds?: string[];

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;
}

export class ScheduleCheckInDto {
  @IsString()
  title: string;

  @IsDateString()
  scheduledAt: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  graceMinutes?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
