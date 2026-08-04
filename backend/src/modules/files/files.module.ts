import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoredFile } from '../../database/entities/stored-file.entity';
import { ManagerReferral } from '../../database/entities/manager-referral.entity';
import { ManagerReferralReport } from '../../database/entities/manager-referral-report.entity';
import { ManagerMessage } from '../../database/entities/manager-message.entity';
import { CartableTask } from '../../database/entities/cartable-task.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoredFile,
      ManagerReferral,
      ManagerReferralReport,
      ManagerMessage,
      CartableTask,
    ]),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
