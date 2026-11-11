import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  buddyId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsString()
  activitySummary: string;

  @IsOptional()
  @IsString()
  meetingPointName?: string;

  @IsOptional()
  @IsString()
  meetingPointAddress?: string;

  @IsOptional()
  @IsNumber()
  meetingPointLat?: number;

  @IsOptional()
  @IsNumber()
  meetingPointLng?: number;
}

export class RespondBookingDto {
  @IsEnum(['ACCEPTED', 'REJECTED'])
  decision: 'ACCEPTED' | 'REJECTED';
}

export class ConfirmBookingDto {
  @IsString()
  meetingPointName: string;

  @IsOptional()
  @IsString()
  meetingPointAddress?: string;

  @IsOptional()
  @IsNumber()
  meetingPointLat?: number;

  @IsOptional()
  @IsNumber()
  meetingPointLng?: number;

  @IsBoolean()
  isPublicMeetingPoint: boolean;
}

export class CancelBookingDto {
  @IsString()
  reason: string;
}

export class SendMessageDto {
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  clientMessageId?: string;
}

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  safetyScore?: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
