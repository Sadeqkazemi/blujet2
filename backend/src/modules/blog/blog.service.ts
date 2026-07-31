import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import type { BlogPostStatus, TypeORM } from '../../../generated/typeorm/client';
import type {
  CreateBlogPostDto,
  ListBlogPostsQueryDto,
  ListPublicBlogPostsQueryDto,
  UpdateBlogPostDto,
} from './dto/blog.dtos';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

const CATEGORY_LABELS_FA: Record<string, string> = {
  NEWS: 'اخبار پرواز',
  GUIDE: 'راهنمای سفر',
  DEST: 'مقاصد',
  OFFERS: 'تخفیف‌ها',
};

const STATUS_LABELS_FA: Record<BlogPostStatus, string> = {
  DRAFT: 'پیش‌نویس',
  PUBLISHED: 'منتشرشده',
  SCHEDULED: 'زمان‌بندی‌شده',
};

function slugify(title: string): string {
  const normalized = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .slice(0, 80);
  const base = normalized || `post-${crypto.randomUUID().slice(0, 8)}`;
  return base;
}

function isPubliclyVisible(
  status: BlogPostStatus,
  scheduledAt: Date | null,
  now = new Date(),
): boolean {
  if (status === 'PUBLISHED') return true;
  if (status === 'SCHEDULED' && scheduledAt && scheduledAt <= now) return true;
  return false;
}

