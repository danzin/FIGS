import { Controller, Get, Param } from '@nestjs/common';
import {
  AnalyticsService,
  CorrelationData,
  RsiData,
  VolatilityState,
  MarketHeartbeatData,
  OnChainMetricsByAsset,
} from '../services/analytics.service';

@Controller('v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /v1/analytics/correlation
   * Returns the correlation matrix for major assets (BTC, ETH, SPY, GOLD)
   */
  @Get('correlation')
  async getCorrelationMatrix(): Promise<CorrelationData> {
    return this.analyticsService.getCorrelationMatrix();
  }

  /**
   * GET /v1/analytics/rsi-heatmap
   * Returns RSI values for top crypto assets
   */
  @Get('rsi-heatmap')
  async getRsiHeatmap(): Promise<RsiData[]> {
    return this.analyticsService.getRsiHeatmap();
  }

  /**
   * GET /v1/analytics/volatility-squeeze/:symbol
   * Returns volatility squeeze analysis for a specific asset
   */
  @Get('volatility-squeeze/:symbol')
  async getVolatilitySqueeze(
    @Param('symbol') symbol: string,
  ): Promise<VolatilityState> {
    return this.analyticsService.getVolatilitySqueeze(symbol);
  }

  /**
   * GET /v1/analytics/market-heartbeat
   * Returns live market metrics for the header (BTC, ETH, Gas, Fear/Greed)
   */
  @Get('market-heartbeat')
  async getMarketHeartbeat(): Promise<MarketHeartbeatData> {
    return this.analyticsService.getMarketHeartbeat();
  }

  /**
   * GET /v1/analytics/whale-movements/:symbol
   * Returns detected whale movements for an asset
   */
  @Get('whale-movements/:symbol')
  async getWhaleMovements(
    @Param('symbol') symbol: string,
  ): Promise<{ time: string; volume: number }[]> {
    return this.analyticsService.getWhaleMovements(symbol);
  }

  /**
   * GET /v1/analytics/developer-activity
   * Returns GitHub commit activity for major blockchain projects
   */
  @Get('developer-activity')
  async getDeveloperActivity(): Promise<
    { asset: string; commits: number; contributors: number }[]
  > {
    return this.analyticsService.getDeveloperActivity();
  }

  /**
   * GET /v1/analytics/network-metrics
   * Returns on-chain network health metrics (tx counts, hash rates, etc.)
   */
  @Get('network-metrics')
  async getNetworkMetrics(): Promise<
    Record<string, { value: number; label: string }[]>
  > {
    return this.analyticsService.getNetworkMetrics();
  }

  /**
   * GET /v1/analytics/onchain
   * Returns on-chain metrics: active addresses, hash rate, dev activity per asset
   */
  @Get('onchain')
  async getOnChainMetrics(): Promise<OnChainMetricsByAsset> {
    return this.analyticsService.getOnChainMetrics();
  }
}
