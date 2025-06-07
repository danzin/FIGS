import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { Pool, QueryResult } from 'pg';
import { SignalDto, GetSignalsQueryDto } from '../models/signal.dto';
import { PG_CONNECTION } from '../database/database.constants';

interface RawRow {
  time: Date;
  time_bucket_alias: Date | null;
  name: string;
  value: string;
  source: string;
}

@Injectable()
export class SignalsRepository {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  /**
   * Fetch raw signals (no bucketing) with optional filters.
   */
  async findRaw(
    signalName: string,
    params: GetSignalsQueryDto,
  ): Promise<SignalDto[]> {
    const { startTime, endTime, limit = 100 } = params;
    const queryValues: any[] = [signalName];
    const filterClauses: string[] = [];

    if (startTime) {
      queryValues.push(new Date(startTime));
      filterClauses.push(`time >= $${queryValues.length}`);
    }
    if (endTime) {
      queryValues.push(new Date(endTime));
      filterClauses.push(`time <= $${queryValues.length}`);
    }

    let text = `
      SELECT time, name, value, source
      FROM public.signals
      WHERE name = $1
      ${filterClauses.length ? ' AND ' + filterClauses.join(' AND ') : ''}
      ORDER BY time DESC
      LIMIT $${queryValues.length + 1};
    `;
    queryValues.push(limit);

    const result: QueryResult<RawRow> = await this.pool.query(
      text,
      queryValues,
    );
    return result.rows.map((row) => ({
      time: row.time,
      name: row.name,
      value: parseFloat(row.value),
      source: row.source,
    }));
  }

  /**
   * Fetch bucketed (aggregated) signals using time_bucket or continuous aggregate view.
   */
  //TODO: Add support for the OHLC query, the aggregate exists in the DB
  async findBucketed(
    signalName: string,
    params: GetSignalsQueryDto,
  ): Promise<SignalDto[]> {
    const { startTime, endTime, limit = 100, granularity } = params;
    if (!granularity) {
      throw new BadRequestException(
        'Granularity must be provided for bucketed queries',
      );
    }

    // Validate the granularity string
    const validGran = [
      '1 minute',
      '5 minutes',
      '15 minutes',
      '1 hour',
      '1 day',
      '1 week',
      '1 month',
    ];
    if (!validGran.includes(granularity.toLowerCase())) {
      throw new BadRequestException(`Invalid granularity: ${granularity}`);
    }
    // Consider adding a dictionary of complete SQL templates, one per view, however even now
    // THIS IS SAFE
    // IT DOESN'T ALLOW FOR SQL INJECTION BECAUSE OF WHITELIST + SWITCH! IT'S SAFE
    const caggName = this.getContinuousViewName(granularity);
    const queryValues: any[] = [signalName];
    const filterClauses: string[] = [];

    if (startTime) {
      queryValues.push(new Date(startTime));
      filterClauses.push(`bucketed_at >= $${queryValues.length}`);
    }
    if (endTime) {
      queryValues.push(new Date(endTime));
      filterClauses.push(`bucketed_at <= $${queryValues.length}`);
    }

    const text = `
    SELECT bucketed_at AS time, name, avg_value AS value, source
    FROM public.${caggName}
    WHERE name = $1
    ${filterClauses.length ? ' AND ' + filterClauses.join(' AND ') : ''}
    ORDER BY bucketed_at DESC
    LIMIT $${queryValues.length + 1};
  `;
    queryValues.push(limit);

    const result: QueryResult<RawRow> = await this.pool.query(
      text,
      queryValues,
    );
    return result.rows.map((row) => ({
      time: row.time,
      name: row.name,
      value: parseFloat(row.value),
      source: row.source,
    }));
  }

  /**
   * Fetch the latest (most recent) single row for signalName.
   */
  async findLatest(signalName: string): Promise<SignalDto | null> {
    const text = `
      SELECT time, name, value, source
      FROM public.signals
      WHERE name = $1
      ORDER BY time DESC
      LIMIT 1;
    `;
    const result: QueryResult<RawRow> = await this.pool.query(text, [
      signalName,
    ]);
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      time: row.time,
      name: row.name,
      value: parseFloat(row.value),
      source: row.source,
    };
  }

  /**
   * List all distinct signal names in the DB.
   */
  async listSignalNames(): Promise<string[]> {
    const result: QueryResult<{ name: string }> = await this.pool.query(
      `SELECT DISTINCT name FROM public.signals ORDER BY name;`,
    );
    return result.rows.map((r) => r.name);
  }

  /**
   * Utility: map granularity string to CAGG view name
   */
  private getContinuousViewName(granularity: string): string {
    switch (granularity.toLowerCase()) {
      case '1 hour':
        return 'signals_hourly';
      case '1 day':
        return 'signals_daily';
      case '1 week':
        return 'signals_weekly';
      default:
        throw new BadRequestException(
          `No continuous view defined for ${granularity}`,
        );
    }
  }
}
