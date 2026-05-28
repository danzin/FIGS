import axios from "axios";
import {
  DataSource,
  MarketDataPoint,
} from "@financialsignalsgatheringsystem/common";
import { toServiceError } from "../utils/errors";

/**
 * Fetches historical Bitcoin price data for Power Law and MVRV calculations
 * Uses CoinGecko market chart endpoint for long-term data
 */

interface CoinGeckoMarketChartResponse {
  prices: [number, number][]; // [timestamp, price]
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export class BitcoinHistoricalSource implements DataSource {
  public readonly key = "bitcoin_historical";
  private readonly genesisDate = new Date("2009-01-03"); // Bitcoin genesis block

  async fetch(): Promise<MarketDataPoint[] | null> {
    const now = new Date();
    const results: MarketDataPoint[] = [];

    try {
      // Fetch 200 weeks of data for 200-week SMA (realized price proxy)
      const response = await axios.get<CoinGeckoMarketChartResponse>(
        "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
        {
          params: {
            vs_currency: "usd",
            days: 1400, // ~200 weeks
            interval: "daily",
          },
          headers: { Accept: "application/json" },
          timeout: 30000,
        },
      );

      const prices = response.data?.prices;
      if (!prices || prices.length === 0) {
        console.warn("[BitcoinHistoricalSource] No price data received");
        return null;
      }

      // Store last 30 days of detailed price data for charts
      const last30Days = prices.slice(-30);
      for (const [timestamp, price] of last30Days) {
        results.push({
          time: new Date(timestamp),
          asset_symbol: "bitcoin",
          type: "price_historical",
          value: price,
          source: "CoinGecko",
        });
      }

      return results;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw toServiceError(
          error,
          {
            operation: "fetch",
            service: "data-collector",
            sourceKey: this.key,
            provider: "CoinGecko",
          },
          "CoinGecko rate limit exceeded.",
        );
      }
      throw toServiceError(
        error,
        {
          operation: "fetch",
          service: "data-collector",
          sourceKey: this.key,
          provider: "CoinGecko",
        },
        "Failed to fetch Bitcoin historical price data.",
      );
    }
  }
}

/**
 * Calculates Power Law fair value and MVRV Z-Score
 * These are derived indicators computed from stored price data
 */
export class PowerLawIndicatorSource implements DataSource {
  public readonly key = "power_law_indicator";
  private readonly genesisDate = new Date("2009-01-03");

  // Power Law "Pro" params (On-Chain Mind / Santostasi model)
  // For 6,202 days (Dec 2025): 10^(-17.06 + 5.83 * 3.7925) = $112,000
  private readonly slope = 5.83;
  private readonly intercept = -17.06;

  async fetch(): Promise<
    { name: string; time: Date; value: number; source: string }[] | null
  > {
    const now = new Date();
    const results: {
      name: string;
      time: Date;
      value: number;
      source: string;
    }[] = [];

    try {
      // Get current BTC price
      const priceResponse = await axios.get(
        "https://api.coingecko.com/api/v3/simple/price",
        {
          params: { ids: "bitcoin", vs_currencies: "usd" },
          timeout: 10000,
        },
      );

      const currentPrice = priceResponse.data?.bitcoin?.usd;
      if (!currentPrice) return null;

      // Calculate days since genesis
      const daysSinceGenesis = Math.floor(
        (now.getTime() - this.genesisDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Calculate Power Law fair value
      // Formula: log(Price) = intercept + slope * log(days)
      const fairValue = Math.pow(
        10,
        this.intercept + this.slope * Math.log10(daysSinceGenesis),
      );

      results.push({
        name: "btc_power_law_fair_value",
        time: now,
        value: fairValue,
        source: "Calculated",
      });

      // Calculate deviation from fair value (drawdown)
      const deviation = ((currentPrice - fairValue) / fairValue) * 100;
      results.push({
        name: "btc_power_law_deviation",
        time: now,
        value: deviation,
        source: "Calculated",
      });

      results.push({
        name: "btc_days_since_genesis",
        time: now,
        value: daysSinceGenesis,
        source: "Calculated",
      });

      // Now calculate MVRV using 200-week SMA as realized price proxy
      const marketChartResponse = await axios.get<CoinGeckoMarketChartResponse>(
        "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart",
        {
          params: {
            vs_currency: "usd",
            days: 1400,
            interval: "daily",
          },
          timeout: 30000,
        },
      );

      const prices = marketChartResponse.data?.prices;
      if (prices && prices.length >= 1400) {
        // Calculate 200-week (1400 day) SMA as realized price proxy
        const sum = prices.reduce((acc, [, price]) => acc + price, 0);
        const sma200Week = sum / prices.length;

        results.push({
          name: "btc_200_week_sma",
          time: now,
          value: sma200Week,
          source: "Calculated",
        });

        // Calculate MVRV ratio and Z-score
        // MVRV = Market Value / Realized Value
        // Z-Score = (Market Cap - Realized Cap) / Std Dev
        const mvrvRatio = currentPrice / sma200Week;
        results.push({
          name: "btc_mvrv_ratio",
          time: now,
          value: mvrvRatio,
          source: "Calculated",
        });

        // Calculate Z-score using standard deviation
        const priceValues = prices.map(([, p]) => p);
        const mean = sum / priceValues.length;
        const squaredDiffs = priceValues.map((p) => Math.pow(p - mean, 2));
        const stdDev = Math.sqrt(
          squaredDiffs.reduce((a, b) => a + b, 0) / priceValues.length,
        );

        const zScore = (currentPrice - sma200Week) / stdDev;
        results.push({
          name: "btc_mvrv_zscore",
          time: now,
          value: zScore,
          source: "Calculated",
        });

        // Determine signal based on Z-score thresholds
        // < 0: extreme undervalued, 0-1: undervalued, 1-2.5: fair, 2.5-3.5: overvalued, > 3.5: extreme
        let signal = 2; // fair
        if (zScore < 0)
          signal = 0; // extreme undervalued
        else if (zScore < 1)
          signal = 1; // undervalued
        else if (zScore > 3.5)
          signal = 4; // extreme overvalued
        else if (zScore > 2.5) signal = 3; // overvalued

        results.push({
          name: "btc_mvrv_signal",
          time: now,
          value: signal,
          source: "Calculated",
        });
      }

      console.log(
        `[PowerLawIndicatorSource] Calculated ${results.length} indicators`,
      );
      return results;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw toServiceError(
          error,
          {
            operation: "fetch",
            service: "data-collector",
            sourceKey: this.key,
            provider: "CoinGecko",
          },
          "CoinGecko rate limit exceeded.",
        );
      }
      throw toServiceError(
        error,
        {
          operation: "fetch",
          service: "data-collector",
          sourceKey: this.key,
          provider: "CoinGecko",
        },
        "Failed to calculate power law indicators.",
      );
    }
  }
}
