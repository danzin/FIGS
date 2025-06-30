import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import {
  SignalDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  PriceDTO,
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
    const { interval = '1h', source = null, limit = 1000 } = params;

    const text = `SELECT * FROM public.get_ohlc_data($1, $2, $3, $4);`;
    const values = [asset, source, interval, limit];

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
    const text = `SELECT name, time, value, source FROM public.latest_signals;`;
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
   * Lists all distinct base asset names (e.g., 'coingecko_bitcoin').
   */
  async listAssetNames(): Promise<string[]> {
    const text = `SELECT DISTINCT asset FROM public.signals_hourly_ohlc ORDER BY asset;`;
    const result = await this.pool.query(text);
    return result.rows.map((r) => r.asset);
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
}
