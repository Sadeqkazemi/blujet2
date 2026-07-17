import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/errors';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
];
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), 'uploads');

@Injectable()
export class FilesService {
  constructor(private readonly prisma: PrismaService) {}

  async store(actor: AuthenticatedUser, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فایلی ارسال نشده است.',
      });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فقط PDF یا تصویر (PNG/JPG) مجاز است.',
      });
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'حداکثر حجم مجاز فایل ۵ مگابایت است.',
      });
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext =
      file.mimetype === 'application/pdf'
        ? '.pdf'
        : file.mimetype === 'image/png'
          ? '.png'
          : '.jpg';
    const diskName = `${crypto.randomUUID()}${ext}`;
    const diskPath = path.join(UPLOAD_DIR, diskName);
    fs.writeFileSync(diskPath, file.buffer);

    const stored = await this.prisma.storedFile.create({
      data: {
        ownerId: actor.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        path: diskPath,
      },
    });
    return {
      id: stored.id,
      fileName: stored.fileName,
      sizeBytes: stored.sizeBytes,
    };
  }

  /** Owner always may read; otherwise the caller must be a participant of a
   * referral/message the file is attached to (sender, recipient, or the
   * assignee of a cartable task the message materialized into). */
  private async canRead(
    actor: AuthenticatedUser,
    fileId: string,
    ownerId: string,
  ): Promise<boolean> {
    if (ownerId === actor.id) return true;

    const referrals = await this.prisma.managerReferral.findMany({
      where: { attachments: { array_contains: fileId } },
      include: { recipients: true },
    });
    for (const r of referrals) {
      if (
        r.fromId === actor.id ||
        r.recipients.some((x) => x.recipientId === actor.id)
      )
        return true;
    }

    const reports = await this.prisma.managerReferralReport.findMany({
      where: { attachments: { array_contains: fileId } },
      include: { referral: { include: { recipients: true } } },
    });
    for (const rep of reports) {
      if (
        rep.fromId === actor.id ||
        rep.referral.fromId === actor.id ||
        rep.referral.recipients.some((x) => x.recipientId === actor.id)
      )
        return true;
    }

    const messages = await this.prisma.managerMessage.findMany({
      where: { attachments: { array_contains: fileId } },
      select: { id: true, fromId: true },
    });
    for (const m of messages) {
      if (m.fromId === actor.id) return true;
      const delivered = await this.prisma.cartableTask.count({
        where: {
          sourceType: 'MANAGER_MESSAGE',
          sourceId: m.id,
          assigneeId: actor.id,
        },
      });
      if (delivered > 0) return true;
    }

    return false;
  }

  async read(actor: AuthenticatedUser, id: string) {
    const stored = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!stored) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'فایل یافت نشد.',
      });
    }
    if (!(await this.canRead(actor, id, stored.ownerId))) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'دسترسی به این فایل برای شما مجاز نیست.',
      });
    }
    if (!fs.existsSync(stored.path)) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'محتوای فایل در دسترس نیست.',
      });
    }
    return { stored, stream: fs.createReadStream(stored.path) };
  }
}
