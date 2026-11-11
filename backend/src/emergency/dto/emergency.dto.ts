import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class TriggerSosDto {
  @IsOptional()
  @IsString()
  tripId?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contactIds?: string[];
}

export class AcknowledgeSosDto {
  @IsOptional()
  @IsString()
  deliveryId?: string;
}
