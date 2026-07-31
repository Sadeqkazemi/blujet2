import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { ErrorCode } from '../../common/errors';
import { encryptPii, decryptPii, hashPii } from '../../common/pii-crypto';
import {
  guessBankFromPan,
  isValidSheba,
  maskCardPan,
  maskSheba,
  normalizeCardPan,
  normalizeSheba,
} from '../../common/iban.util';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { SavedBankAccount } from '../../../generated/typeorm/client';
import type {
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto/bank-account.dtos';

const MAX_ACCOUNTS = 5;

@Injectable()
export class BankAccountsService {
  constructor(private readonly typeorm: TypeORMService) {}

  private shape(row: SavedBankAccount) {
    const sheba = decryptPii(row.shebaEnc);
    const pan = row.cardPanEnc ? decryptPii(row.cardPanEnc) : '';
    return {
      id: row.id,
      bankName: row.bankName,
      bankShort: row.bankShort,
      brandColor: row.brandColor,
      cardMasked: pan ? maskCardPan(pan) : null,
      sheba,
      shebaMasked: maskSheba(sheba),
      isDefault: row.isDefault,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listMine(user: AuthenticatedUser) {
    const rows = await this.typeorm.savedBankAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.shape(row));
  }

  async create(user: AuthenticatedUser, dto: CreateBankAccountDto) {
    const pan = normalizeCardPan(dto.cardNo);
    if (pan.length !== 16) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'شماره کارت باید ۱۶ رقم باشد.',
      });
    }
    const sheba = normalizeSheba(dto.sheba);
    if (!isValidSheba(sheba)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'شماره شبا نامعتبر است.',
      });
    }

    const count = await this.typeorm.savedBankAccount.count({
      where: { userId: user.id },
    });
    if (count >= MAX_ACCOUNTS) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: `حداکثر ${MAX_ACCOUNTS} حساب بانکی می‌توانید ثبت کنید.`,
      });
    }

    const existing = await this.typeorm.savedBankAccount.findFirst({
      where: { userId: user.id, shebaHash: hashPii(sheba) },
    });
    if (existing) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این شبا قبلاً ثبت شده است.',
      });
    }

    const guessed = guessBankFromPan(pan);
    const bankName = dto.bankName?.trim() || guessed.bankName;
    const isFirst = count === 0;

    return this.typeorm.$transaction(async (tx) => {
      if (isFirst) {
        await tx.savedBankAccount.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }
      const row = await tx.savedBankAccount.create({
        data: {
          userId: user.id,
          bankName,
          bankShort: guessed.bankShort,
          brandColor: guessed.brandColor,
          cardPanEnc: encryptPii(pan),
          cardLast4: pan.slice(-4),
          shebaEnc: encryptPii(sheba),
          shebaHash: hashPii(sheba),
          isDefault: isFirst,
        },
      });
      return this.shape(row);
    });
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateBankAccountDto,
  ) {
    const row = await this.typeorm.savedBankAccount.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'حساب بانکی یافت نشد.',
      });
    }
    if (dto.isDefault) {
      await this.typeorm.$transaction([
        this.typeorm.savedBankAccount.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        }),
        this.typeorm.savedBankAccount.update({
          where: { id },
          data: { isDefault: true },
        }),
      ]);
    }
    const updated = await this.typeorm.savedBankAccount.findUniqueOrThrow({
      where: { id },
    });
    return this.shape(updated);
  }

  async remove(user: AuthenticatedUser, id: string) {
    const row = await this.typeorm.savedBankAccount.findUnique({ where: { id } });
    if (!row || row.userId !== user.id) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'حساب بانکی یافت نشد.',
      });
    }
    await this.typeorm.savedBankAccount.delete({ where: { id } });
    if (row.isDefault) {
      const next = await this.typeorm.savedBankAccount.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await this.typeorm.savedBankAccount.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }
    return { removed: true };
  }
}
