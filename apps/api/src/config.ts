import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  JWT_SECRET: z.string().min(16).default('virtual-mandi-development-secret'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(300).default(2_592_000),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

const parsedConfig = configSchema.parse(process.env);
export const config = {
  ...parsedConfig,
  corsOrigins: parsedConfig.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
};

if (config.NODE_ENV === 'production' && config.JWT_SECRET === 'virtual-mandi-development-secret') {
  throw new Error('JWT_SECRET must be configured in production');
}
