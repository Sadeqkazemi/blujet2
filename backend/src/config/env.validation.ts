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

  @IsOptional()
  SENTRY_DSN?: string;

  @IsOptional()
  CORS_ORIGINS?: string;
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
