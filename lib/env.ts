import { z } from "zod";
import { loadEnvConfig } from "@next/env";

// Next.js loads .env.local for the web server, but standalone scripts run by
// tsx do not. Loading it here gives both entry points the same configuration.
loadEnvConfig(process.cwd());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  SECRETS_ENCRYPTION_KEY: z.string().min(16),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY,
  APP_URL: process.env.APP_URL,
});
