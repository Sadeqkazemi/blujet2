import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string;

  @IsNumberString()
  PORT: string;

  @IsNotEmpty()
  DATABASE_URL: string;

  @IsNotEmpty()
  REDIS_URL: string;

  @IsNotEmpty()
  JWT_ACCESS_SECRET: string;

  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsNotEmpty()
  ML_SERVICE_URL: string;

  @IsNotEmpty()
  ML_SERVICE_INTERNAL_TOKEN: string;

  /** 32-byte hex key for AES-256-GCM PII encryption (national IDs etc.). */
  @IsNotEmpty()
  PII_ENCRYPTION_KEY: string;

  @IsOptional()
  SENTRY_DSN?: string;

  @IsOptional()
  CORS_ORIGINS?: string;

  /** Real Anthropic API key for SurveySummaryProvider (Phase 66) — absent
   * in dev/tests, in which case the provider degrades to null (no crash,
   * no summary). Never required, unlike ML_SERVICE_*. */
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  /** Base URL used only to build the public survey link sent by SMS
   * (Phase 66). Falls back to the local dev frontend origin when unset. */
  @IsOptional()
  FRONTEND_URL?: string;

  /** Explicit opt-in for deterministic OTP in a hosted production-mode UAT. */
  @IsOptional()
  @IsIn(['true', 'false'])
  AUTH_SANDBOX_ENABLED?: string;

  @IsOptional()
  @IsNumberString()
  AUTH_SANDBOX_OTP?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => Object.values(e.constraints ?? {}).join(', '))
        .join('\n')}`,
    );
  }

  return validated;
}
