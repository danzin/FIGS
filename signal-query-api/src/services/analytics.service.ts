import { Injectable, Inject, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { CacheService } from './cache.service';

export interface CorrelationData {
  assets: string[];
  matrix: number[][];
}

export interface RsiData {
  symbol: string;
  name: string;
  rsi: number;
  price: number;
  priceChange24h: number;
}

export interface VolatilityState {
  status: 'squeeze' | 'expanding' | 'neutral';
  bandWidth: number;
  bandWidthPercentile: number;
  upperBand: number;
  lowerBand: number;
  currentPrice: number;
}

export interface MarketHeartbeatData {
  btcPrice?: { value: number; change: number | null };
  ethPrice?: { value: number; change: number | null };
  solPrice?: { value: number; change: number | null };
  btcDominance?: { value: number; change: number | null };
  ethGas?: { value: number; status: 'low' | 'medium' | 'high' };
  totalMarketCap?: { value: number; change: number | null };
  fearGreed?: { value: number; label: string };
}

export interface OnChainMetricData {
  name: string;
  value: number;
  change?: number;
  unit: string;
}

export interface OnChainMetricsByAsset {
  btc: OnChainMetricData[];
  eth: OnChainMetricData[];
  sol: OnChainMetricData[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Calculate Pearson correlation matrix for multiple assets
   * Uses last 30 days of daily close prices
   */
  async getCorrelationMatrix(): Promise<CorrelationData> {
    const cacheKey = this.cacheService.getCacheKey.correlation();

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchCorrelationMatrix(),
      this.cacheService.getTTL.correlation,
    );
  }

  private async fetchCorrelationMatrix(): Promise<CorrelationData> {
    const assets = ['bitcoin', 'ethereum', 'SPY', 'GLD'];
    const assetLabels = ['BTC', 'ETH', 'SPY', 'GOLD'];

    // Fetch 30 days of close prices for each asset
    const priceData: Record<string, { time: Date; close: number }[]> = {};

    for (const asset of assets) {
      const query = `
        SELECT time, close 
        FROM public.market_data_1d 
        WHERE asset_symbol = $1 AND type = 'price'
        ORDER BY time DESC 
        LIMIT 30
      `;

      try {
        const { rows } = await this.pool.query(query, [asset]);
        priceData[asset] = rows.map((r) => ({
          time: new Date(r.time),
          close: parseFloat(r.close),
        }));
      } catch {
        priceData[asset] = [];
      }
    }

    // Calculate correlation matrix
    const matrix: number[][] = [];

    for (let i = 0; i < assets.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < assets.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (j < i) {
          matrix[i][j] = matrix[j][i];
        } else {
          matrix[i][j] = this.calculatePearsonCorrelation(
            priceData[assets[i]]?.map((d) => d.close) || [],
            priceData[assets[j]]?.map((d) => d.close) || [],
          );
        }
      }
    }

    return { assets: assetLabels, matrix };
  }

  async getRsiHeatmap(): Promise<RsiData[]> {
    const cacheKey = this.cacheService.getCacheKey.rsiHeatmap();

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchRsiHeatmap(),
      this.cacheService.getTTL.rsi,
    );
  }

  private async fetchRsiHeatmap(): Promise<RsiData[]> {
    const assets = [
      { symbol: 'bitcoin', name: 'Bitcoin' },
      { symbol: 'ethereum', name: 'Ethereum' },
      { symbol: 'solana', name: 'Solana' },
      { symbol: 'cardano', name: 'Cardano' },
      { symbol: 'ripple', name: 'XRP' },
    ];

    const results: RsiData[] = [];

    for (const asset of assets) {
      // Fetch last 15 days of price data for RSI calculation
      const query = `
        SELECT time, close 
        FROM public.market_data_1d 
        WHERE asset_symbol = $1 AND type = 'price'
        ORDER BY time DESC 
        LIMIT 15
      `;

      try {
        const { rows } = await this.pool.query(query, [asset.symbol]);

        if (rows.length < 2) continue;

        const closes = rows.map((r) => parseFloat(r.close)).reverse();
        const rsi = this.calculateRSI(closes);
        const currentPrice = closes[closes.length - 1];
        const previousPrice =
          closes.length > 1 ? closes[closes.length - 2] : currentPrice;
        const priceChange =
          ((currentPrice - previousPrice) / previousPrice) * 100;

        results.push({
          symbol: asset.symbol,
          name: asset.name,
          rsi,
          price: currentPrice,
          priceChange24h: priceChange,
        });
      } catch (error) {
        this.logger.error(`Failed to calculate RSI for ${asset.symbol}`, error instanceof Error ? error.stack : String(error));
      }
    }

    return results.sort((a, b) => a.rsi - b.rsi);
  }

  async getVolatilitySqueeze(assetSymbol: string): Promise<VolatilityState> {
    const cacheKey = this.cacheService.getCacheKey.volatility(assetSymbol);

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchVolatilitySqueeze(assetSymbol),
      this.cacheService.getTTL.volatility,
    );
  }

  private async fetchVolatilitySqueeze(
    assetSymbol: string,
  ): Promise<VolatilityState> {
    const query = `
      SELECT time, close 
      FROM public.market_data_1d 
      WHERE asset_symbol = $1 AND type = 'price'
      ORDER BY time DESC 
      LIMIT 100
    `;

    const { rows } = await this.pool.query(query, [assetSymbol]);

    if (rows.length < 20) {
      return {
        status: 'neutral',
        bandWidth: 0,
        bandWidthPercentile: 50,
        upperBand: 0,
        lowerBand: 0,
        currentPrice: 0,
      };
    }

    const closes = rows.map((r) => parseFloat(r.close)).reverse();
    const currentPrice = closes[closes.length - 1];

    // Calculate Bollinger Bands
    const period = 20;
    const multiplier = 2;

    const recentCloses = closes.slice(-period);
    const sma = recentCloses.reduce((a, b) => a + b, 0) / period;
    const squaredDiffs = recentCloses.map((c) => Math.pow(c - sma, 2));
    const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);

    const upperBand = sma + multiplier * stdDev;
    const lowerBand = sma - multiplier * stdDev;
    const bandWidth = (upperBand - lowerBand) / sma;

    // Calculate historical band widths for percentile
    const historicalBandWidths: number[] = [];
    for (let i = period; i <= closes.length; i++) {
      const slice = closes.slice(i - period, i);
      const sliceSma = slice.reduce((a, b) => a + b, 0) / period;
      const sliceSquaredDiffs = slice.map((c) => Math.pow(c - sliceSma, 2));
      const sliceStdDev = Math.sqrt(
        sliceSquaredDiffs.reduce((a, b) => a + b, 0) / period,
      );
      const sliceUpper = sliceSma + multiplier * sliceStdDev;
      const sliceLower = sliceSma - multiplier * sliceStdDev;
      historicalBandWidths.push((sliceUpper - sliceLower) / sliceSma);
    }

    // Calculate percentile
    const sortedWidths = [...historicalBandWidths].sort((a, b) => a - b);
    const percentileIndex = sortedWidths.findIndex((w) => w >= bandWidth);
    const bandWidthPercentile = (percentileIndex / sortedWidths.length) * 100;

    // Determine status
    let status: 'squeeze' | 'expanding' | 'neutral';
    if (bandWidthPercentile <= 20) {
      status = 'squeeze';
    } else if (bandWidthPercentile >= 80) {
      status = 'expanding';
    } else {
      status = 'neutral';
    }

    return {
      status,
      bandWidth,
      bandWidthPercentile,
      upperBand,
      lowerBand,
      currentPrice,
    };
  }

  async getMarketHeartbeat(): Promise<MarketHeartbeatData> {
    const cacheKey = this.cacheService.getCacheKey.heartbeat();

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchMarketHeartbeat(),
      this.cacheService.getTTL.heartbeat,
    );
  }

  private async fetchMarketHeartbeat(): Promise<MarketHeartbeatData> {
    const result: MarketHeartbeatData = {};

    const btcQuery = `
      SELECT value, time FROM public.market_data 
      WHERE asset_symbol = 'bitcoin' AND type = 'price'
      ORDER BY time DESC LIMIT 2
    `;
    try {
      const { rows: btcRows } = await this.pool.query(btcQuery);
      if (btcRows.length >= 1) {
        const current = parseFloat(btcRows[0].value);
        const previous =
          btcRows.length > 1 ? parseFloat(btcRows[1].value) : current;
        result.btcPrice = {
          value: current,
          change:
            previous !== 0 ? ((current - previous) / previous) * 100 : null,
        };
      }
    } catch (err) {
      this.logger.warn('Failed to fetch BTC price', err);
    }

    const ethQuery = `
      SELECT value, time FROM public.market_data 
      WHERE asset_symbol = 'ethereum' AND type = 'price'
      ORDER BY time DESC LIMIT 2
    `;
    try {
      const { rows: ethRows } = await this.pool.query(ethQuery);
      if (ethRows.length >= 1) {
        const current = parseFloat(ethRows[0].value);
        const previous =
          ethRows.length > 1 ? parseFloat(ethRows[1].value) : current;
        result.ethPrice = {
          value: current,
          change:
            previous !== 0 ? ((current - previous) / previous) * 100 : null,
        };
      }
    } catch (err) {
      this.logger.warn('Failed to fetch ETH price', err);
    }

    const solQuery = `
      SELECT value, time FROM public.market_data 
      WHERE asset_symbol = 'solana' AND type = 'price'
      ORDER BY time DESC LIMIT 2
    `;
    try {
      const { rows: solRows } = await this.pool.query(solQuery);
      if (solRows.length >= 1) {
        const current = parseFloat(solRows[0].value);
        const previous =
          solRows.length > 1 ? parseFloat(solRows[1].value) : current;
        result.solPrice = {
          value: current,
          change:
            previous !== 0 ? ((current - previous) / previous) * 100 : null,
        };
      }
    } catch (err) {
      this.logger.warn('Failed to fetch SOL price', err);
    }

    const domQuery = `
      SELECT value FROM public.market_indicators 
      WHERE name = 'btc_dominance'
      ORDER BY time DESC LIMIT 2
    `;
    try {
      const { rows: domRows } = await this.pool.query(domQuery);
      if (domRows.length >= 1) {
        const current = parseFloat(domRows[0].value);
        const previous =
          domRows.length > 1 ? parseFloat(domRows[1].value) : current;
        result.btcDominance = {
          value: current,
          change: previous - current,
        };
      }
    } catch (err) {
      this.logger.warn('Failed to fetch BTC dominance', err);
    }

    const fgQuery = `
      SELECT value FROM public.market_indicators 
      WHERE name = 'fear_greed_index'
      ORDER BY time DESC LIMIT 1
    `;
    try {
      const { rows: fgRows } = await this.pool.query(fgQuery);
      if (fgRows.length >= 1) {
        const value = parseFloat(fgRows[0].value);
        let label = 'Neutral';
        if (value <= 25) label = 'Extreme Fear';
        else if (value <= 45) label = 'Fear';
        else if (value <= 55) label = 'Neutral';
        else if (value <= 75) label = 'Greed';
        else label = 'Extreme Greed';

        result.fearGreed = { value, label };
      }
    } catch (err) {
      this.logger.warn('Failed to fetch fear/greed index', err);
    }

    const gasQuery = `
      SELECT value FROM public.market_indicators 
      WHERE name = 'eth_gas_standard'
      ORDER BY time DESC LIMIT 1
    `;
    try {
      const { rows: gasRows } = await this.pool.query(gasQuery);
      if (gasRows.length >= 1) {
        const value = parseFloat(gasRows[0].value);
        let status: 'low' | 'medium' | 'high' = 'medium';
        if (value <= 15) status = 'low';
        else if (value > 50) status = 'high';

        result.ethGas = { value, status };
      }
    } catch (err) {
      this.logger.warn('Failed to fetch ETH gas', err);
    }

    return result;
  }

  async getDeveloperActivity(): Promise<
    { asset: string; commits: number; contributors: number }[]
  > {
    const cacheKey = 'analytics:dev_activity';

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchDeveloperActivity(),
      3600, // 1 hour cache
    );
  }

  private async fetchDeveloperActivity(): Promise<
    { asset: string; commits: number; contributors: number }[]
  > {
    const assets = [
      { name: 'btc_dev_activity', label: 'BTC' },
      { name: 'eth_dev_activity', label: 'ETH' },
      { name: 'sol_dev_activity', label: 'SOL' },
      { name: 'avax_dev_activity', label: 'AVAX' },
      { name: 'dot_dev_activity', label: 'DOT' },
      { name: 'atom_dev_activity', label: 'ATOM' },
      { name: 'link_dev_activity', label: 'LINK' },
    ];

    const results: { asset: string; commits: number; contributors: number }[] =
      [];

    for (const asset of assets) {
      try {
        const commitQuery = `
          SELECT value FROM public.market_indicators 
          WHERE name = $1
          ORDER BY time DESC LIMIT 1
        `;
        const contribQuery = `
          SELECT value FROM public.market_indicators 
          WHERE name = $1
          ORDER BY time DESC LIMIT 1
        `;

        const [commitRows, contribRows] = await Promise.all([
          this.pool.query(commitQuery, [asset.name]),
          this.pool.query(contribQuery, [`${asset.name}_contributors`]),
        ]);

        results.push({
          asset: asset.label,
          commits: commitRows.rows[0]?.value
            ? parseFloat(commitRows.rows[0].value)
            : 0,
          contributors: contribRows.rows[0]?.value
            ? parseFloat(contribRows.rows[0].value)
            : 0,
        });
      } catch {}
    }

    return results.sort((a, b) => b.commits - a.commits);
  }

  async getNetworkMetrics(): Promise<
    Record<string, { value: number; label: string }[]>
  > {
    const cacheKey = 'analytics:network_metrics';

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchNetworkMetrics(),
      300, // 5 min cache
    );
  }

  private async fetchNetworkMetrics(): Promise<
    Record<string, { value: number; label: string }[]>
  > {
    const metrics: Record<string, { value: number; label: string }[]> = {
      bitcoin: [],
      ethereum: [],
      solana: [],
    };

    const btcMetrics = [
      'btc_daily_transactions',
      'btc_hash_rate',
      'btc_mempool_size',
    ];
    const ethMetrics = [
      'eth_daily_transactions',
      'eth_node_count',
      'eth_staked',
    ];
    const solMetrics = ['sol_avg_priority_fee', 'sol_total_transactions'];

    const labelMap: Record<string, string> = {
      btc_daily_transactions: 'Daily Tx',
      btc_hash_rate: 'Hash Rate',
      btc_mempool_size: 'Mempool',
      eth_daily_transactions: 'Daily Tx',
      eth_node_count: 'Nodes',
      eth_staked: 'ETH Staked',
      sol_avg_priority_fee: 'Priority Fee',
      sol_total_transactions: 'Total Tx',
    };

    for (const metric of [...btcMetrics, ...ethMetrics, ...solMetrics]) {
      try {
        const query = `
          SELECT value FROM public.market_indicators 
          WHERE name = $1
          ORDER BY time DESC LIMIT 1
        `;
        const { rows } = await this.pool.query(query, [metric]);

        if (rows.length > 0) {
          const chain = metric.startsWith('btc_')
            ? 'bitcoin'
            : metric.startsWith('eth_')
              ? 'ethereum'
              : 'solana';

          metrics[chain].push({
            value: parseFloat(rows[0].value),
            label: labelMap[metric] || metric,
          });
        }
      } catch {}
    }

    return metrics;
  }

  async getWhaleMovements(
    assetSymbol: string,
  ): Promise<{ time: string; volume: number }[]> {
    const query = `
      WITH avg_volume AS (
        SELECT AVG(value) as avg_vol
        FROM public.market_data
        WHERE asset_symbol = $1 
          AND type = 'volume'
          AND time > NOW() - INTERVAL '30 days'
      )
      SELECT time, value as volume
      FROM public.market_data, avg_volume
      WHERE asset_symbol = $1 
        AND type = 'volume'
        AND value > avg_volume.avg_vol * 5
        AND time > NOW() - INTERVAL '30 days'
      ORDER BY time DESC
      LIMIT 20
    `;

    const { rows } = await this.pool.query(query, [assetSymbol]);
    return rows.map((r) => ({
      time: r.time.toISOString(),
      volume: parseFloat(r.volume),
    }));
  }

  async getOnChainMetrics(): Promise<OnChainMetricsByAsset> {
    const cacheKey = 'analytics:onchain';

    return this.cacheService.getOrSet(
      cacheKey,
      () => this.fetchOnChainMetrics(),
      300, // 5 min TTL
    );
  }

  private async fetchOnChainMetrics(): Promise<OnChainMetricsByAsset> {
    const result: OnChainMetricsByAsset = {
      btc: [],
      eth: [],
      sol: [],
    };

    // ===== BTC METRICS =====

    // BTC Active Addresses
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_data 
        WHERE type = 'active_addresses' AND asset_symbol = 'bitcoin'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.btc.push({
          name: 'Active Addresses',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // BTC Hash Rate (value from Blockchain.com API is in TH/s)
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'btc_hash_rate'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.btc.push({
          name: 'Hash Rate',
          value: parseFloat(rows[0].value),
          unit: 'hash_th',
        });
      }
    } catch {}

    // BTC Daily Transactions
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'btc_daily_transactions'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.btc.push({
          name: 'Daily Txns',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // BTC Mempool Size
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'btc_mempool_size'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.btc.push({
          name: 'Mempool Size',
          value: parseFloat(rows[0].value),
          unit: 'bytes',
        });
      }
    } catch {}

    // BTC Dev Activity
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'btc_dev_activity'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.btc.push({
          name: 'Dev Activity (7d)',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // BTC Contributors
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'btc_dev_activity_contributors'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.btc.push({
          name: 'Contributors',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // ===== ETH METRICS =====

    // ETH TVL
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_data 
        WHERE type = 'tvl' AND asset_symbol = 'ethereum'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.eth.push({
          name: 'Total Value Locked',
          value: parseFloat(rows[0].value),
          unit: 'usd',
        });
      }
    } catch {}

    // ETH Daily Transactions
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'eth_daily_transactions'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.eth.push({
          name: 'Daily Txns',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // ETH Gas Price (from Etherscan)
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'eth_gas_price'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.eth.push({
          name: 'Gas Price',
          value: parseFloat(rows[0].value),
          unit: 'gwei',
        });
      }
    } catch {}

    // ETH Staked
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'eth_staked'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        // Convert to millions for display
        result.eth.push({
          name: 'ETH Staked',
          value: parseFloat(rows[0].value),
          unit: 'eth',
        });
      }
    } catch {}

    // ETH Dev Activity
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'eth_dev_activity'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.eth.push({
          name: 'Dev Activity (7d)',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // ETH Contributors
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'eth_dev_activity_contributors'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.eth.push({
          name: 'Contributors',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // ===== SOL METRICS =====

    // SOL TVL
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_data 
        WHERE type = 'tvl' AND asset_symbol = 'solana'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.sol.push({
          name: 'Total Value Locked',
          value: parseFloat(rows[0].value),
          unit: 'usd',
        });
      }
    } catch {}

    // SOL TPS (Transactions Per Second) - more meaningful than lifetime count
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'sol_tps'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.sol.push({
          name: 'Current TPS',
          value: parseFloat(rows[0].value),
          unit: 'tps',
        });
      }
    } catch {}

    // SOL Lifetime Transactions (for context)
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'sol_total_transactions'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.sol.push({
          name: 'Lifetime Txns',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // SOL Avg Priority Fee (in micro-lamports)
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'sol_avg_priority_fee'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        const microLamports = parseFloat(rows[0].value);
        // Display as micro-lamports with clearer label
        result.sol.push({
          name: 'Priority Fee',
          value: microLamports,
          unit: 'microlamports',
        });
      }
    } catch {}

    // SOL Epoch Progress
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'sol_epoch_progress'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.sol.push({
          name: 'Epoch Progress',
          value: parseFloat(rows[0].value),
          unit: 'percent',
        });
      }
    } catch {}

    // SOL Dev Activity
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'sol_dev_activity'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.sol.push({
          name: 'Dev Activity (7d)',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    // SOL Contributors
    try {
      const { rows } = await this.pool.query(`
        SELECT value FROM market_indicators 
        WHERE name = 'sol_dev_activity_contributors'
        ORDER BY time DESC LIMIT 1
      `);
      if (rows.length > 0) {
        result.sol.push({
          name: 'Contributors',
          value: parseFloat(rows[0].value),
          unit: 'count',
        });
      }
    } catch {}

    return result;
  }

  // Helper: Calculate Pearson correlation coefficient
  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;

    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);

    const xMean = xSlice.reduce((a, b) => a + b, 0) / n;
    const yMean = ySlice.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xSlice[i] - xMean;
      const yDiff = ySlice[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }

    const denominator = Math.sqrt(xDenominator * yDenominator);
    if (denominator === 0) return 0;

    return numerator / denominator;
  }

  // Helper: Calculate RSI (14-period)
  private calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;

    const changes: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      changes.push(closes[i] - closes[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    // Initial average
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) avgGain += changes[i];
      else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    // Smoothed average
    for (let i = period; i < changes.length; i++) {
      if (changes[i] > 0) {
        avgGain = (avgGain * (period - 1) + changes[i]) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(changes[i])) / period;
      }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }
}
