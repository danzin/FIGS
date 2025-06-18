import { Injectable, NotFoundException } from '@nestjs/common';
import { SignalsRepository } from '../repositories/signals.repository';
import { SignalDto, GetOhlcQueryDto, OhlcDataDto } from '../models/signal.dto';

@Injectable()
export class SignalsService {
  constructor(private readonly repo: SignalsRepository) {}

  /**
   * Gets OHLCV data for charting. This will be the main method used by your frontend chart.
   */
  async getOhlcData(
    asset: string,
    queryParams: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    const data = await this.repo.findOhlcData(asset, queryParams);
    if (!data || data.length === 0) {
      throw new NotFoundException(
        `No OHLC data found for asset '${asset}' with the given criteria.`,
      );
    }
    return data;
  }

  /**
   * Get the latest price for a single asset.
   */
  async getLatestPrice(asset: string): Promise<SignalDto> {
    const latest = await this.repo.findLatestPrice(asset);
    if (!latest) {
      throw new NotFoundException(`No latest price found for asset '${asset}'`);
    }
    return latest;
  }

  /**
   * List all available asset names that have OHLC data.
   */
  async listAssets(): Promise<string[]> {
    return this.repo.listAssetNames();
  }

  /**
   * List all other general (non-asset) signal names.
   */
  async listGeneralSignals(): Promise<string[]> {
    return this.repo.listGeneralSignalNames();
  }
}
