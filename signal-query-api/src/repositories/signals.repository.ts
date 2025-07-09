import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import {
  SignalDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  PriceDTO,
  AssetDTO,
} from '../models/signal.dto';
import { PG_CONNECTION } from '../database/database.constants';

@Injectable()
export class SignalsRepository {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}
  /**
   * Calls the get_ohlc_data database function to retrieve OHLCV data.
   * This is the primary method for fetching chart data.
   */
  async findOhlcData(
    asset: string,
    params: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    // Destructure ONLY the parameters your DB function needs
    const { interval = '1h', limit = 1000 } = params;

    // The query now calls the function with the correct number of placeholders
    const text = `SELECT * FROM public.get_ohlc_data($1, $2, $3);`;

    // Pass only the corresponding values
    const values = [asset, interval, limit];

    try {
      const result: QueryResult<OhlcDataDto> = await this.pool.query(
        text,
        values,
      );
      return result.rows;
    } catch (error) {
      if (
        error.message.includes('Invalid interval') ||
        error.message.includes('Limit must be')
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
  /**
   * Fetches the latest price for a given asset from the helper view.
   */
  async findLatestPrice(asset: string): Promise<SignalDto | null> {
    const text = `SELECT * as name, time, price as value, source FROM public.latest_prices WHERE asset = $1;`;
    const result = await this.pool.query(text, [asset]);
    return result.rows[0] || null;
  }
  /**
   * Fetches the latest non-price/volume signals from the helper view.
   */
  async findLatestGeneralSignals(): Promise<SignalDto[]> {
    const text = `SELECT * FROM public.latest_indicators;`;
    const result = await this.pool.query(text);
    return result.rows;
  }

  /**
   * Fetches data from the general hourly aggregate view for non-price signals.
   */
  async findGeneralHourly(
    signalName: string,
    limit: number = 100,
  ): Promise<any[]> {
    const text = `
      SELECT bucketed_at, name, source, avg_value, min_value, max_value, sample_count
      FROM public.signals_hourly_general
      WHERE name = $1
      ORDER BY bucketed_at DESC
      LIMIT $2;
    `;
    const result = await this.pool.query(text, [signalName, limit]);
    return result.rows;
  }

  /**
   * Lists all distinct base asset names (e.g., 'bitcoin').
   */
  async listAssets(): Promise<AssetDTO[]> {
    const text = `SELECT symbol, name, category FROM public.get_assets();`;
    const result = await this.pool.query(text);
    return result.rows;
  }

  /**
   * Lists all distinct general signal names.
   */
  async listGeneralSignalNames(): Promise<string[]> {
    const text = `SELECT DISTINCT name FROM public.signals_hourly_general ORDER BY name;`;
    const result = await this.pool.query(text);
    return result.rows.map((r) => r.name);
  }

  /**
   * Fetches the latest non-price signals by their names.
   * This is used for dashboard widgets that need the latest values of specific signals.
   */
  async findLatestSignalsByNames(signalNames: string[]): Promise<SignalDto[]> {
    if (!signalNames || signalNames.length === 0) {
      return [];
    }

    const text = `
      SELECT name, time, value, source
      FROM public.latest_signals
      WHERE name = ANY($1::text[]);
    `;

    try {
      const result = await this.pool.query(text, [signalNames]);
      return result.rows;
    } catch (error) {
      console.error(
        `[SignalsRepository] Error fetching latest signals by names:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Fetches the latest non-price signals by their names.
   * This is used for dashboard widgets that need the latest values of specific signals.
   */
  async findLatestPricesByNames(priceNames: string[]): Promise<PriceDTO[]> {
    if (!priceNames || priceNames.length === 0) {
      return [];
    }

    const text = `
      SELECT asset, time, price, source
      FROM public.latest_prices
      WHERE asset = ANY($1::text[]);
    `;

    try {
      const result = await this.pool.query(text, [priceNames]);
      return result.rows;
    } catch (error) {
      console.error(
        `[SignalsRepository] Error fetching latest prices by names:`,
        error,
      );
      throw error;
    }
  }

  async findLatestDashboardData(
    priceAssets: string[],
    indicatorNames: string[],
  ): Promise<{ prices: PriceDTO[]; indicators: SignalDto[] }> {
    // We can run both queries in a single transaction for consistency
    const client = await this.pool.connect();
    try {
      // Query 1: Get latest prices for the requested assets
      const priceQuery = `
        SELECT asset, time, price, source
        FROM public.latest_prices
        WHERE asset = ANY($1::text[]);
      `;
      const priceResult = await client.query(priceQuery, [priceAssets]);

      // Query 2: Get latest values for the requested indicators
      const indicatorQuery = `
        SELECT name, time, value, source
        FROM public.latest_signals
        WHERE name = ANY($1::text[]);
      `;
      const indicatorResult = await client.query(indicatorQuery, [
        indicatorNames,
      ]);

      return {
        prices: priceResult.rows,
        indicators: indicatorResult.rows,
      };
    } catch (error) {
      console.error(
        `[SignalsRepository] Error fetching latest dashboard data:`,
        error,
      );
      throw error;
    } finally {
      client.release();
    }
  }
}
