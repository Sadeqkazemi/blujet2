import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import { FilesService } from '../files/files.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { CustomerIdentityStatus } from '../../../generated/prisma/client';

@Injectable()
export class IdentityVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  private profileIdentityComplete(user: {
    fullName: string;
    nationalIdEnc: string | null;
    birthDate: Date | null;
  }): boolean {
    return Boolean(
      user.fullName?.trim() && user.nationalIdEnc && user.birthDate,
    );
  }

  private async getOrCreateRow(userId: string) {
    return this.prisma.customerIdentityVerification.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private shape(
    user: {
      fullName: string;
      nationalIdEnc: string | null;
      birthDate: Date | null;
    },
    row: {
      status: CustomerIdentityStatus;
      idCardFileId: string | null;
      submittedAt: Date | null;
      rejectReason: string | null;
    },
    idCardFile: { id: string; fileName: string; sizeBytes: number } | null,
  ) {
    const profileDone = this.profileIdentityComplete(user);
    const idCardDone = Boolean(row.idCardFileId);
    const steps = [
      {
        key: 'profile' as const,
        done: profileDone,
      },
      {
        key: 'id_card' as const,
        done: idCardDone,
      },
    ];
    const canSubmit =
      profileDone &&
      idCardDone &&
      (row.status === 'NOT_STARTED' || row.status === 'REJECTED');
    const isComplete = row.status === 'APPROVED';

    return {
      status: row.status,
      isComplete,
      canSubmit,
      submittedAt: row.submittedAt,
      rejectReason: row.rejectReason,
      steps,
      idCardFile,
    };
  }

  async getMine(user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true, nationalIdEnc: true, birthDate: true },
    });
    const row = await this.getOrCreateRow(user.id);
    let idCardFile: { id: string; fileName: string; sizeBytes: number } | null =
      null;
    if (row.idCardFileId) {
      const file = await this.prisma.storedFile.findUnique({
        where: { id: row.idCardFileId },
        select: { id: true, fileName: true, sizeBytes: true, ownerId: true },
      });
      if (file && file.ownerId === user.id) {
        idCardFile = {
          id: file.id,
          fileName: file.fileName,
          sizeBytes: file.sizeBytes,
        };
      }
    }
    return this.shape(dbUser, row, idCardFile);
  }

  async uploadIdCard(user: AuthenticatedUser, file: Express.Multer.File) {
    const row = await this.getOrCreateRow(user.id);
    if (row.status === 'SUBMITTED' || row.status === 'APPROVED') {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'در وضعیت فعلی امکان تغییر مدارک نیست.',
      });
    }
    const stored = await this.files.store(user, file);
    await this.prisma.customerIdentityVerification.update({
      where: { userId: user.id },
      data: {
        idCardFileId: stored.id,
        status: row.status === 'REJECTED' ? 'REJECTED' : 'NOT_STARTED',
      },
    });
    return stored;
  }

  async submit(user: AuthenticatedUser) {
    const dbUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true, nationalIdEnc: true, birthDate: true },
    });
    const row = await this.getOrCreateRow(user.id);
    if (!this.profileIdentityComplete(dbUser)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'ابتدا نام، کد ملی و تاریخ تولد را در پروفایل تکمیل کنید.',
      });
    }
    if (!row.idCardFileId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'تصویر کارت ملی بارگذاری نشده است.',
      });
    }
    if (row.status === 'SUBMITTED') {
      throw new BadRequestException({
        code: ErrorCode.CONFLICT,
        message: 'درخواست شما قبلاً ثبت شده و در حال بررسی است.',
      });
    }
    if (row.status === 'APPROVED') {
      throw new BadRequestException({
        code: ErrorCode.CONFLICT,
        message: 'احراز هویت شما قبلاً تأیید شده است.',
      });
    }

    await this.prisma.customerIdentityVerification.update({
      where: { userId: user.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        rejectReason: null,
      },
    });
    return this.getMine(user);
  }
}
