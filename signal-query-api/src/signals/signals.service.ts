import {
  Inject,
  Injectable,
  // NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { SignalDto, GetSignalsQueryDto } from '../models/signal.dto';

interface Row {
  time: Date;
  time_bucket_alias: Date;
  name: string;
  value: string;
  source: string;
}

@Injectable()
export class SignalsService {
  constructor(@Inject(PG_CONNECTION) private readonly pool: Pool) {}

  async findByName(
    signalName: string,
    queryParams: GetSignalsQueryDto,
  ): Promise<SignalDto[]> {
    const { startTime, endTime, limit = 100, granularity } = queryParams;

    const filterClauses: string[] = [];
    const queryValues: any[] = [signalName];

    // Helper to add clause and value
    const addFilter = (clause: string, value: any) => {
      filterClauses.push(clause.replace('?', `$${queryValues.length + 1}`));
      queryValues.push(value);
    };

    if (startTime) {
      addFilter('time >= ?', new Date(startTime));
    }
    if (endTime) {
      addFilter('time <= ?', new Date(endTime));
    }

    let query: string;

    if (granularity) {
      // Validate granularity
      const validGranularities = [
        '1 minute',
        '5 minutes',
        '15 minutes',
        '1 hour',
        '1 day',
        '1 week',
        '1 month',
      ];
      if (!validGranularities.includes(granularity.toLowerCase())) {
        throw new BadRequestException('Invalid granularity value.');
      }
      // Insert granularity as $2, shift all other params
      queryValues.splice(1, 0, granularity);

      query = `
      SELECT
        time_bucket($2, time) as time_bucket_alias,
        name,
        AVG(value) as value,
        source
      FROM public.signals
      WHERE name = $1
      ${filterClauses.length ? ' AND ' + filterClauses.join(' AND ') : ''}
      GROUP BY time_bucket_alias, name, source
      ORDER BY time_bucket_alias DESC
      LIMIT $${queryValues.length + 1};
    `;
      queryValues.push(limit);
    } else {
      query = `
      SELECT time, name, value, source
      FROM public.signals
      WHERE name = $1
      ${filterClauses.length ? ' AND ' + filterClauses.join(' AND ') : ''}
      ORDER BY time DESC
      LIMIT $${queryValues.length + 1};
    `;
      queryValues.push(limit);
    }

    try {
      const result = await this.pool.query(query, queryValues);
      if (result.rows.length === 0 && !granularity) {
        console.warn(
          `No signals found for name: ${signalName} with params: ${JSON.stringify(queryParams)}`,
        );
        return [];
      }
      return result.rows.map((row: Row) => ({
        time: row.time_bucket_alias || row.time,
        name: row.name,
        value: parseFloat(row.value),
        source: row.source,
      }));
    } catch (error) {
      console.error(`Error fetching signals for ${signalName}:`, error);
      throw error;
    }
  }

  async findLatestByName(signalName: string): Promise<SignalDto | null> {
    const query = `
       SELECT time, name, value, source
       FROM public.signals
       WHERE name = $1
       ORDER BY time DESC
       LIMIT 1;
     `;
    try {
      const result = await this.pool.query(query, [signalName]);
      if (result.rows.length === 0) {
        return null;
      }
      const row: Row = result.rows[0] as Row;
      return {
        time: row.time,
        name: row.name,
        value: parseFloat(row.value),
        source: row.source,
      };
    } catch (error) {
      console.error(`Error fetching latest signal for ${signalName}:`, error);
      throw error;
    }
  }
}
