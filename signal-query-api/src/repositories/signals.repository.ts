import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResultRow } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { Errors, isAppError } from '../errors/errors';
import {
  GetOhlcQueryDto,
  OhlcDataDto,
  IndicatorDto,
  AssetNameDto,
  LatestNewsWithSentimentDto,
} from '../models/signal.dto';
import {
  PgNumericValue,
  PgTimestampValue,
  readDate,
  readNullableDate,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
} from './pg-row.parsers';

interface OhlcRow {
  timestamp?: PgTimestampValue;
  bucketed_at?: PgTimestampValue;
  time?: PgTimestampValue;
  open: PgNumericValue;
  high: PgNumericValue;
  low: PgNumericValue;
  close: PgNumericValue;
  volume?: PgNumericValue;
}

interface IndicatorRow {
  name: string;
  value: PgNumericValue;
  time: PgTimestampValue;
  source: unknown;
}

interface MetricValueRow {
  value?: PgNumericValue;
}

interface LatestNewsRow {
  title: unknown;
  source: unknown;
  url: unknown;
  published_at: PgTimestampValue;
  summary: unknown;
  image_url: unknown;
  sentiment_label: unknown;
  sentiment_score: PgNumericValue;
}

@Injectable()
export class SignalsRepository {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  public async listCryptoNames(): Promise<AssetNameDto[]> {
    const rows = await this.queryRows<AssetNameDto>(
      'listCryptoNames',
      `SELECT name
     FROM public.get_assets()
     WHERE category = 'crypto'
     ORDER BY name;`,
    );

    return rows.map((row) => ({
      name: readString(row.name, 'name', 'listCryptoNames'),
    }));
  }

  /**
   * Fetches OHLC (Open, High, Low, Close) data for a given asset symbol and query params.
   * Throws a validation AppError if the interval or limit is invalid.
   */
  public async getOhlcData(
    assetSymbol: string,
    params: GetOhlcQueryDto,
  ): Promise<OhlcDataDto[]> {
    const { interval = '1h', limit = 1000 } = params;
    const text = 'SELECT * FROM public.get_ohlc_data($1, $2, $3);';

    try {
      const { rows } = await this.pool.query<OhlcRow>(text, [
        assetSymbol,
        interval,
        limit,
      ]);

      return rows
        .map((row): OhlcDataDto | null => {
          const timestampValue = row.timestamp ?? row.bucketed_at ?? row.time;
          if (timestampValue === null || timestampValue === undefined) {
            return null;
          }

          return {
            timestamp: readDate(timestampValue, 'timestamp', 'getOhlcData', {
              assetSymbol,
              interval,
            }),
            open: readNumber(row.open, 'open', 'getOhlcData', {
              assetSymbol,
              interval,
            }),
            high: readNumber(row.high, 'high', 'getOhlcData', {
              assetSymbol,
              interval,
            }),
            low: readNumber(row.low, 'low', 'getOhlcData', {
              assetSymbol,
              interval,
            }),
            close: readNumber(row.close, 'close', 'getOhlcData', {
              assetSymbol,
              interval,
            }),
            volume: readNullableNumber(row.volume, 'volume', 'getOhlcData', {
              assetSymbol,
              interval,
            }),
          };
        })
        .filter((row): row is OhlcDataDto => Boolean(row));
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.message.includes('Invalid interval') ||
          error.message.includes('Limit must be'))
      ) {
        throw Errors.validation(error.message, {
          context: {
            operation: 'getOhlcData',
            assetSymbol,
            interval,
            limit,
          },
        });
      }

