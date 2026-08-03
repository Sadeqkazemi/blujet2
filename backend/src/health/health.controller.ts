import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly typeOrmIndicator: TypeOrmHealthIndicator,
  ) {}

  // Public, unauthenticated, rate-limit-exempt — used by Docker healthcheck + uptime monitoring.
  @Get()
  @ApiExcludeEndpoint()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.typeOrmIndicator.pingCheck('database'),
      () => ({
        build: {
          status: 'up',
          version: process.env.npm_package_version ?? 'dev',
          commit: process.env.GIT_COMMIT_SHA ?? 'unknown',
        },
      }),
    ]);
  }
}
