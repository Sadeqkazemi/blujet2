import { Module } from '@nestjs/common';
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

@Module({
  imports: [AuditModule, PanelsModule],
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
