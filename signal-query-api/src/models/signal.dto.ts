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

export class AssetDto {
  symbol: string;
  name: string;
  category: string;
  latest_price?: number;
  latest_price_time?: Date;
  is_active: boolean;
}

export class OhlcDataDto {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

// Query parameters for the OHLC endpoint
export class GetOhlcQueryDto {
  @IsOptional()
  @IsIn(['15m', '1h', '1d'])
  interval?: '15m' | '1h' | '1d' = '1h';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  limit?: number = 1000;
}

export class IndicatorDto {
  name: string;
  value: number;
  time: Date;
  source: string;
}

export class GetLatestIndicatorsQueryDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.split(',') : value,
  )
  names?: string[];
}
