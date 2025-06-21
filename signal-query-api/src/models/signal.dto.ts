import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Transform } from 'class-transformer';

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

export class OhlcDto {
  time: Date;
  name: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  total_volume: number;
}

export class GetOhlcQueryDto {
  @IsOptional()
  @IsIn(['15m', '1h', '30m', '1d']) // Validate against the intervals the function supprots
  interval?: '15m' | '1h' | '30m' | '1d';

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10000)
  limit?: number = 1000;
}

export class OhlcDataDto {
  @Type(() => Date)
  @IsDate()
  timestamp: Date;

  @IsNumber()
  open: number;

  @IsNumber()
  high: number;

  @IsNumber()
  low: number;

  @IsNumber()
  close: number;

  @IsNumber()
  @IsOptional() // Volume might be null if no volume data was present in the bucket
  volume?: number;
}

export class VwapDto {
  time: Date;
  name: string;
  vwap: number;
  total_volume: number;
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

export class GetLatestSignalsQueryDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  names: string[];
}
