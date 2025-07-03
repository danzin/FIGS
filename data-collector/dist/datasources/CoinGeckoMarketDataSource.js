"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinGeckoMarketDataSource = void 0;
const axios_1 = __importDefault(require("axios"));
class CoinGeckoMarketDataSource {
    constructor(coinGeckoId) {
        this.coinGeckoId = coinGeckoId;
        this.key = `coingecko_market_data_${coinGeckoId}`;
    }
    async fetch() {
        try {
            const response = await axios_1.default.get(`https://api.coingecko.com/api/v3/simple/price`, {
                params: {
                    ids: this.coinGeckoId,
                    vs_currencies: "usd",
                    include_market_cap: "true",
                    include_24hr_vol: "true",
                },
                headers: { Accept: "application/json" },
            });
            const coinData = response.data?.[this.coinGeckoId];
            if (!coinData) {
                console.warn(`[CoinGeckoMarketDataSource] No data returned for ID '${this.coinGeckoId}' from CoinGecko`);
                return null;
            }
            const timestamp = new Date();
            const results = [];
            // Create Price Data Point
            const priceValue = coinData.usd;
            if (typeof priceValue === "number" && !isNaN(priceValue)) {
                results.push({
                    time: timestamp,
                    asset_symbol: this.coinGeckoId, // Use the ID as the asset symbol
                    type: "price",
                    value: priceValue,
                    source: "CoinGecko",
                });
            }
            else {
                console.warn(`[CoinGeckoMarketDataSource] Invalid price value for '${this.coinGeckoId}': ${priceValue}`);
            }
            // Create Volume Data Point
            const volumeValue = coinData.usd_24h_vol;
            if (typeof volumeValue === "number" && !isNaN(volumeValue)) {
                results.push({
                    time: timestamp,
                    asset_symbol: this.coinGeckoId,
                    type: "volume",
                    value: volumeValue,
                    source: "CoinGecko",
                });
            }
            else {
                console.warn(`[CoinGeckoMarketDataSource] Invalid volume value for '${this.coinGeckoId}': ${volumeValue}`);
            }
            return results.length > 0 ? results : null;
        }
        catch (error) {
            console.error(`[CoinGeckoMarketDataSource] Error fetching data for '${this.coinGeckoId}':`, error);
            if (axios_1.default.isAxiosError(error) && error.response?.status === 429) {
                throw new Error(`CoinGecko rate limit exceeded for '${this.key}'`);
            }
            throw error;
        }
    }
}
exports.CoinGeckoMarketDataSource = CoinGeckoMarketDataSource;
//# sourceMappingURL=CoinGeckoMarketDataSource.js.map