import { Injectable, NotFoundException } from '@nestjs/common';
import { SignalsRepository } from '../repositories/signals.repository';
import {
  AssetDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  IndicatorDto,
  AssetNameDto,
} from '../models/signal.dto';

@Injectable()
export class SignalsService {
  constructor(private readonly repo: SignalsRepository) {}

  /**
   * Gets the list of crypto asset names via repository.
   */
  async listAssetNames(): Promise<AssetNameDto[]> {
    return this.repo.listCryptoNames();
  }

  /**
   * Gets OHLC data for the given asset symbol and query params.
   * Throws NotFoundException if no data is returned.
   */
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

  /**
   * Gets the latest indicators, optionally filtered by names.
   * Returns indicators as a keyed object: { [indicatorName]: IndicatorDto }
   */
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
