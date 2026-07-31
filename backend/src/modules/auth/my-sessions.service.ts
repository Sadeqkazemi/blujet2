import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { ErrorCode } from '../../common/errors';
import { formatSessionDevice, hashRefreshToken } from './auth-token.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

@Injectable()
export class MySessionsService {
  constructor(private readonly typeorm: TypeORMService) {}

  async listMine(user: AuthenticatedUser, currentRefreshToken?: string) {
    const currentHash = currentRefreshToken
      ? hashRefreshToken(currentRefreshToken)
      : null;
    const rows = await this.typeorm.refreshToken.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      deviceLabel: formatSessionDevice(row.userAgent),
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      isCurrent: currentHash !== null && row.tokenHash === currentHash,
    }));
  }

  async revoke(
    user: AuthenticatedUser,
    sessionId: string,
    currentRefreshToken?: string,
  ) {
    const row = await this.typeorm.refreshToken.findUnique({
      where: { id: sessionId },
    });
    if (!row || row.userId !== user.id || row.revokedAt) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'نشست یافت نشد.',
      });
    }
    if (
      currentRefreshToken &&
      row.tokenHash === hashRefreshToken(currentRefreshToken)
    ) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'برای خروج از این دستگاه از دکمه خروج حساب استفاده کنید.',
      });
    }
    await this.typeorm.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }
}
