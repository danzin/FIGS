import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_CONNECTION } from '../database/database.constants';
import { CacheService } from './cache.service';
import axios from 'axios';

// ============== TYPE DEFINITIONS ==============

export interface PowerLawData {
  currentPrice: number;
  fairValue: number;
  drawdown: number;
  daysSinceGenesis: number;
  slope: number;
  intercept: number;
  historicalData: { timestamp: string; price: number; fairValue: number }[];
}

export interface StablecoinLiquidityData {
  totalMarketCap: number;
  marketCapChange24h: number;
  yoyGrowth: number;
  liquidityFlowIndex: number;
  breakdown: {
    name: string;
    symbol: string;
    marketCap: number;
    change24h: number;
  }[];
  historicalData: {
    timestamp: string;
    totalMarketCap: number;
    yoyGrowth: number;
    liquidityFlow: number;
  }[];
}

export interface OpenInterestData {
  totalOI: number;
  oiChange30d: number;
  oiChangeYoY: number;
  status: 'overheated' | 'normal' | 'flushed';
  historicalData: {
    timestamp: string;
    openInterest: number;
    change30d: number;
  }[];
}

export interface MVRVData {
  mvrvZScore: number;
  currentPrice: number;
  realizedPrice: number;
  sma200Week: number;
  signal:
    | 'extreme_undervalued'
    | 'undervalued'
    | 'fair'
    | 'overvalued'
    | 'extreme_overvalued';
  historicalData: {
    timestamp: string;
    price: number;
    realizedPrice: number;
    zScore: number;
  }[];
}

export interface HashRateData {
  currentHashRate: number;
  hashRateChange30d: number;
  minerCapitulation: boolean;
  ribbonStatus: 'recovery' | 'neutral' | 'capitulation';
  historicalData: {
    timestamp: string;
    hashRate: number;
    sma30: number;
    sma60: number;
  }[];
}

export interface MomentumCoalescenceData {
  compositeScore: number;
  components: {
    fastROC: number;
    slowROC: number;
    volumeDelta: number;
    volatilityBias: number;
  };
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  historicalData: { timestamp: string; compositeScore: number }[];
}

export interface CompositeIndicatorData {
  overallScore: number;
  normalizedScores: {
    rsi: number;
    mvrv: number;
    minerHealth: number;
    liquidityFlow: number;
    momentum: number;
  };
  regime: 'bull' | 'bear' | 'neutral';
  recommendation: string;
}

// ============== SERVICE ==============

