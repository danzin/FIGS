"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinGeckoIndicatorSource = void 0;
const axios_1 = __importDefault(require("axios"));
class CoinGeckoIndicatorSource {
    constructor(metric) {
        this.metric = metric;
        this.key = `coingecko_${metric}`;
    }
    async fetch() {
        if (this.metric === "btc_dominance") {
            return this.fetchBitcoinDominance();
        }
        console.warn(`[CoinGeckoIndicatorSource] Metric '${this.metric}' is not supported.`);
        return null;
    }
    async fetchBitcoinDominance() {
        try {
            const response = await axios_1.default.get("https://api.coingecko.com/api/v3/global", {
                headers: { Accept: "application/json" },
            });
            const dominance = response.data?.data?.market_cap_percentage?.btc;
            if (typeof dominance !== "number" || isNaN(dominance)) {
                console.warn(`[CoinGeckoIndicatorSource] Invalid Bitcoin dominance value received: ${dominance}`);
                return null;
            }
            return {
                name: "btc_dominance",
                time: new Date(),
                value: dominance,
                source: "CoinGecko",
            };
        }
        catch (error) {
            console.error(`[CoinGeckoIndicatorSource] Error fetching Bitcoin dominance:`, error);
            if (axios_1.default.isAxiosError(error) && error.response?.status === 429) {
                throw new Error(`CoinGecko rate limit exceeded for '${this.key}'`);
            }
            throw error;
        }
    }
}
exports.CoinGeckoIndicatorSource = CoinGeckoIndicatorSource;
//# sourceMappingURL=CoinGeckoIndicatorSource.js.map