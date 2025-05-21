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
	PORT: parseInt(process.env.PORT || "3000", 10),
	NODE_ENV: process.env.NODE_ENV || "development",

	// DB_HOST: getEnv("DB_HOST"),
	// DB_PORT: parseInt(getEnv("DB_PORT") || "5432", 10),
	// DB_USER: getEnv("DB_USER"),
	// DB_PASSWORD: getEnv("DB_PASSWORD"),
	// DB_NAME: getEnv("DB_NAME"),
};
