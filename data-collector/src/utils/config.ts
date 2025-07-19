import dotenv from "dotenv";
dotenv.config();

function getEnv(key: string, required: boolean = true): string | undefined {
	const value = process.env[key];
	if (required && !value) {
		console.error(`Missing required environment variable: ${key}`);
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

export const config = {
	FRED_API_KEY: getEnv("FRED_API_KEY"),
	// COINGECKO_API_URL: getEnv("COINGECKO_API_URL"),
	RABBITMQ_URL: getEnv("RABBITMQ_URL"),
	CRON_SCHEDULE: getEnv("CRON_SCHEDULE"),
	PORT: getEnv("PORT"),
	HEALTH_HEAP_WARNING_MB: parseInt(process.env.HEALTH_HEAP_WARNING_MB || "512", 10),
	HEALTH_HEAP_CRITICAL_MB: parseInt(process.env.HEALTH_HEAP_CRITICAL_MB || "768", 10),
	MONITOR_CHECK_INTERVAL_CRON: process.env.MONITOR_CHECK_INTERVAL_CRON || "*/5 * * * *",
};
