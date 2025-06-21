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

  /**
   * Fetches the latest non-price signals (BTC.D, VIX Index, Fear&Greed etc) for the dashboard.
   */
  async getLatestSignalsByNames(
    names: string[],
  ): Promise<Record<string, SignalDto>> {
    const signals = await this.repo.findLatestByNames(names);

    // Convert the array of signals into a key-value map for easier frontend consumption.
    const signalsMap: Record<string, SignalDto> = {};
    for (const signal of signals) {
      signalsMap[signal.name] = signal;
    }

    // Optionally, check if all requested signals were found
    for (const requestedName of names) {
      if (!signalsMap[requestedName]) {
        // You could either ignore it or add a placeholder
        // For now, we'll just not include it in the response.
        console.warn(
          `[SignalsService] No latest value found for requested signal: ${requestedName}`,
        );
      }
    }

    return signalsMap;
  }
}
