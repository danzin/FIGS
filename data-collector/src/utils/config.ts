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
};
