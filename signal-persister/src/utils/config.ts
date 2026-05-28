import dotenv from "dotenv";
import { getEnv } from "@financialsignalsgatheringsystem/common";

dotenv.config();

export const config = {
  RABBITMQ_URL: getEnv("RABBITMQ_URL", { required: true }),
  DB_HOST: getEnv("DB_HOST", { required: true }),
  DB_PORT: getEnv("DB_PORT", { required: true }),
  DB_USER: getEnv("DB_USER", { required: true }),
  DB_PASSWORD: getEnv("DB_PASSWORD", { required: true }),
  DB_NAME: getEnv("DB_NAME", { required: true }),
};
