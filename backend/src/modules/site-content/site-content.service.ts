import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'node:fs';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import type { SiteContentBlockKey } from '../../../generated/typeorm/client';
import type {
  AddLibraryAssetDto,
  CreateDestinationDto,
  CreateRouteDto,
  UpdateContentBlockDto,
  UpdateDestinationDto,
  UpdateRouteDto,
} from './dto/site-content.dtos';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const BLOCK_DEFAULTS: Record<
  SiteContentBlockKey,
  {
    enabled: boolean;
    title: string;
    subtitle: string;
    buttonText: string;
    badgeText: string;
  }
> = {
  HERO_BANNER: {
    enabled: true,
    title: 'پرواز بعدی‌ات را با blujet رزرو کن',
    subtitle: 'بیش از ۲۰۰ مقصد با بهترین قیمت',
    buttonText: 'مشاهده پیشنهادهای ویژه',
    badgeText: '',
  },
  ANNOUNCEMENT_BAR: {
    enabled: true,
    title:
      'اطلاعیه مهم: برخی پروازهای امروز به‌دلیل شرایط جوی با تأخیر انجام می‌شوند — آخرین وضعیت پروازها را بررسی کنید',
    subtitle: '',
    buttonText: 'مشاهده',
    badgeText: '',
  },
  PROMO_BANNER: {
    enabled: true,
    title: 'تخفیف ویژه پروازهای داخلی',
    subtitle: '',
    buttonText: 'رزرو کنید',
    badgeText: 'پیشنهاد ویژه',
  },
};

