import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SavedPassengersService } from './saved-passengers.service';
import { MySavedPassengersController } from './my-saved-passengers.controller';
import { BankAccountsService } from './bank-accounts.service';
import { MyBankAccountsController } from './my-bank-accounts.controller';
import { IdentityVerificationService } from './identity-verification.service';
import { MyIdentityController } from './my-identity.controller';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [AuthModule, FilesModule],
  controllers: [
    ProfileController,
    MySavedPassengersController,
    MyBankAccountsController,
    MyIdentityController,
  ],
  providers: [
    ProfileService,
    SavedPassengersService,
    BankAccountsService,
    IdentityVerificationService,
  ],
})
export class ProfileModule {}
