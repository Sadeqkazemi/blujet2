import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { SavedPassengersService } from './saved-passengers.service';
import { MySavedPassengersController } from './my-saved-passengers.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProfileController, MySavedPassengersController],
  providers: [ProfileService, SavedPassengersService],
})
export class ProfileModule {}
