
import dotenv from "dotenv";
import { z } from "zod";
import { resolve } from "path";
import { existsSync } from "node:fs";

// Load .env from the project root or current directory
const localEnvPath = resolve(process.cwd(), ".env");
const rootEnvPath = resolve(process.cwd(), "..", ".env");

const envPath = existsSync(localEnvPath)
  ? localEnvPath
  : rootEnvPath;

const dotenvResult = dotenv.config({ path: envPath });

console.log("Loading environment file:", envPath);

if (dotenvResult.error) {
  console.error("Failed to load .env file:", dotenvResult.error.message);
}

const envSchema = z.object({
  // Application
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().default(5000),

  FRONTEND_URL: z
    .string()
    .url()
    .default("http://localhost:5173"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Redis
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),

  // Elasticsearch
  ELASTICSEARCH_URL: z
    .string()
    .url()
    .default("http://localhost:9200"),

  // JWT Authentication
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),

  // Google OAuth
  GOOGLE_CLIENT_ID: z
    .string()
    .min(1, "GOOGLE_CLIENT_ID is required"),

  GOOGLE_CLIENT_SECRET: z
    .string()
    .min(1, "GOOGLE_CLIENT_SECRET is required"),

  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default("http://localhost:5000/api/auth/google/callback"),

  // Session
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters"),

  // Rate Limiting
  SENDER_RATE_LIMIT_PER_HOUR: z.coerce
    .number()
    .int()
    .min(0)
    .default(50),

  GLOBAL_RATE_LIMIT_PER_HOUR: z.coerce
    .number()
    .int()
    .min(0)
    .default(500),

  // Worker Configuration
  WORKER_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(3),

  MIN_SEND_DELAY_MS: z.coerce
    .number()
    .int()
    .min(0)
    .default(500),

  MAX_RECIPIENT_RETRIES: z.coerce
    .number()
    .int()
    .positive()
    .default(3),

  // Distributed Lease Configuration
  LEASE_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(45000),

  HEARTBEAT_INTERVAL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(15000),

  // Recovery Configuration
  RECOVERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(120000),

  RECOVERY_POLL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(60000),
});

// Validate environment variables
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Invalid environment configuration:");
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
