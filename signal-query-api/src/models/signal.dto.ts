import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class AssetDto {
  symbol!: string;
  name!: string;
  category!: string;
  latest_price?: number;
  latest_price_time?: Date;
  is_active!: boolean;
}

export class AssetNameDto {
  name!: string;
}

export class OhlcDataDto {
  timestamp!: Date;
  open!: number;
  high!: number;
  low!: number;
  close!: number;
  volume?: number | null;
}

// Query parameters for the OHLC endpoint
export class GetOhlcQueryDto {
  @IsOptional()
  @IsIn(['15m', '1h', '1d', '30m'])
  interval?: '15m' | '1h' | '30m' | '1d' = '1h';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5000)
  limit?: number = 1000;
}

export class IndicatorDto {
  name!: string;
  value!: number;
  time!: Date;
  source!: string;
}

export type MetricChangeType = 'percent' | 'absolute';

export class GetMetricChangeQueryDto {
  @IsOptional()
  @IsIn(['percent', 'absolute'])
  type?: MetricChangeType = 'percent';
}

export interface MetricChangeDto {
  name: string;
  current: number | null;
  previous: number | null;
  change: number | null;
  changeType: MetricChangeType;
}

export interface LatestNewsWithSentimentDto {
  title: string;
  source: string | null;
  url: string | null;
  published_at: Date;
  summary: string | null;
  image_url: string | null;
  sentiment: string;
  sentiment_score: number | null;
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

export class GetLatestNewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}
