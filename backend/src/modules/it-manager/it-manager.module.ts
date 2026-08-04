import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { Permission } from '../../database/entities/permission.entity';
import { EmployeePermission } from '../../database/entities/employee-permission.entity';
import { PasswordResetEvent } from '../../database/entities/password-reset-event.entity';
import { SecurityPolicy } from '../../database/entities/security-policy.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { InternalService } from '../../database/entities/internal-service.entity';
import { ExternalServiceConfig } from '../../database/entities/external-service-config.entity';
import { SmsLog } from '../../database/entities/sms-log.entity';
import { BackupRecord } from '../../database/entities/backup-record.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';
import { ItServicesController } from './services.controller';
import { ItServicesService } from './services.service';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';
import { ItDashboardController } from './dashboard.controller';
import { ItDashboardService } from './dashboard.service';
import { AuditModule } from '../audit/audit.module';
import { PanelsModule } from '../panels/panels.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Permission,
      EmployeePermission,
      PasswordResetEvent,
      SecurityPolicy,
      RefreshToken,
      InternalService,
      ExternalServiceConfig,
      SmsLog,
      BackupRecord,
      AuditLog,
    ]),
    AuditModule,
    PanelsModule,
    AuthModule,
  ],
  controllers: [
    EmployeesController,
    SecurityController,
    ItServicesController,
    BackupsController,
    ItDashboardController,
  ],
  providers: [
    EmployeesService,
    SecurityService,
    ItServicesService,
    BackupsService,
    ItDashboardService,
  ],
})
export class ItManagerModule {}
