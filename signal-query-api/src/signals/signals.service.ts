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

    let query = `SELECT time, name, value, source FROM public.signals WHERE name = $1`;
    const queryValues: any[] = [signalName];
    let paramIndex = 2;

    if (startTime) {
      query += ` AND time >= $${paramIndex++}`;
      queryValues.push(new Date(startTime));
    }
    if (endTime) {
      query += ` AND time <= $${paramIndex++}`;
      queryValues.push(new Date(endTime));
    }

    // Basic granularity handling with time_bucket
    if (granularity) {
      // TODO: use a whitelist or map to valid INTERVAL values.
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
      // This is a simplified aggregation, just taking the average.
      // For OHLC will need FIRST/LAST aggregates.
      // TODO: Work on that
      query = `
            SELECT
                time_bucket($${paramIndex++}, time) as time_bucket_alias,
                name,
                AVG(value) as value, -- Example: average value in bucket
                source -- This might need different handling with aggregation (e.g., FIRST source)
            FROM public.signals
            WHERE name = $1 `; // $1 is signalName
      queryValues.splice(1, 0, granularity); // Insert granularity as the new $2

      let whereClause = '';
      let currentParamIndex = paramIndex; // Start after granularity and name
      if (startTime) {
        whereClause += ` AND time >= $${currentParamIndex++}`;
      }
      if (endTime) {
        whereClause += ` AND time <= $${currentParamIndex++}`;
      }
      query += whereClause;
      query += ` GROUP BY time_bucket_alias, name, source ORDER BY time_bucket_alias DESC LIMIT $${currentParamIndex++};`;
      queryValues.push(limit);
    } else {
      query += ` ORDER BY time DESC LIMIT $${paramIndex++};`;
      queryValues.push(limit);
    }

    try {
      const result = await this.pool.query(query, queryValues);
      if (result.rows.length === 0 && !granularity) {
        // For now not throwing if no results found without granularity
        console.warn(
          `No signals found for name: ${signalName} with params: ${JSON.stringify(queryParams)}`,
        );
        return []; //Might need to throw throw NotFoundException, will see
      }

      // FIX any
      // Map to DTO, ensuring correct 'time' field name if using time_bucket_alias
      return result.rows.map((row: Row) => ({
        time: row.time_bucket_alias || row.time, // Use alias if present
        name: row.name,
        value: parseFloat(row.value), // Ensure value is number
        source: row.source,
      }));
    } catch (error) {
      console.error(`Error fetching signals for ${signalName}:`, error);
      throw error; // TODO: Consider custome specific HTTP exception
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
