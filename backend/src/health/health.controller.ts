import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeORMHealthIndicator,
} from '@nestjs/terminus';
import { TypeORMService } from '../typeorm/typeorm.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly typeormIndicator: TypeORMHealthIndicator,
    private readonly typeorm: TypeORMService,
  ) {}

  // Public, unauthenticated, rate-limit-exempt — used by Docker healthcheck + uptime monitoring.
  @Get()
  @ApiExcludeEndpoint()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.typeormIndicator.pingCheck('database', this.typeorm),
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
