import { Injectable, NotFoundException } from '@nestjs/common';
import { SignalsRepository } from '../repositories/signals.repository';
import {
  AssetDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  IndicatorDto,
} from '../models/signal.dto';

@Injectable()
export class SignalsService {
  constructor(private readonly repo: SignalsRepository) {}

  async listAssets(): Promise<AssetDto[]> {
    return this.repo.getCryptoAssets();
  }

  async getOhlcData(
    assetSymbol: string,
    queryParams: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    const data = await this.repo.getOhlcData(assetSymbol, queryParams);
    if (!data || data.length === 0) {
      throw new NotFoundException(
        `No OHLC data found for asset '${assetSymbol}'.`,
      );
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
}
