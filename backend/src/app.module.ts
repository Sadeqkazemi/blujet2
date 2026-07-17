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
import { AgenciesModule } from './modules/agencies/agencies.module';
import { CartableModule } from './modules/cartable/cartable.module';
import { StaffDirectoryModule } from './modules/staff-directory/staff-directory.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ManagerMessagesModule } from './modules/manager-messages/manager-messages.module';
import { FilesModule } from './modules/files/files.module';
import { ClubModule } from './modules/club/club.module';
import { ItManagerModule } from './modules/it-manager/it-manager.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { ReservationModule } from './modules/reservation/reservation.module';
import { AgencyPortalModule } from './modules/agency-portal/agency-portal.module';
import { FlightsModule } from './modules/flights/flights.module';
import { PassengerReportsModule } from './modules/passenger-reports/passenger-reports.module';
import { StaffReportsModule } from './modules/staff-reports/staff-reports.module';
import { AdminsModule } from './modules/admins/admins.module';
import { SettingsModule } from './modules/settings/settings.module';

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
    AgenciesModule,
    CartableModule,
    StaffDirectoryModule,
    ReferralsModule,
    ManagerMessagesModule,
    FilesModule,
    ClubModule,
    ItManagerModule,
    PricingModule,
    RefundsModule,
    ReservationModule,
    AgencyPortalModule,
    FlightsModule,
    PassengerReportsModule,
    StaffReportsModule,
    AdminsModule,
    SettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
