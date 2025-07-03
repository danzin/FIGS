"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Utility function to get env variables with a check.
function getEnv(key, required = true) {
    const value = process.env[key];
    if (required && !value) {
        console.error(`Missing required environment variable: ${key}`);
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}
exports.config = {
    RABBITMQ_URL: getEnv("RABBITMQ_URL"),
    DB_HOST: getEnv("DB_HOST"),
    DB_PORT: getEnv("DB_PORT"),
    DB_USER: getEnv("DB_USER"),
    DB_PASSWORD: getEnv("DB_PASSWORD"),
    DB_NAME: getEnv("DB_NAME"),
};
