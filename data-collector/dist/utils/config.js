"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function getEnv(key, required = true) {
    const value = process.env[key];
    if (required && !value) {
        console.error(`Missing required environment variable: ${key}`);
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
exports.config = {
    FRED_API_KEY: getEnv("FRED_API_KEY"),
    // COINGECKO_API_URL: getEnv("COINGECKO_API_URL"),
    RABBITMQ_URL: getEnv("RABBITMQ_URL"),
    CRON_SCHEDULE: getEnv("CRON_SCHEDULE"),
    PORT: getEnv("PORT"),
    HEALTH_HEAP_WARNING_MB: parseInt(process.env.HEALTH_HEAP_WARNING_MB || "512", 10),
    HEALTH_HEAP_CRITICAL_MB: parseInt(process.env.HEALTH_HEAP_CRITICAL_MB || "768", 10),
    MONITOR_CHECK_INTERVAL_CRON: process.env.MONITOR_CHECK_INTERVAL_CRON || "*/5 * * * *",
    API_NINJAS_KEY: getEnv("API_NINJAS_KEY"),
};
//# sourceMappingURL=config.js.map