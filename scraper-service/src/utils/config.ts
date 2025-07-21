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
	RABBITMQ_URL: getEnv("RABBITMQ_URL"),
	CRON_SCHEDULE: getEnv("CRON_SCHEDULE"),
	PORT: getEnv("PORT"),
	MONITOR_CHECK_INTERVAL_CRON: process.env.MONITOR_CHECK_INTERVAL_CRON || "*/5 * * * *",
};
