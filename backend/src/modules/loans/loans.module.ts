import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankLoanApplication } from '../../database/entities/bank-loan-application.entity';
import { WalletEntry } from '../../database/entities/wallet-entry.entity';
import { AuditModule } from '../audit/audit.module';
import {
  BANK_LOAN_PROVIDER,
  BankLoanHttpAdapter,
} from './bank-loan.http.adapter';
import { LoansController } from './loans.controller';
import { LoansWebhookController } from './loans-webhook.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BankLoanApplication, WalletEntry]),
    AuditModule,
  ],
  controllers: [LoansController, LoansWebhookController],
  providers: [
    LoansService,
    BankLoanHttpAdapter,
    { provide: BANK_LOAN_PROVIDER, useExisting: BankLoanHttpAdapter },
  ],
  exports: [LoansService],
})
export class LoansModule {}