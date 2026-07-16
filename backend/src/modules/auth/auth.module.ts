import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TWO_FACTOR_PROVIDER } from './providers/two-factor-provider.interface';
import { MockTwoFactorProvider } from './providers/mock-two-factor.provider';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    { provide: TWO_FACTOR_PROVIDER, useClass: MockTwoFactorProvider },
  ],
  exports: [AuthService],
})
export class AuthModule {}
