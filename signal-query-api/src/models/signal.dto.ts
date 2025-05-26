import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
export class SignalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Date) // Transform incoming string to Date
  @IsDate()
  time: Date; // In DB it's timestamptz, here it's Date

  @IsNumber()
  @IsNotEmpty()
  value: number;

  @IsString()
  @IsNotEmpty()
  source: string;
}

export class GetSignalsQueryDto {
  @IsOptional()
  @IsString()
  startTime?: string; // Will be parsed to Date

  @IsOptional()
  @IsString()
  endTime?: string; // Will be parsed to Date

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100; // Default value

  @IsOptional()
  @IsString()
  granularity?: string; // e.g., '1 minute', '1 hour', '1 day'
}
