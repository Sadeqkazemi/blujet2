import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SavedPassengersService } from './saved-passengers.service';
import { MySavedPassengersController } from './my-saved-passengers.controller';
import { BankAccountsService } from './bank-accounts.service';
import { MyBankAccountsController } from './my-bank-accounts.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    ProfileController,
    MySavedPassengersController,
    MyBankAccountsController,
  ],
  providers: [ProfileService, SavedPassengersService, BankAccountsService],
})
export class ProfileModule {}
