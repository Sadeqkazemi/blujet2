import { Module } from '@nestjs/common';
import { CustomerReferralsService } from './customer-referrals.service';
import { MyReferralController } from './my-referral.controller';

@Module({
  controllers: [MyReferralController],
  providers: [CustomerReferralsService],
  exports: [CustomerReferralsService],
})
export class CustomerReferralsModule {}
