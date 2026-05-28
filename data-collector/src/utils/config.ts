import dotenv from "dotenv";
import {
  getEnv,
  parseIntegerEnv,
} from "@financialsignalsgatheringsystem/common";

dotenv.config();

export const config = {
  FRED_API_KEY: getEnv("FRED_API_KEY"),
  // COINGECKO_API_URL: getEnv("COINGECKO_API_URL"),
  RABBITMQ_URL: getEnv("RABBITMQ_URL", { required: true }),
  CRON_SCHEDULE: getEnv("CRON_SCHEDULE"),
  PORT: getEnv("PORT", { required: true }),
  HEALTH_HEAP_WARNING_MB: getEnv("HEALTH_HEAP_WARNING_MB", {
    defaultValue: 512,
    parse: parseIntegerEnv,
  }),
  HEALTH_HEAP_CRITICAL_MB: getEnv("HEALTH_HEAP_CRITICAL_MB", {
    defaultValue: 768,
    parse: parseIntegerEnv,
  }),
  MONITOR_CHECK_INTERVAL_CRON:
    process.env.MONITOR_CHECK_INTERVAL_CRON || "*/5 * * * *",
  // Optional API keys for enhanced data sources
  ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY || "",
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || "",
  OWLRACLE_API_KEY: process.env.OWLRACLE_API_KEY || "",
};
