import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { ErrorCode } from '../../common/errors';
import { hashApiKey } from './agency-api-key.util';
import type { AgencyApiKey, AgencyProfile, User } from '../../../generated/typeorm/client';

export type AgencyApiRequestContext = {
  agencyApiKey: AgencyApiKey;
  agencyProfile: AgencyProfile;
  agencyUser: User;
};

@Injectable()
export class AgencyApiKeyGuard implements CanActivate {
  constructor(private readonly typeorm: TypeORMService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const rawKey = request.headers['x-api-key'] as string | undefined;
    if (!rawKey?.trim()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'کلید API الزامی است.',
      });
    }

    const key = await this.typeorm.agencyApiKey.findFirst({
      where: { keyHash: hashApiKey(rawKey.trim()), status: 'ACTIVE' },
      include: { agency: { include: { user: true } } },
    });
    if (!key) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'کلید API نامعتبر است.',
      });
    }
    if (key.expiresAt && key.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'کلید API منقضی شده است.',
      });
    }
    if (key.agency.suspendedAt) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'حساب آژانس معلق است.',
      });
    }

    await this.typeorm.agencyApiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), callCount: { increment: 1 } },
    });

    request.agencyApiKey = key;
    request.agencyProfile = key.agency;
    request.agencyUser = key.agency.user;
    return true;
  }
}
