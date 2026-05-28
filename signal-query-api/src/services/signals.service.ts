import { Injectable } from '@nestjs/common';
import { Errors } from '../errors/errors';
import { SignalsRepository } from '../repositories/signals.repository';
import {
  AssetDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  IndicatorDto,
  AssetNameDto,
  MetricChangeDto,
  MetricChangeType,
  LatestNewsWithSentimentDto,
} from '../models/signal.dto';

@Injectable()
export class SignalsService {
  constructor(private readonly repo: SignalsRepository) {}

  async listAssetNames(): Promise<AssetNameDto[]> {
    return this.repo.listCryptoNames();
  }

  async getOhlcData(
    assetSymbol: string,
    queryParams: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    const data = await this.repo.getOhlcData(assetSymbol, queryParams);
    if (!data || data.length === 0) {
      throw Errors.notFound('OHLC data', assetSymbol, {
        context: {
          operation: 'getOhlcData',
          assetSymbol,
          interval: queryParams.interval ?? '1h',
        },
      });
    }
    return data;
  }

  async getLatestIndicators(
    names?: string[],
  ): Promise<Record<string, IndicatorDto>> {
    const indicators = await this.repo.getLatestIndicators(names);
    return indicators.reduce(
      (acc, indicator) => {
        acc[indicator.name] = indicator;
        return acc;
      },
      {} as Record<string, IndicatorDto>,
    );
  }

  async getMetricWithChange(
    metricName: string,
    changeType: MetricChangeType = 'percent',
  ): Promise<MetricChangeDto> {
    const { current, previous } = await this.repo.getMetricChange(metricName);
    let change: number | null = null;
    if (current !== null && previous !== null) {
      if (changeType === 'percent') {
        change =
          previous !== 0
            ? ((current - previous) / Math.abs(previous)) * 100
            : null;
      } else {
        change = current - previous;
      }
    }
    return { name: metricName, current, change, changeType, previous };
  }

  async getLatestNewsWithSentiment(
    limit = 10,
    offset = 0,
  ): Promise<LatestNewsWithSentimentDto[]> {
    return this.repo.getLatestNewsWithSentiment(limit, offset);
  }
}
