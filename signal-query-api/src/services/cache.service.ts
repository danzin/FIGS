import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Redis client type
type RedisClientType = {
  connect(): Promise<void>;
  quit(): Promise<void>;
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<void>;
  del(keys: string | string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  publish(channel: string, message: string): Promise<number>;
  on(event: string, callback: (...args: unknown[]) => void): void;
};

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private readonly logger = new Logger(CacheService.name);

  // Default TTL values in seconds
  private readonly DEFAULT_TTL = 300; // 5 minutes
  private readonly HEARTBEAT_TTL = 60; // 1 minute
  private readonly CORRELATION_TTL = 3600; // 1 hour
  private readonly RSI_TTL = 300; // 5 minutes
  private readonly VOLATILITY_TTL = 300; // 5 minutes
  private readonly OHLC_TTL = 300; // 5 minutes

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      this.logger.warn('REDIS_URL not configured, caching disabled');
      return;
    }

    try {
      // Dynamically import redis to make it optional
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const redis = await this.loadRedisModule();
      if (!redis) {
        this.logger.warn('Redis package not installed, caching disabled');
        return;
      }
      this.client = redis.createClient({
        url: redisUrl,
      }) as unknown as RedisClientType;

      this.client.on('error', (err: unknown) => {
        this.logger.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        this.logger.log('Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      this.logger.warn('Failed to connect to Redis, caching disabled:', error);
      this.client = null;
    }
  }

  /**
   * Dynamically load Redis module if available
   */
  private async loadRedisModule(): Promise<{
    createClient: (config: { url: string }) => unknown;
  } | null> {
    try {
      // Use eval to bypass TypeScript's static module resolution
      // This allows the app to work without redis being installed
      // eslint-disable-next-line no-eval
      return await eval('import("redis")');
    } catch {
      return null;
    }
  }

  async onModuleDestroy() {
    if (this.client && this.isConnected) {
      await this.client.quit();
    }
  }

  /**
   * Get cached value or execute callback to fetch and cache
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<T> {
    if (!this.client || !this.isConnected) {
      return fetchFn();
    }

    try {
      const cached = await this.client.get(key);
      if (cached) {
        this.logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(cached) as T;
      }

      this.logger.debug(`Cache MISS: ${key}`);
      const data = await fetchFn();
      await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
      return data;
    } catch (error) {
      this.logger.error(`Cache error for key ${key}:`, error);
      return fetchFn();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client || !this.isConnected) return null;

    try {
      const cached = await this.client.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error) {
      this.logger.error(`Get error for ${key}:`, error);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number = this.DEFAULT_TTL,
  ): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Set error for ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error(`Delete error for ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delByPattern(pattern: string): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      this.logger.error(`Delete pattern error for ${pattern}:`, error);
    }
  }

  async publish(channel: string, message: unknown): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      await this.client.publish(channel, JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Publish error for ${channel}:`, error);
    }
  }

  // Convenience methods for specific cache keys
  getCacheKey = {
    ohlc: (asset: string, interval: string) => `ohlc:${asset}:${interval}`,
    correlation: () => 'analytics:correlation',
    rsiHeatmap: () => 'analytics:rsi-heatmap',
    volatility: (asset: string) => `analytics:volatility:${asset}`,
    heartbeat: () => 'analytics:heartbeat',
    whaleMovements: (asset: string) => `analytics:whale:${asset}`,
    indicators: () => 'indicators:latest',
  };

  getTTL = {
    ohlc: this.OHLC_TTL,
    correlation: this.CORRELATION_TTL,
    rsi: this.RSI_TTL,
    volatility: this.VOLATILITY_TTL,
    heartbeat: this.HEARTBEAT_TTL,
  };
}
