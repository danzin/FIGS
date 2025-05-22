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
	DB_HOST: getEnv("DB_HOST"),
	DB_PORT: getEnv("DB_PORT"),
	DB_USER: getEnv("DB_USER"),
	DB_PASSWORD: getEnv("DB_PASSWORD"),
	DB_NAME: getEnv("DB_NAME"),
};
