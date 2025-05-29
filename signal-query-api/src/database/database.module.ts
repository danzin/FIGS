import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PG_CONNECTION } from './database.constants';

const dbProvider = {
  provide: PG_CONNECTION,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const pool = new Pool({
      host: configService.get<string>('database.host'),
      port: configService.get<number>('database.port'),
      user: configService.get<string>('database.username'),
      password: configService.get<string>('database.password'),
      database: configService.get<string>('database.name'),
    });

    try {
      const client = await pool.connect();
      console.log('[DatabaseModule] Successfully connected to TimescaleDB.');
      client.release(); // Fixed memory leak by not releasing client pool
    } catch (error) {
      console.error(
        '[DatabaseModule] Failed to connect to TimescaleDB:',
        error,
      );
      throw error; // Fail on DB connection error
    }
    return pool;
  },
};

@Global() // PG_CONNECTION injectable in nmodules
@Module({
  providers: [dbProvider],
  exports: [dbProvider],
})
export class DatabaseModule {}
