import { loadEnvConfig } from "@next/env";
import { z } from "zod";

// Scripts need .env.local too, while container secrets arrive only at runtime.
// Do not validate here: Next.js can evaluate server modules during `next build`.
loadEnvConfig(process.cwd());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  SECRETS_ENCRYPTION_KEY: z.string().min(16),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type AppEnv = z.infer<typeof envSchema>;
let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse({
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      SECRETS_ENCRYPTION_KEY: process.env.SECRETS_ENCRYPTION_KEY,
      APP_URL: process.env.APP_URL,
    });
  }
  return cachedEnv;
}