@Injectable()
export class SiteContentService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
  ) {}

  private async assertImageFile(actorId: string, fileId: string) {
    const file = await this.typeorm.storedFile.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فایل تصویر یافت نشد.',
      });
    }
    if (file.ownerId !== actorId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فقط فایل‌های آپلودشده توسط شما قابل استفاده است.',
      });
    }
    if (!file.mimeType.startsWith('image/')) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فقط تصویر برای این بخش مجاز است.',
      });
    }
  }

  private mediaUrl(fileId: string) {
    return `/site-content/media/${fileId}`;
  }

  private toLibraryRow(row: {
    id: string;
    label: string;
    createdAt: Date;
    storedFile: {
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    };
  }) {
    return {
      id: row.id,
      label: row.label,
      fileName: row.storedFile.fileName,
      mimeType: row.storedFile.mimeType,
      sizeBytes: row.storedFile.sizeBytes,
      fileId: row.storedFile.id,
      url: this.mediaUrl(row.storedFile.id),
      createdAt: row.createdAt,
    };
  }

  async listLibrary() {
    const rows = await this.typeorm.siteMediaAsset.findMany({
      where: { deletedAt: null },
      include: { storedFile: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toLibraryRow(r));
  }

  async addLibraryAsset(actor: AuthenticatedUser, dto: AddLibraryAssetDto) {
    await this.assertImageFile(actor.id, dto.storedFileId);
    const file = await this.typeorm.storedFile.findUniqueOrThrow({
      where: { id: dto.storedFileId },
    });
    const existing = await this.typeorm.siteMediaAsset.findUnique({
      where: { storedFileId: dto.storedFileId },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این فایل قبلاً در کتابخانه ثبت شده است.',
      });
    }
    const label = dto.label?.trim() || file.fileName;
    const asset = existing
      ? await this.typeorm.siteMediaAsset.update({
          where: { id: existing.id },
          data: { label, deletedAt: null, uploadedById: actor.id },
          include: { storedFile: true },
        })
      : await this.typeorm.siteMediaAsset.create({
          data: {
            storedFileId: dto.storedFileId,
            label,
            uploadedById: actor.id,
          },
          include: { storedFile: true },
        });
    return this.toLibraryRow(asset);
  }

  async deleteLibraryAsset(actor: AuthenticatedUser, id: string) {
    const asset = await this.typeorm.siteMediaAsset.findFirst({
      where: { id, deletedAt: null },
    });
    if (!asset) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'تصویر یافت نشد.',
      });
    }
    await this.typeorm.siteMediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'حذف تصویر از کتابخانه',
      detail: `${actor.fullName} تصویر «${asset.label}» را از کتابخانه حذف کرد.`,
      entityType: 'SiteMediaAsset',
      entityId: asset.id,
    });
    return { id };
  }

  private async ensureBlock(key: SiteContentBlockKey) {
    const existing = await this.typeorm.siteContentBlock.findUnique({
      where: { key },
    });
    if (existing) return existing;
    const defaults = BLOCK_DEFAULTS[key];
    return this.typeorm.siteContentBlock.create({
      data: { key, ...defaults },
    });
  }

  private toBlockRow(row: {
    key: SiteContentBlockKey;
    enabled: boolean;
    title: string;
    subtitle: string;
    buttonText: string;
    badgeText: string;
    imageFileId: string | null;
  }) {
    return {
      key: row.key,
      enabled: row.enabled,
      title: row.title,
      subtitle: row.subtitle,
      buttonText: row.buttonText,
      badgeText: row.badgeText,
      imageFileId: row.imageFileId,
      imageUrl: row.imageFileId ? this.mediaUrl(row.imageFileId) : null,
    };
  }

  async listBlocks() {
    const keys: SiteContentBlockKey[] = [
      'HERO_BANNER',
      'ANNOUNCEMENT_BAR',
      'PROMO_BANNER',
    ];
    const rows = await Promise.all(keys.map((k) => this.ensureBlock(k)));
    return rows.map((r) => this.toBlockRow(r));
  }

  async updateBlock(
    actor: AuthenticatedUser,
    key: SiteContentBlockKey,
    dto: UpdateContentBlockDto,
  ) {
    await this.ensureBlock(key);
    if (dto.imageFileId) {
      await this.assertImageFile(actor.id, dto.imageFileId);
    }
    const updated = await this.typeorm.siteContentBlock.update({
      where: { key },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
        ...(dto.buttonText !== undefined ? { buttonText: dto.buttonText } : {}),
        ...(dto.badgeText !== undefined ? { badgeText: dto.badgeText } : {}),
        ...(dto.imageFileId !== undefined
          ? { imageFileId: dto.imageFileId }
          : {}),
        updatedById: actor.id,
      },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'ویرایش بلوک محتوای سایت',
      detail: `${actor.fullName} بلوک «${key}» را ویرایش کرد.`,
      entityType: 'SiteContentBlock',
      entityId: key,
    });
    return this.toBlockRow(updated);
  }

  async listDestinations() {
    const rows = await this.typeorm.siteDestinationHighlight.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      airportCode: r.airportCode,
      priceIrr: r.priceIrr.toString(),
      imageFileId: r.imageFileId,
      imageUrl: r.imageFileId ? this.mediaUrl(r.imageFileId) : null,
      sortOrder: r.sortOrder,
    }));
  }

  async createDestination(actor: AuthenticatedUser, dto: CreateDestinationDto) {
    if (dto.imageFileId) {
      await this.assertImageFile(actor.id, dto.imageFileId);
    }
    const row = await this.typeorm.siteDestinationHighlight.create({
      data: {
        airportCode: dto.airportCode.toUpperCase(),
        priceIrr: BigInt(dto.priceIrr),
        imageFileId: dto.imageFileId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return {
      id: row.id,
      airportCode: row.airportCode,
      priceIrr: row.priceIrr.toString(),
      imageFileId: row.imageFileId,
      sortOrder: row.sortOrder,
    };
  }

  async updateDestination(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateDestinationDto,
  ) {
    const existing = await this.typeorm.siteDestinationHighlight.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مقصد یافت نشد.',
      });
    }
    if (dto.imageFileId) {
      await this.assertImageFile(actor.id, dto.imageFileId);
    }
    const updated = await this.typeorm.siteDestinationHighlight.update({
      where: { id },
      data: {
        ...(dto.airportCode !== undefined
          ? { airportCode: dto.airportCode.toUpperCase() }
          : {}),
        ...(dto.priceIrr !== undefined
          ? { priceIrr: BigInt(dto.priceIrr) }
          : {}),
        ...(dto.imageFileId !== undefined
          ? { imageFileId: dto.imageFileId }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return {
      id: updated.id,
      airportCode: updated.airportCode,
      priceIrr: updated.priceIrr.toString(),
      imageFileId: updated.imageFileId,
      sortOrder: updated.sortOrder,
    };
  }

  async deleteDestination(actor: AuthenticatedUser, id: string) {
    const existing = await this.typeorm.siteDestinationHighlight.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مقصد یافت نشد.',
      });
    }
    await this.typeorm.siteDestinationHighlight.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  async listRoutes() {
    const rows = await this.typeorm.siteRouteHighlight.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({
      id: r.id,
      fromAirportCode: r.fromAirportCode,
      toAirportCode: r.toAirportCode,
      priceIrr: r.priceIrr.toString(),
      sortOrder: r.sortOrder,
    }));
  }

  async createRoute(actor: AuthenticatedUser, dto: CreateRouteDto) {
    const row = await this.typeorm.siteRouteHighlight.create({
      data: {
        fromAirportCode: dto.fromAirportCode.toUpperCase(),
        toAirportCode: dto.toAirportCode.toUpperCase(),
        priceIrr: BigInt(dto.priceIrr),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return {
      id: row.id,
      fromAirportCode: row.fromAirportCode,
      toAirportCode: row.toAirportCode,
      priceIrr: row.priceIrr.toString(),
      sortOrder: row.sortOrder,
    };
  }

  async updateRoute(actor: AuthenticatedUser, id: string, dto: UpdateRouteDto) {
    const existing = await this.typeorm.siteRouteHighlight.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مسیر یافت نشد.',
      });
    }
    const updated = await this.typeorm.siteRouteHighlight.update({
      where: { id },
      data: {
        ...(dto.fromAirportCode !== undefined
          ? { fromAirportCode: dto.fromAirportCode.toUpperCase() }
          : {}),
        ...(dto.toAirportCode !== undefined
          ? { toAirportCode: dto.toAirportCode.toUpperCase() }
          : {}),
        ...(dto.priceIrr !== undefined
          ? { priceIrr: BigInt(dto.priceIrr) }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return {
      id: updated.id,
      fromAirportCode: updated.fromAirportCode,
      toAirportCode: updated.toAirportCode,
      priceIrr: updated.priceIrr.toString(),
      sortOrder: updated.sortOrder,
    };
  }

  async deleteRoute(actor: AuthenticatedUser, id: string) {
    const existing = await this.typeorm.siteRouteHighlight.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مسیر یافت نشد.',
      });
    }
    await this.typeorm.siteRouteHighlight.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  async getPublicHome() {
    const [blocks, destinations, routes, airports] = await Promise.all([
      this.listBlocks(),
      this.listDestinations(),
      this.listRoutes(),
      this.typeorm.airport.findMany(),
    ]);
    const airportMap = new Map(airports.map((a) => [a.code, a.cityFa]));

    return {
      blocks,
      destinations: destinations.map((d) => ({
        airportCode: d.airportCode,
        cityFa: airportMap.get(d.airportCode) ?? d.airportCode,
        priceIrr: d.priceIrr,
        imageUrl: d.imageUrl,
      })),
      routes: routes.map((r) => ({
        fromAirportCode: r.fromAirportCode,
        toAirportCode: r.toAirportCode,
        fromCityFa: airportMap.get(r.fromAirportCode) ?? r.fromAirportCode,
        toCityFa: airportMap.get(r.toAirportCode) ?? r.toAirportCode,
        priceIrr: r.priceIrr,
      })),
    };
  }

  async readPublicMedia(fileId: string) {
    const file = await this.typeorm.storedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || !fs.existsSync(file.path)) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'تصویر یافت نشد.',
      });
    }
    const [inLibrary, inBlock, inDest, inBlog] = await Promise.all([
      this.typeorm.siteMediaAsset.count({
        where: { storedFileId: fileId, deletedAt: null },
      }),
      this.typeorm.siteContentBlock.count({ where: { imageFileId: fileId } }),
      this.typeorm.siteDestinationHighlight.count({
        where: { imageFileId: fileId, deletedAt: null },
      }),
      this.typeorm.blogPost.count({
        where: { coverFileId: fileId, deletedAt: null, status: 'PUBLISHED' },
      }),
    ]);
    if (inLibrary + inBlock + inDest + inBlog === 0) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'تصویر یافت نشد.',
      });
    }
    return {
      mimeType: file.mimeType,
      fileName: file.fileName,
      stream: fs.createReadStream(file.path),
    };
  }
}
