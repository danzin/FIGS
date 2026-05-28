import dotenv from "dotenv";
import { getEnv } from "@financialsignalsgatheringsystem/common";

dotenv.config();

export const config = {
  RABBITMQ_URL: getEnv("RABBITMQ_URL"),
  DB_HOST: getEnv("DB_HOST"),
  DB_PORT: getEnv("DB_PORT"),
  DB_USER: getEnv("DB_USER"),
  DB_PASSWORD: getEnv("DB_PASSWORD"),
  DB_NAME: getEnv("DB_NAME"),
};
