import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { PanelsModule } from './modules/panels/panels.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level:
          process.env.NODE_ENV === 'test'
            ? 'silent'
            : process.env.NODE_ENV === 'production'
              ? 'info'
              : 'debug',
        genReqId: (req) =>
          (req.headers['x-request-id'] as string) || randomUUID(),
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.otp',
          'req.body.nationalId',
        ],
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 60 }],
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PanelsModule,
    ReportingModule,
    AuditModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