      throw Errors.database('Failed to load OHLC data.', {
        cause: error,
        context: {
          operation: 'getOhlcData',
          assetSymbol,
          interval,
          limit,
        },
      });
    }
  }

  /**
   * Fetches latest indicators from the database.
   * If names are provided, filters indicators by names.
   */
  public async getLatestIndicators(names?: string[]): Promise<IndicatorDto[]> {
    if (names && names.length > 0) {
      const text = `SELECT * FROM public.get_latest_indicators() WHERE name = ANY($1::text[]);`;
      const rows = await this.queryRows<IndicatorRow>(
        'getLatestIndicators',
        text,
        [names],
      );

      return rows.map((row) => this.mapIndicatorRow(row));
    }
    const rows = await this.queryRows<IndicatorRow>(
      'getLatestIndicators',
      'SELECT * FROM public.get_latest_indicators();',
    );

    return rows.map((row) => this.mapIndicatorRow(row));
  }

  public async getMetricChange(
    metricName: string,
  ): Promise<{ current: number | null; previous: number | null }> {
    // Today's most recent value
    const todayRows = await this.queryRows<MetricValueRow>(
      'getMetricChange.current',
      `SELECT value FROM public.market_indicators
      WHERE name = $1 AND time::date = CURRENT_DATE
      ORDER BY time DESC LIMIT 1`,
      [metricName],
    );
    // Yesterday's last value
    const yesterdayRows = await this.queryRows<MetricValueRow>(
      'getMetricChange.previous',
      `SELECT value FROM public.market_indicators
      WHERE name = $1 AND time::date = CURRENT_DATE - INTERVAL '1 day'
      ORDER BY time DESC LIMIT 1`,
      [metricName],
    );

    return {
      current: readNullableNumber(
        todayRows[0]?.value,
        'current',
        'getMetricChange',
        { metricName },
      ),
      previous: readNullableNumber(
        yesterdayRows[0]?.value,
        'previous',
        'getMetricChange',
        { metricName },
      ),
    };
  }

  /**
   * Fetches the latest news articles with sentiment analysis.
   * @param limit - The number of news articles to fetch.
   * @returns The latest news articles with sentiment analysis.
   */
  public async getLatestNewsWithSentiment(
    limit = 10,
    offset = 0,
  ): Promise<LatestNewsWithSentimentDto[]> {
    const rows = await this.queryRows<LatestNewsRow>(
      'getLatestNewsWithSentiment',
      `
      SELECT
        a.title,
        a.source,
        a.url,
        a.published_at,
        a.summary,
        a.image_url,
        s.sentiment_label,
        s.sentiment_score
      FROM public.news_articles a
      LEFT JOIN LATERAL (
        SELECT sentiment_label, sentiment_score
        FROM public.news_sentiment s
        WHERE s.article_id = a.id
        ORDER BY time DESC
        LIMIT 1
      ) s ON true
      WHERE a.published_at >= NOW() - INTERVAL '14 days'
      ORDER BY a.published_at DESC
      LIMIT $1
      OFFSET $2
    `,
      [limit, offset],
    );

    return rows.map((row) => ({
      title: readString(row.title, 'title', 'getLatestNewsWithSentiment'),
      source: readNullableString(
        row.source,
        'source',
        'getLatestNewsWithSentiment',
      ),
      url: readNullableString(row.url, 'url', 'getLatestNewsWithSentiment'),
      published_at: readDate(
        row.published_at,
        'published_at',
        'getLatestNewsWithSentiment',
      ),
      summary: readNullableString(
        row.summary,
        'summary',
        'getLatestNewsWithSentiment',
      ),
      image_url: readNullableString(
        row.image_url,
        'image_url',
        'getLatestNewsWithSentiment',
      ),
      sentiment:
        readNullableString(
          row.sentiment_label,
          'sentiment_label',
          'getLatestNewsWithSentiment',
        ) ?? 'neutral',
      sentiment_score: readNullableNumber(
        row.sentiment_score,
        'sentiment_score',
        'getLatestNewsWithSentiment',
      ),
    }));
  }

  private mapIndicatorRow(row: IndicatorRow): IndicatorDto {
    return {
      name: readString(row.name, 'name', 'getLatestIndicators'),
      value: readNumber(row.value, 'value', 'getLatestIndicators', {
        indicatorName: row.name,
      }),
      time: readDate(row.time, 'time', 'getLatestIndicators', {
        indicatorName: row.name,
      }),
      source: readString(row.source, 'source', 'getLatestIndicators', {
        indicatorName: row.name,
      }),
    };
  }

  private async queryRows<T extends QueryResultRow>(
    operation: string,
    query: string,
    values: readonly unknown[] = [],
  ): Promise<T[]> {
    try {
      const { rows } = await this.pool.query<T>(query, [...values]);
      return rows;
    } catch (error) {
      throw Errors.database(`Failed to execute ${operation}.`, {
        cause: error,
        context: { operation },
      });
    }
  }
}
