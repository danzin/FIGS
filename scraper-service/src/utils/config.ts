import dotenv from "dotenv";
import { getEnv } from "@financialsignalsgatheringsystem/common";

dotenv.config();

export const config = {
  RABBITMQ_URL: getEnv("RABBITMQ_URL"),
  CRON_SCHEDULE: getEnv("CRON_SCHEDULE"),
  PORT: getEnv("PORT"),
  MONITOR_CHECK_INTERVAL_CRON:
    process.env.MONITOR_CHECK_INTERVAL_CRON || "*/5 * * * *",
};
