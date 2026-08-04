import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../database/enums';
import { SKIP_MUST_CHANGE_PASSWORD } from '../decorators/skip-must-change-password.decorator';
import type { AuthenticatedUser } from '../types/authenticated-user';
import { User } from '../../database/entities/user.entity';

const PASSWORD_CHANGE_ROLES: Role[] = [
  'EMPLOYEE',
  'IT_MANAGER',
  'COMMERCIAL_MANAGER',
  'FINANCE_MANAGER',
  'SENIOR_MANAGER',
  'CEO',
  'BOARD_CHAIR',
  'SITE_ADMIN',
  'AGENCY',
];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const activated = await super.canActivate(context);
    if (!activated) return false;

    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_MUST_CHANGE_PASSWORD,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user || !PASSWORD_CHANGE_ROLES.includes(user.role)) return true;

    const row = await this.userRepo.findOne({
      where: { id: user.id },
      select: { mustChangePassword: true },
    });
    if (!row?.mustChangePassword) return true;

    throw new ForbiddenException({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'قبل از ادامه باید رمز عبور خود را تغییر دهید.',
    });
  }
}
