"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FearGreedSource = void 0;
const axios_1 = __importDefault(require("axios"));
class FearGreedSource {
    constructor() {
        this.key = "fear_greed_index";
    }
    async fetch() {
        try {
            const response = await axios_1.default.get("https://api.alternative.me/fng/", {
                headers: {
                    Accept: "application/json",
                },
                timeout: 10000,
            });
            const data = response.data?.data?.[0];
            if (!data) {
                console.warn("No Fear & Greed data returned");
                return null;
            }
            const value = parseInt(data.value);
            const timestamp = new Date(parseInt(data.timestamp) * 1000);
            if (isNaN(value) || value < 0 || value > 100) {
                console.warn(`Invalid Fear & Greed value: ${data.value}`);
                return null;
            }
            if (isNaN(timestamp.getTime())) {
                console.warn(`Invalid Fear & Greed timestamp: ${data.timestamp}`);
                return null;
            }
            return {
                name: this.key,
                timestamp,
                value,
                source: "Alternative.me",
            };
        }
        catch (error) {
            console.error("Error fetching Fear & Greed Index:", error);
            if (axios_1.default.isAxiosError(error) && error.response?.status === 429) {
                throw new Error("Fear & Greed API rate limit exceeded");
            }
            throw error;
        }
    }
}
exports.FearGreedSource = FearGreedSource;
//# sourceMappingURL=feargreed.js.map