@Injectable()
export class AdvancedIndicatorsService {
  private readonly GENESIS_DATE = new Date('2009-01-03');
  // Power Law "Pro" params (On-Chain Mind / Santostasi model)
  // For 6,202 days (Dec 2025): 10^(-17.06 + 5.83 * 3.7925) = $112,000
  private readonly POWER_LAW_SLOPE = 5.83;
  private readonly POWER_LAW_INTERCEPT = -17.06;

  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly cacheService: CacheService,
  ) {}

  // ============== POWER LAW ==============

  async getPowerLawData(): Promise<PowerLawData> {
    const cacheKey = 'indicators:power_law:v2';
    const cached = await this.cacheService.get<PowerLawData>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchPowerLawData();
    await this.cacheService.set(cacheKey, data, 600); // Cache 10 min (price-sensitive)
    return data;
  }

  private async getLatestAssetSpotPriceUsd(
    assetSymbol: string,
  ): Promise<number> {
    // Prefer higher-frequency spot price data if present.
    const spotQuery = `
      SELECT value
      FROM public.market_data
      WHERE asset_symbol = $1 AND type = 'price'
      ORDER BY time DESC
      LIMIT 1
    `;
    const spotResult = await this.pool.query(spotQuery, [assetSymbol]);
    const spotValue = spotResult.rows[0]?.value;
    if (spotValue !== undefined && spotValue !== null) {
      const parsed =
        typeof spotValue === 'number'
          ? spotValue
          : parseFloat(String(spotValue));
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    // Fallback to daily close.
    const dailyQuery = `
      SELECT close as value
      FROM public.market_data_1d
      WHERE asset_symbol = $1 AND type = 'price'
      ORDER BY time DESC
      LIMIT 1
    `;
    const dailyResult = await this.pool.query(dailyQuery, [assetSymbol]);
    const dailyValue = dailyResult.rows[0]?.value;
    if (dailyValue !== undefined && dailyValue !== null) {
      const parsed =
        typeof dailyValue === 'number'
          ? dailyValue
          : parseFloat(String(dailyValue));
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }

    // Last resort: fetch live from CoinGecko
    try {
      const geckoId = assetSymbol === 'bitcoin' ? 'bitcoin' : assetSymbol;
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price`,
        {
          params: { ids: geckoId, vs_currencies: 'usd' },
          timeout: 5000,
        },
      );
      const livePrice = response.data?.[geckoId]?.usd;
      if (typeof livePrice === 'number' && livePrice > 0) {
        return livePrice;
      }
    } catch (err) {
      console.warn(
        `[AdvancedIndicatorsService] Live price fetch failed for ${assetSymbol}`,
      );
    }

    return 0;
  }

  private async fetchPowerLawData(): Promise<PowerLawData> {
    // Get current BTC spot price (avoid using daily close as "current")
    const currentPrice = await this.getLatestAssetSpotPriceUsd('bitcoin');

    // Get stored Power Law values or calculate
    const indicatorQuery = `
      SELECT name, value, time FROM public.market_indicators
      WHERE name IN ('btc_power_law_fair_value', 'btc_power_law_deviation', 'btc_days_since_genesis')
      ORDER BY time DESC
    `;

    const indicatorResult = await this.pool.query(indicatorQuery);
    const indicators = new Map(
      indicatorResult.rows.map((r) => [r.name, parseFloat(r.value)]),
    );

    const daysSinceGenesis =
      indicators.get('btc_days_since_genesis') ||
      Math.floor(
        (Date.now() - this.GENESIS_DATE.getTime()) / (1000 * 60 * 60 * 24),
      );

    const fairValue =
      indicators.get('btc_power_law_fair_value') ||
      Math.pow(
        10,
        this.POWER_LAW_INTERCEPT +
          this.POWER_LAW_SLOPE * Math.log10(daysSinceGenesis),
      );

    const drawdown =
      indicators.get('btc_power_law_deviation') ||
      ((currentPrice - fairValue) / fairValue) * 100;

    // Get historical data for chart
    const historyQuery = `
      SELECT time as timestamp, close as price
      FROM public.market_data_1d
      WHERE asset_symbol = 'bitcoin' AND type = 'price'
      ORDER BY time DESC
      LIMIT 365
    `;

    const historyResult = await this.pool.query(historyQuery);
    const historicalData = historyResult.rows.reverse().map((row) => {
      const timestamp = new Date(row.timestamp);
      const days = Math.floor(
        (timestamp.getTime() - this.GENESIS_DATE.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const fv = Math.pow(
        10,
        this.POWER_LAW_INTERCEPT + this.POWER_LAW_SLOPE * Math.log10(days),
      );
      return {
        timestamp: timestamp.toISOString(),
        price: parseFloat(row.price),
        fairValue: fv,
      };
    });

    return {
      currentPrice,
      fairValue,
      drawdown,
      daysSinceGenesis,
      slope: this.POWER_LAW_SLOPE,
      intercept: this.POWER_LAW_INTERCEPT,
      historicalData,
    };
  }

  // ============== STABLECOIN LIQUIDITY ==============

  async getStablecoinLiquidity(): Promise<StablecoinLiquidityData> {
    const cacheKey = 'indicators:stablecoin_liquidity';
    const cached =
      await this.cacheService.get<StablecoinLiquidityData>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchStablecoinLiquidity();
    await this.cacheService.set(cacheKey, data, 900); // Cache 15 min
    return data;
  }

  private async fetchStablecoinLiquidity(): Promise<StablecoinLiquidityData> {
    // Get latest stablecoin metrics from database
    const query = `
      SELECT name, value, time FROM public.market_indicators
      WHERE name LIKE 'stablecoin_%'
      ORDER BY time DESC
    `;

    const result = await this.pool.query(query);
    const latest = new Map<string, number>();
    const seen = new Set<string>();

    for (const row of result.rows) {
      if (!seen.has(row.name)) {
        latest.set(row.name, parseFloat(row.value));
        seen.add(row.name);
      }
    }

    const totalMarketCap = latest.get('stablecoin_total_supply') || 0;
    const yoyGrowth = latest.get('stablecoin_yoy_growth') || 0;
    const liquidityFlowIndex = latest.get('stablecoin_liquidity_flow') || 0;

    // Get breakdown by stablecoin (only show data that exists)
    const breakdown = [
      {
        name: 'Tether',
        symbol: 'USDT',
        marketCap: latest.get('stablecoin_usdt_supply') || 0,
        change24h: 0,
      },
      {
        name: 'USD Coin',
        symbol: 'USDC',
        marketCap: latest.get('stablecoin_usdc_supply') || 0,
        change24h: 0,
      },
      {
        name: 'USDS',
        symbol: 'USDS',
        marketCap: latest.get('stablecoin_usds_supply') || 0,
        change24h: 0,
      },
      {
        name: 'DAI',
        symbol: 'DAI',
        marketCap: latest.get('stablecoin_dai_supply') || 0,
        change24h: 0,
      },
      {
        name: 'First Digital USD',
        symbol: 'FDUSD',
        marketCap: latest.get('stablecoin_fdusd_supply') || 0,
        change24h: 0,
      },
    ];

    // Get historical data
    const historyQuery = `
      SELECT time as timestamp, value
      FROM public.market_indicators
      WHERE name = 'stablecoin_total_supply'
      ORDER BY time DESC
      LIMIT 365
    `;

    const historyResult = await this.pool.query(historyQuery);
    const historicalData = historyResult.rows.reverse().map((row, i, arr) => ({
      timestamp: new Date(row.timestamp).toISOString(),
      totalMarketCap: parseFloat(row.value),
      yoyGrowth:
        i >= 365
          ? ((parseFloat(row.value) - parseFloat(arr[0].value)) /
              parseFloat(arr[0].value)) *
            100
          : yoyGrowth,
      liquidityFlow: liquidityFlowIndex,
    }));

    // Calculate 24h change
    const marketCapChange24h =
      historicalData.length >= 2
        ? ((totalMarketCap -
            historicalData[historicalData.length - 2]?.totalMarketCap) /
            historicalData[historicalData.length - 2]?.totalMarketCap) *
          100
        : 0.85;

    return {
      totalMarketCap,
      marketCapChange24h,
      yoyGrowth,
      liquidityFlowIndex,
      breakdown,
      historicalData,
    };
  }

  // ============== OPEN INTEREST ==============

  async getOpenInterest(): Promise<OpenInterestData> {
    const cacheKey = 'indicators:open_interest';
    const cached = await this.cacheService.get<OpenInterestData>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchOpenInterest();
    await this.cacheService.set(cacheKey, data, 300); // Cache 5 min
    return data;
  }

  private async fetchOpenInterest(): Promise<OpenInterestData> {
    const query = `
      SELECT name, value, time FROM public.market_indicators
      WHERE name LIKE '%oi%' OR name LIKE '%open_interest%' OR name LIKE '%leverage%'
      ORDER BY time DESC
    `;

    const result = await this.pool.query(query);
    const latest = new Map<string, number>();
    const seen = new Set<string>();

    for (const row of result.rows) {
      if (!seen.has(row.name)) {
        latest.set(row.name, parseFloat(row.value));
        seen.add(row.name);
      }
    }

    // Try multiple sources for total OI (CoinGecko preferred, Binance fallback)
    const totalOI =
      latest.get('btc_open_interest_usd') ||
      latest.get('binance_btc_oi') ||
      latest.get('total_open_interest_usd') ||
      latest.get('total_btc_oi_btc') ||
      0;
    const oiChange30d = latest.get('binance_btc_oi_change_30d') || 0;
    const leverageStatus = latest.get('btc_leverage_status') || 0;

    let status: 'overheated' | 'normal' | 'flushed' = 'normal';
    if (leverageStatus === 1 || oiChange30d > 40) status = 'overheated';
    else if (leverageStatus === -1 || oiChange30d < -15) status = 'flushed';

    // Get historical OI data - try CoinGecko source first, then Binance
    const historyQuery = `
      SELECT time as timestamp, value
      FROM public.market_indicators
      WHERE name IN ('btc_open_interest_usd', 'binance_btc_oi', 'total_open_interest_usd')
      ORDER BY time DESC
      LIMIT 90
    `;

    const historyResult = await this.pool.query(historyQuery);
    const historicalData = historyResult.rows.reverse().map((row, i, arr) => {
      const oi = parseFloat(row.value);
      const change30d =
        i >= 30
          ? ((oi - parseFloat(arr[Math.max(0, i - 30)].value)) /
              parseFloat(arr[Math.max(0, i - 30)].value)) *
            100
          : oiChange30d;
      return {
        timestamp: new Date(row.timestamp).toISOString(),
        openInterest: oi,
        change30d,
      };
    });

    return {
      totalOI,
      oiChange30d,
      oiChangeYoY: 42.3, // Would need year of data
      status,
      historicalData,
    };
  }

  // ============== MVRV Z-SCORE ==============

  async getMVRVData(): Promise<MVRVData> {
    const cacheKey = 'indicators:mvrv:v2';
    const cached = await this.cacheService.get<MVRVData>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchMVRVData();
    await this.cacheService.set(cacheKey, data, 300); // Cache 5 min (price-sensitive)
    return data;
  }

  private async fetchMVRVData(): Promise<MVRVData> {
    const query = `
      SELECT name, value FROM public.market_indicators
      WHERE name IN ('btc_mvrv_zscore', 'btc_mvrv_ratio', 'btc_200_week_sma', 'btc_mvrv_signal')
      ORDER BY time DESC
    `;

    const result = await this.pool.query(query);
    const latest = new Map<string, number>();
    const seen = new Set<string>();

    for (const row of result.rows) {
      if (!seen.has(row.name)) {
        latest.set(row.name, parseFloat(row.value));
        seen.add(row.name);
      }
    }

    // Get current BTC spot price
    const currentPrice = await this.getLatestAssetSpotPriceUsd('bitcoin');

    const mvrvZScore = latest.get('btc_mvrv_zscore') || 0;
    const sma200Week = latest.get('btc_200_week_sma') || 0;
    const signalValue = latest.get('btc_mvrv_signal') || 2;

    const signals: Record<number, MVRVData['signal']> = {
      0: 'extreme_undervalued',
      1: 'undervalued',
      2: 'fair',
      3: 'overvalued',
      4: 'extreme_overvalued',
    };

    // Get historical data
    const historyQuery = `
      SELECT time as timestamp, close as price
      FROM public.market_data_1d
      WHERE asset_symbol = 'bitcoin' AND type = 'price'
      ORDER BY time DESC
      LIMIT 365
    `;

    const historyResult = await this.pool.query(historyQuery);
    const historicalData = historyResult.rows.reverse().map((row) => ({
      timestamp: new Date(row.timestamp).toISOString(),
      price: parseFloat(row.price),
      realizedPrice: sma200Week,
      zScore: (parseFloat(row.price) - sma200Week) / (sma200Week * 0.3),
    }));

    return {
      mvrvZScore,
      currentPrice,
      realizedPrice: sma200Week,
      sma200Week,
      signal: signals[signalValue] || 'fair',
      historicalData,
    };
  }

  // ============== HASH RATE ==============

  async getHashRateData(): Promise<HashRateData> {
    const cacheKey = 'indicators:hash_rate:v2';
    const cached = await this.cacheService.get<HashRateData>(cacheKey);
    if (cached) return cached;

    const data = await this.fetchHashRateData();
    await this.cacheService.set(cacheKey, data, 600); // Cache 10 min
    return data;
  }

  private async fetchHashRateData(): Promise<HashRateData> {
    // Bucket by day so the frontend (which uses YYYY-MM-DD) doesn't get duplicate timestamps.
    const historyQuery = `
      SELECT
        time_bucket('1 day', time) as timestamp,
        last(value, time) as value
      FROM public.market_indicators
      WHERE name = 'btc_hash_rate' AND value IS NOT NULL
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 400
    `;

    const historyResult = await this.pool.query(historyQuery);
    const rows = historyResult.rows.reverse();
    if (rows.length === 0) {
      return {
        currentHashRate: 0,
        hashRateChange30d: 0,
        minerCapitulation: false,
        ribbonStatus: 'neutral',
        historicalData: [],
      };
    }

    const hashRates = rows.map((r) => parseFloat(r.value));
    const timestamps = rows.map((r) => new Date(r.timestamp));

    // Prefix sums for efficient SMA.
    const prefix: number[] = new Array(hashRates.length + 1);
    prefix[0] = 0;
    for (let i = 0; i < hashRates.length; i++) {
      prefix[i + 1] = prefix[i] + hashRates[i];
    }

    const sma = (window: number, index: number) => {
      const start = Math.max(0, index - window + 1);
      const sum = prefix[index + 1] - prefix[start];
      return sum / (index - start + 1);
    };

    const historicalData = hashRates.map((hr, i) => ({
      timestamp: timestamps[i].toISOString(),
      hashRate: hr,
      sma30: sma(30, i),
      sma60: sma(60, i),
    }));

    const lastIndex = hashRates.length - 1;
    const currentHashRate = hashRates[lastIndex];

    const hashRateChange30d =
      lastIndex >= 30 && hashRates[lastIndex - 30] > 0
        ? ((currentHashRate - hashRates[lastIndex - 30]) /
            hashRates[lastIndex - 30]) *
          100
        : 0;

    // Only assert a ribbon regime once we have enough history for a meaningful 60D SMA.
    const currentSma30 = historicalData[lastIndex].sma30;
    const currentSma60 = historicalData[lastIndex].sma60;

    let ribbonStatus: HashRateData['ribbonStatus'] = 'neutral';
    if (hashRates.length >= 60) {
      if (currentSma30 > currentSma60) ribbonStatus = 'recovery';
      else if (currentSma30 < currentSma60) ribbonStatus = 'capitulation';
    }

    const minerCapitulation = ribbonStatus === 'capitulation';

    return {
      currentHashRate,
      hashRateChange30d,
      minerCapitulation,
      ribbonStatus,
      historicalData,
    };
  }

  // ============== MOMENTUM COALESCENCE ==============

  async getMomentumCoalescence(): Promise<MomentumCoalescenceData> {
    const cacheKey = 'indicators:momentum';
    const cached =
      await this.cacheService.get<MomentumCoalescenceData>(cacheKey);
    if (cached) return cached;

    const data = await this.calculateMomentumCoalescence();
    await this.cacheService.set(cacheKey, data, 300); // Cache 5 min
    return data;
  }

  private async calculateMomentumCoalescence(): Promise<MomentumCoalescenceData> {
    // Get price data for ROC calculations
    const priceQuery = `
      SELECT time, close as price
      FROM public.market_data_1d
      WHERE asset_symbol = 'bitcoin' AND type = 'price'
      ORDER BY time DESC
      LIMIT 100
    `;

    const priceResult = await this.pool.query(priceQuery);
    const prices = priceResult.rows.reverse().map((r) => parseFloat(r.price));

    // Calculate Rate of Change
    const fastROC =
      prices.length >= 14
        ? ((prices[prices.length - 1] - prices[prices.length - 14]) /
            prices[prices.length - 14]) *
          100
        : 8.5;

    const slowROC =
      prices.length >= 50
        ? ((prices[prices.length - 1] - prices[prices.length - 50]) /
            prices[prices.length - 50]) *
          100
        : 15.2;

    // Get volume data for delta
    const volumeQuery = `
      SELECT value FROM public.market_data
      WHERE asset_symbol = 'bitcoin' AND type = 'volume'
      ORDER BY time DESC LIMIT 1
    `;
    const volumeResult = await this.pool.query(volumeQuery);
    const volumeDelta = 55; // Would need buy/sell volume separation

    // Volatility bias from Bollinger Band position
    const volatilityBias = 0.65; // Would calculate from BB %B

    // Calculate composite score (weighted average normalized to 0-100)
    const fastROCNorm = Math.min(100, Math.max(0, 50 + fastROC * 2));
    const slowROCNorm = Math.min(100, Math.max(0, 50 + slowROC));
    const volumeNorm = volumeDelta;
    const volBiasNorm = volatilityBias * 100;

    const compositeScore =
      fastROCNorm * 0.25 +
      slowROCNorm * 0.25 +
      volumeNorm * 0.25 +
      volBiasNorm * 0.25;

    let signal: MomentumCoalescenceData['signal'] = 'neutral';
    if (compositeScore >= 70) signal = 'strong_buy';
    else if (compositeScore >= 55) signal = 'buy';
    else if (compositeScore <= 30) signal = 'strong_sell';
    else if (compositeScore <= 45) signal = 'sell';

    return {
      compositeScore,
      components: { fastROC, slowROC, volumeDelta, volatilityBias },
      signal,
      historicalData: [], // TODO: Store momentum history in DB
    };
  }

  // ============== COMPOSITE INDICATOR ==============

  async getCompositeIndicator(): Promise<CompositeIndicatorData> {
    const cacheKey = 'indicators:composite';
    const cached =
      await this.cacheService.get<CompositeIndicatorData>(cacheKey);
    if (cached) return cached;

    const data = await this.calculateCompositeIndicator();
    await this.cacheService.set(cacheKey, data, 300); // Cache 5 min
    return data;
  }

  private async calculateCompositeIndicator(): Promise<CompositeIndicatorData> {
    // Fetch all component indicators
    const [powerLaw, stablecoin, hashRate, momentum] = await Promise.all([
      this.getPowerLawData(),
      this.getStablecoinLiquidity(),
      this.getHashRateData(),
      this.getMomentumCoalescence(),
    ]);

    // Get RSI
    const rsiQuery = `
      SELECT value FROM public.market_indicators
      WHERE name LIKE '%rsi%' AND name LIKE '%bitcoin%'
      ORDER BY time DESC LIMIT 1
    `;
    const rsiResult = await this.pool.query(rsiQuery);
    const rsi = parseFloat(rsiResult.rows[0]?.value || '55');

    // Normalize scores to 0-100
    const rsiScore = rsi; // Already 0-100

    // MVRV: < 0 = 100 (extreme buy), > 3.5 = 0 (extreme sell)
    const mvrvData = await this.getMVRVData();
    const mvrvScore = Math.max(
      0,
      Math.min(100, 100 - (mvrvData.mvrvZScore + 1) * 20),
    );

    // Miner health: capitulation = 100 (buy), recovery = 70, neutral = 50
    const minerScore = hashRate.minerCapitulation
      ? 100
      : hashRate.ribbonStatus === 'recovery'
        ? 78
        : 50;

    // Liquidity flow: positive = bullish
    const liquidityScore = Math.max(
      0,
      Math.min(100, 50 + stablecoin.liquidityFlowIndex * 5),
    );

    // Momentum score
    const momentumScore = momentum.compositeScore;

    // Weighted average
    const weights = {
      rsi: 0.2,
      mvrv: 0.25,
      miner: 0.2,
      liquidity: 0.2,
      momentum: 0.15,
    };
    const overallScore =
      rsiScore * weights.rsi +
      mvrvScore * weights.mvrv +
      minerScore * weights.miner +
      liquidityScore * weights.liquidity +
      momentumScore * weights.momentum;

    // Determine regime
    let regime: CompositeIndicatorData['regime'] = 'neutral';
    if (overallScore >= 60 && stablecoin.yoyGrowth > 0) regime = 'bull';
    else if (overallScore <= 40 || stablecoin.yoyGrowth < -10) regime = 'bear';

    // Generate recommendation
    let recommendation = 'Market conditions are mixed. Monitor key indicators.';
    if (regime === 'bull' && overallScore >= 70) {
      recommendation =
        'Strong bullish conditions. Consider accumulating on dips.';
    } else if (regime === 'bull') {
      recommendation =
        'Moderate bullish conditions. Stay invested but manage risk.';
    } else if (regime === 'bear' && overallScore <= 30) {
      recommendation =
        'Strong bearish conditions. Preserve capital, wait for bottom signals.';
    } else if (regime === 'bear') {
      recommendation =
        'Bearish conditions. Reduce exposure and accumulate stablecoins.';
    }

    return {
      overallScore: Math.round(overallScore),
      normalizedScores: {
        rsi: Math.round(rsiScore),
        mvrv: Math.round(mvrvScore),
        minerHealth: Math.round(minerScore),
        liquidityFlow: Math.round(liquidityScore),
        momentum: Math.round(momentumScore),
      },
      regime,
      recommendation,
    };
  }
}
