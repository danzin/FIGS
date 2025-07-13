import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import {
  AssetDto,
  GetOhlcQueryDto,
  OhlcDataDto,
  IndicatorDto,
} from '../models/signal.dto';

@Injectable()
export class SignalsRepository {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  public async getCryptoAssets(): Promise<AssetDto[]> {
    const { rows } = await this.pool.query(
      "SELECT * FROM public.get_assets() WHERE category='crypto';",
    );
    return rows.map((row) => ({
      ...row,
      latest_price: row.latest_price ? parseFloat(row.latest_price) : null,
    }));
  }

  public async getOhlcData(
    assetSymbol: string,
    params: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    const { interval = '1h', limit = 1000 } = params;
    const text = 'SELECT * FROM public.get_ohlc_data($1, $2, $3);';
    try {
      const { rows } = await this.pool.query(text, [
        assetSymbol,
        interval,
        limit,
      ]);
      return rows.map((row) => ({
        ...row,
        open: parseFloat(row.open),
        high: parseFloat(row.high),
        low: parseFloat(row.low),
        close: parseFloat(row.close),
        volume: row.volume ? parseFloat(row.volume) : null,
      }));
    } catch (error) {
      if (error.message.includes('Invalid interval')) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  public async getLatestIndicators(names?: string[]): Promise<IndicatorDto[]> {
    if (names && names.length > 0) {
      const text = `SELECT * FROM public.get_latest_indicators() WHERE name = ANY($1::text[]);`;
      const { rows } = await this.pool.query(text, [names]);
      return rows.map((row) => ({ ...row, value: parseFloat(row.value) }));
    }
    const { rows } = await this.pool.query(
      'SELECT * FROM public.get_latest_indicators();',
    );
    return rows.map((row) => ({ ...row, value: parseFloat(row.value) }));
  }
}
