import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { nanoid } from 'nanoid';
import { validateEnv } from './config/env.validation';
import { TypeORMModule } from './typeorm/typeorm.module';
import { HealthModule } from './health/health.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        genReqId: (req) => (req.headers['x-request-id'] as string) || nanoid(),
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.otp',
          'req.body.nationalId',
        ],
      },
    }),
    TypeORMModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
