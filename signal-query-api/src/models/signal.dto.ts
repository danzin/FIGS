import { Type } from 'class-transformer';
import {
  IsDate,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const VALID_GRANS = [
  '1 minute',
  '5 minutes',
  '15 minutes',
  '1 hour',
  '1 day',
  '1 week',
  '1 month',
];
export class SignalDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Date) // Transform incoming string to Date
  @IsDate()
  time: Date; // In DB it's timestamptz, here it's Date

  @IsNumber()
  value: number;

  @IsString()
  @IsNotEmpty()
  source: string;
}

export class GetSignalsQueryDto {
  @IsOptional()
  @IsISO8601({}, { message: 'startTime must be a valid ISO8601 timestamp' })
  startTime?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'endTime must be a valid ISO8601 timestamp' })
  endTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number = 100; // Default value

  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^(${VALID_GRANS.join('|')})$`), {
    message: `granularity must be one of ${VALID_GRANS.join(', ')}`,
  })
  granularity?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
