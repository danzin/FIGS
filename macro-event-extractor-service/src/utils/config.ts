import dotenv from "dotenv";
import {
  getEnv,
  parseIntegerEnv,
} from "@financialsignalsgatheringsystem/common";

dotenv.config();

export const config = {
  RABBITMQ_URL: getEnv("RABBITMQ_URL", { required: true }),
  DB_HOST: getEnv("DB_HOST", { required: true }),
  DB_PORT: getEnv("DB_PORT", {
    defaultValue: 5432,
    parse: parseIntegerEnv,
  }),
  DB_USER: getEnv("DB_USER", { required: true }),
  DB_PASSWORD: getEnv("DB_PASSWORD", { required: true }),
  DB_NAME: getEnv("DB_NAME", { required: true }),
  EXTRACTION_MODEL: process.env.EXTRACTION_MODEL || "heuristic-extractor-v1",
  EXTRACTION_VERSION: process.env.EXTRACTION_VERSION || "v1",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "embedding-stub-v1",
};
