import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class DiscoverPeopleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  radiusKm?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsDateString()
  travelDate?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  interest?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  availableOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  paginated?: boolean;
}

export class UpsertBuddyProfileDto {
  @IsString()
  headline: string;

  @IsArray()
  @IsString({ each: true })
  servicesOffered: string[];

  @IsArray()
  @IsString({ each: true })
  languages: string[];

  @IsInt()
  @Min(0)
  hourlyRateInr: number;

  @IsBoolean()
  isAvailable: boolean;

  @IsString()
  city: string;

  @IsNumber()
  baseLatitude: number;

  @IsNumber()
  baseLongitude: number;

  @IsOptional()
  availabilitySlots?: Record<string, unknown>;
}
