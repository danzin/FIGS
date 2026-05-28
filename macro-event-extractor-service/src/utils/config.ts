import dotenv from "dotenv";
import {
  getEnv,
  parseIntegerEnv,
} from "@financialsignalsgatheringsystem/common";

dotenv.config();

export const config = {
  RABBITMQ_URL: getEnv("RABBITMQ_URL"),
  DB_HOST: getEnv("DB_HOST"),
  DB_PORT: getEnv("DB_PORT", {
    defaultValue: 5432,
    parse: parseIntegerEnv,
  }),
  DB_USER: getEnv("DB_USER"),
  DB_PASSWORD: getEnv("DB_PASSWORD"),
  DB_NAME: getEnv("DB_NAME"),
  EXTRACTION_MODEL: process.env.EXTRACTION_MODEL || "heuristic-extractor-v1",
  EXTRACTION_VERSION: process.env.EXTRACTION_VERSION || "v1",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "embedding-stub-v1",
};