@Injectable()
export class BlogService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
  ) {}

  private async uniqueSlug(preferred: string): Promise<string> {
    let slug = preferred;
    let attempt = 0;
    while (attempt < 10) {
      const existing = await this.typeorm.blogPost.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existing) return slug;
      slug = `${preferred}-${crypto.randomUUID().slice(0, 6)}`;
      attempt += 1;
    }
    return `${preferred}-${Date.now()}`;
  }

  private async assertCoverFile(
    actorId: string,
    coverFileId: string,
    excludePostId?: string,
  ) {
    const file = await this.typeorm.storedFile.findUnique({
      where: { id: coverFileId },
    });
    if (!file) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فایل کاور یافت نشد.',
      });
    }
    if (file.ownerId !== actorId) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'فقط فایل‌های آپلودشده توسط شما قابل استفاده است.',
      });
    }
    const usedElsewhere = await this.typeorm.blogPost.findFirst({
      where: {
        coverFileId,
        deletedAt: null,
        ...(excludePostId ? { id: { not: excludePostId } } : {}),
      },
    });
    if (usedElsewhere) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'این تصویر کاور قبلاً برای مقالهٔ دیگری استفاده شده است.',
      });
    }
  }

  private resolveStatusFields(
    status: BlogPostStatus,
    scheduledAt?: string | null,
  ): { publishedAt?: Date | null; scheduledAt?: Date | null } {
    if (status === 'PUBLISHED') {
      return { publishedAt: new Date(), scheduledAt: null };
    }
    if (status === 'SCHEDULED') {
      if (!scheduledAt) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'برای زمان‌بندی انتشار، تاریخ انتشار الزامی است.',
        });
      }
      const at = new Date(scheduledAt);
      if (Number.isNaN(at.getTime()) || at <= new Date()) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'تاریخ زمان‌بندی باید در آینده باشد.',
        });
      }
      return { publishedAt: null, scheduledAt: at };
    }
    return { publishedAt: null, scheduledAt: null };
  }

  private toAdminRow(post: {
    id: string;
    title: string;
    slug: string;
    body: string;
    category: string;
    status: BlogPostStatus;
    viewCount: number;
    publishedAt: Date | null;
    scheduledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    coverFileId: string | null;
    author: { fullName: string };
  }) {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      body: post.body,
      category: post.category,
      categoryLabelFa: CATEGORY_LABELS_FA[post.category] ?? post.category,
      status: post.status,
      statusLabelFa: STATUS_LABELS_FA[post.status],
      viewCount: post.viewCount,
      publishedAt: post.publishedAt,
      scheduledAt: post.scheduledAt,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      coverFileId: post.coverFileId,
      authorName: post.author.fullName,
    };
  }

  async getAdminStats() {
    const [published, draft, viewsAgg] = await Promise.all([
      this.typeorm.blogPost.count({
        where: { deletedAt: null, status: 'PUBLISHED' },
      }),
      this.typeorm.blogPost.count({
        where: { deletedAt: null, status: 'DRAFT' },
      }),
      this.typeorm.blogPost.aggregate({
        where: { deletedAt: null },
        _sum: { viewCount: true },
      }),
    ]);
    return {
      publishedCount: published,
      draftCount: draft,
      totalViews: viewsAgg._sum.viewCount ?? 0,
      commentCount: 0,
    };
  }

  async listAdminPosts(query: ListBlogPostsQueryDto) {
    const where: TypeORM.BlogPostWhereInput = {
      deletedAt: null,
      ...(query.category && query.category !== 'all'
        ? { category: query.category }
        : {}),
    };
    const posts = await this.typeorm.blogPost.findMany({
      where,
      include: { author: { select: { fullName: true } } },
      orderBy: [{ updatedAt: 'desc' }],
    });
    return posts.map((p) => this.toAdminRow(p));
  }

  async getAdminPost(id: string) {
    const post = await this.typeorm.blogPost.findFirst({
      where: { id, deletedAt: null },
      include: { author: { select: { fullName: true } } },
    });
    if (!post) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مقاله یافت نشد.',
      });
    }
    return this.toAdminRow(post);
  }

  async createPost(actor: AuthenticatedUser, dto: CreateBlogPostDto) {
    if (dto.coverFileId) {
      await this.assertCoverFile(actor.id, dto.coverFileId);
    }
    const status = dto.status ?? 'DRAFT';
    const statusFields = this.resolveStatusFields(status, dto.scheduledAt);
    const preferredSlug = dto.slug?.trim() || slugify(dto.title);
    const slug = await this.uniqueSlug(preferredSlug);

    const post = await this.typeorm.blogPost.create({
      data: {
        title: dto.title.trim(),
        slug,
        body: dto.body,
        category: dto.category,
        status,
        coverFileId: dto.coverFileId,
        authorId: actor.id,
        ...statusFields,
      },
      include: { author: { select: { fullName: true } } },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'ایجاد مقالهٔ بلاگ',
      detail: `${actor.fullName} مقالهٔ «${post.title}» را ایجاد کرد.`,
      entityType: 'BlogPost',
      entityId: post.id,
    });

    return this.toAdminRow(post);
  }

  async updatePost(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateBlogPostDto,
  ) {
    const existing = await this.typeorm.blogPost.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مقاله یافت نشد.',
      });
    }

    if (dto.coverFileId) {
      await this.assertCoverFile(actor.id, dto.coverFileId, id);
    }

    const nextStatus = dto.status ?? existing.status;
    const scheduledInput =
      dto.scheduledAt !== undefined ? dto.scheduledAt : existing.scheduledAt?.toISOString();
    const statusFields =
      dto.status !== undefined || dto.scheduledAt !== undefined
        ? this.resolveStatusFields(nextStatus, scheduledInput)
        : {};

    let slug = existing.slug;
    if (dto.slug && dto.slug !== existing.slug) {
      slug = await this.uniqueSlug(dto.slug.trim());
    }

    const updated = await this.typeorm.blogPost.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.coverFileId !== undefined
          ? { coverFileId: dto.coverFileId }
          : {}),
        ...(dto.slug !== undefined ? { slug } : {}),
        ...statusFields,
      },
      include: { author: { select: { fullName: true } } },
    });

    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'ویرایش مقالهٔ بلاگ',
      detail: `${actor.fullName} مقالهٔ «${updated.title}» را ویرایش کرد.`,
      entityType: 'BlogPost',
      entityId: updated.id,
    });

    return this.toAdminRow(updated);
  }

  async deletePost(actor: AuthenticatedUser, id: string) {
    const existing = await this.typeorm.blogPost.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مقاله یافت نشد.',
      });
    }
    await this.typeorm.blogPost.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'حذف مقالهٔ بلاگ',
      detail: `${actor.fullName} مقالهٔ «${existing.title}» را حذف کرد.`,
      entityType: 'BlogPost',
      entityId: existing.id,
    });
    return { id };
  }

  private publicWhere(
    query: ListPublicBlogPostsQueryDto,
    now = new Date(),
  ): TypeORM.BlogPostWhereInput {
    return {
      deletedAt: null,
      ...(query.category ? { category: query.category } : {}),
      OR: [
        { status: 'PUBLISHED' },
        { status: 'SCHEDULED', scheduledAt: { lte: now } },
      ],
    };
  }

  async listPublicPosts(query: ListPublicBlogPostsQueryDto) {
    const posts = await this.typeorm.blogPost.findMany({
      where: this.publicWhere(query),
      include: { author: { select: { fullName: true } } },
      orderBy: [{ publishedAt: 'desc' }, { scheduledAt: 'desc' }],
    });
    return posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      category: p.category,
      categoryLabelFa: CATEGORY_LABELS_FA[p.category] ?? p.category,
      authorName: p.author.fullName,
      publishedAt: p.publishedAt ?? p.scheduledAt,
      viewCount: p.viewCount,
      coverFileId: p.coverFileId,
      excerpt: p.body.slice(0, 200),
    }));
  }

  async getPublicPost(slug: string) {
    const post = await this.typeorm.blogPost.findFirst({
      where: { slug, deletedAt: null },
      include: { author: { select: { fullName: true } } },
    });
    if (!post || !isPubliclyVisible(post.status, post.scheduledAt)) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'مقاله یافت نشد.',
      });
    }

    const updated = await this.typeorm.blogPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
      include: { author: { select: { fullName: true } } },
    });

    return {
      slug: updated.slug,
      title: updated.title,
      body: updated.body,
      category: updated.category,
      categoryLabelFa: CATEGORY_LABELS_FA[updated.category] ?? updated.category,
      authorName: updated.author.fullName,
      publishedAt: updated.publishedAt ?? updated.scheduledAt,
      viewCount: updated.viewCount,
      coverFileId: updated.coverFileId,
    };
  }

  async readPublicCover(fileId: string) {
    const post = await this.typeorm.blogPost.findFirst({
      where: {
        coverFileId: fileId,
        deletedAt: null,
      },
    });
    if (
      !post ||
      !post.coverFileId ||
      !isPubliclyVisible(post.status, post.scheduledAt)
    ) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'تصویر یافت نشد.',
      });
    }
    const file = await this.typeorm.storedFile.findUnique({
      where: { id: fileId },
    });
    if (!file || !fs.existsSync(file.path)) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'محتوای تصویر در دسترس نیست.',
      });
    }
    return {
      mimeType: file.mimeType,
      fileName: file.fileName,
      stream: fs.createReadStream(file.path),
    };
  }
}
