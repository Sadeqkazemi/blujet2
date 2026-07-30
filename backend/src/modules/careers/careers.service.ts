import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { TypeORMService } from '../../typeorm/typeorm.service';
import { AuditService } from '../audit/audit.service';
import { ErrorCode } from '../../common/errors';
import type { TypeORM } from '../../../generated/typeorm/client';
import { ROLE_LABELS_FA } from '../../common/exec-roles';
import {
  decryptPii,
  encryptPii,
  hashPii,
  isValidIranianNationalId,
  normalizeNationalId,
} from '../../common/pii-crypto';
import type {
  ApplyJobDto,
  CreateJobPostingDto,
  ListApplicationsQueryDto,
  ReferApplicationDto,
  UpdateCareersSettingsDto,
  UpdateJobPostingDto,
} from './dto/careers.dtos';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';

export const RESUME_ALLOWED_MIME = 'application/pdf';
export const RESUME_MAX_BYTES = 3 * 1024 * 1024;
const RESUME_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'resumes')
  : path.join(process.cwd(), 'uploads', 'resumes');

const REFERRAL_ROLES = ['COMMERCIAL_MANAGER', 'FINANCE_MANAGER'] as const;
const SINGLETON_REFERRAL_ROLES = ['CEO', 'SENIOR_MANAGER'] as const;
const CAN_ACT_STATUSES = ['SUBMITTED', 'REFERRED'] as const;
const MAX_JSON_ENTRIES = 20;

function parseEntries(raw: string | undefined): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_JSON_ENTRIES);
  } catch {
    return [];
  }
}

@Injectable()
export class CareersService {
  constructor(
    private readonly typeorm: TypeORMService,
    private readonly audit: AuditService,
  ) {}

  // ── CareersSettings (footer-visibility toggle) ──────────────────────
  private async getOrCreateSettings() {
    const existing = await this.typeorm.careersSettings.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;
    return this.typeorm.careersSettings.create({ data: {} });
  }

  async getSettings() {
    const s = await this.getOrCreateSettings();
    return { enabled: s.enabled };
  }

  async updateSettings(
    actor: AuthenticatedUser,
    dto: UpdateCareersSettingsDto,
  ) {
    const current = await this.getOrCreateSettings();
    const updated = await this.typeorm.careersSettings.update({
      where: { id: current.id },
      data: { enabled: dto.enabled },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'تغییر وضعیت انتشار فرصت‌های شغلی',
      detail: `${actor.fullName} انتشار لینک «فرصت‌های شغلی» در فوتر را ${
        dto.enabled ? 'فعال' : 'غیرفعال'
      } کرد.`,
      entityType: 'CareersSettings',
      entityId: updated.id,
    });
    return { enabled: updated.enabled };
  }

  // ── Public job listing ──────────────────────────────────────────────
  async listActiveJobs() {
    const jobs = await this.typeorm.jobPosting.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
    });
    return jobs.map((j) => ({
      id: j.id,
      title: j.title,
      dept: j.dept,
      city: j.city,
      type: j.type,
    }));
  }

  async getPublicJob(id: string) {
    const job = await this.typeorm.jobPosting.findUnique({ where: { id } });
    if (!job || !job.active) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'این فرصت شغلی یافت نشد یا دیگر فعال نیست.',
      });
    }
    return {
      id: job.id,
      title: job.title,
      dept: job.dept,
      city: job.city,
      type: job.type,
      generalReqs: job.generalReqs,
      specialReqs: job.specialReqs,
    };
  }

  // ── SITE_ADMIN: job-posting CRUD ─────────────────────────────────────
  async listAllPostings() {
    return this.typeorm.jobPosting.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createPosting(actor: AuthenticatedUser, dto: CreateJobPostingDto) {
    const posting = await this.typeorm.jobPosting.create({ data: dto });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'ایجاد فرصت شغلی',
      detail: `${actor.fullName} فرصت شغلی «${posting.title}» را ایجاد کرد.`,
      entityType: 'JobPosting',
      entityId: posting.id,
    });
    return posting;
  }

  async updatePosting(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateJobPostingDto,
  ) {
    const existing = await this.typeorm.jobPosting.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'فرصت شغلی یافت نشد.',
      });
    }
    const updated = await this.typeorm.jobPosting.update({
      where: { id },
      data: dto,
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'ویرایش فرصت شغلی',
      detail: `${actor.fullName} فرصت شغلی «${updated.title}» را ویرایش کرد.`,
      entityType: 'JobPosting',
      entityId: updated.id,
    });
    return updated;
  }

  // ── Public application submission ───────────────────────────────────
  private writeResume(file: Express.Multer.File): {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    path: string;
  } {
    fs.mkdirSync(RESUME_DIR, { recursive: true });
    const diskName = `${crypto.randomUUID()}.pdf`;
    const diskPath = path.join(RESUME_DIR, diskName);
    fs.writeFileSync(diskPath, file.buffer);
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return {
      fileName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      path: diskPath,
    };
  }

  async apply(
    jobId: string,
    dto: ApplyJobDto,
    file: Express.Multer.File | undefined,
  ) {
    const job = await this.typeorm.jobPosting.findUnique({
      where: { id: jobId },
    });
    if (!job || !job.active) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'این فرصت شغلی یافت نشد یا دیگر فعال نیست.',
      });
    }

    if (file) {
      if (file.mimetype !== RESUME_ALLOWED_MIME) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'فقط فایل PDF برای رزومه مجاز است.',
        });
      }
      if (file.size > RESUME_MAX_BYTES) {
        throw new BadRequestException({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'حداکثر حجم مجاز فایل رزومه ۳ مگابایت است.',
        });
      }
    }

    const nationalId = normalizeNationalId(dto.nationalId);
    if (!isValidIranianNationalId(nationalId)) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'کد ملی معتبر نیست.',
      });
    }

    const resume = file ? this.writeResume(file) : null;

    const application = await this.typeorm.jobApplication.create({
      data: {
        jobPostingId: job.id,
        jobTitleSnapshot: job.title,
        firstName: dto.firstName,
        lastName: dto.lastName,
        nationalIdEnc: encryptPii(nationalId),
        nationalIdHash: hashPii(nationalId),
        fatherName: dto.fatherName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        birthProvince: dto.birthProvince,
        birthCity: dto.birthCity,
        gender: dto.gender,
        marital: dto.marital,
        military: dto.military,
        exemptionType: dto.exemptionType,
        phone: dto.phone,
        email: dto.email,
        residenceProvince: dto.residenceProvince,
        residenceAddress: dto.residenceAddress,
        eduEntries: parseEntries(dto.eduEntries) as TypeORM.InputJsonValue,
        workEntries: parseEntries(dto.workEntries) as TypeORM.InputJsonValue,
        langEntries: parseEntries(dto.langEntries) as TypeORM.InputJsonValue,
        skills: dto.skills,
        otherLangs: dto.otherLangs,
        resumeFileName: resume?.fileName,
        resumeMimeType: resume?.mimeType,
        resumeSizeBytes: resume?.sizeBytes,
        resumePath: resume?.path,
        history: [
          {
            step: 'submitted',
            label: 'ثبت درخواست توسط متقاضی',
            at: new Date().toISOString(),
          },
        ] as TypeORM.InputJsonValue,
      },
    });
    return { id: application.id };
  }

  // ── SITE_ADMIN: application review ──────────────────────────────────
  private async referralTargets() {
    const staff = await this.typeorm.user.findMany({
      where: { role: { in: [...REFERRAL_ROLES] }, isActive: true },
      select: { id: true, fullName: true, role: true },
    });
    const singletons = await this.typeorm.user.findMany({
      where: { role: { in: [...SINGLETON_REFERRAL_ROLES] }, isActive: true },
      select: { id: true, fullName: true, role: true },
    });
    return [...staff, ...singletons].map((u) => ({
      id: u.id,
      labelFa: `${u.fullName} (${ROLE_LABELS_FA[u.role]})`,
    }));
  }

  async listApplications(query: ListApplicationsQueryDto) {
    const rows = await this.typeorm.jobApplication.findMany({
      where: {
        ...(query.jobTitle ? { jobTitleSnapshot: query.jobTitle } : {}),
      },
      include: { assignee: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const q = query.q?.trim().toLowerCase();
    const filtered = q
      ? rows.filter((a) => {
          const nid = decryptPii(a.nationalIdEnc);
          const hay =
            `${a.firstName} ${a.lastName} ${nid} ${a.phone} ${a.email ?? ''}`.toLowerCase();
          return hay.includes(q);
        })
      : rows;

    return filtered.map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      jobTitle: a.jobTitleSnapshot,
      nationalId: decryptPii(a.nationalIdEnc),
      phone: a.phone,
      email: a.email,
      at: a.createdAt,
      status: a.status,
      hasResume: !!a.resumeFileName,
      eduCount: Array.isArray(a.eduEntries) ? a.eduEntries.length : 0,
      workCount: Array.isArray(a.workEntries) ? a.workEntries.length : 0,
      assigneeLabelFa: a.assignee?.fullName ?? null,
    }));
  }

  async getApplicationDetail(id: string) {
    const a = await this.typeorm.jobApplication.findUnique({ where: { id } });
    if (!a) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست استخدام یافت نشد.',
      });
    }
    return {
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      jobTitle: a.jobTitleSnapshot,
      nationalId: decryptPii(a.nationalIdEnc),
      fatherName: a.fatherName,
      birthDate: a.birthDate,
      phone: a.phone,
      email: a.email,
      residenceAddress: a.residenceAddress,
      gender: a.gender,
      military: a.military,
      exemptionType: a.exemptionType,
      skills: a.skills,
      eduEntries: a.eduEntries,
      workEntries: a.workEntries,
      langEntries: a.langEntries,
      hasResume: !!a.resumeFileName,
      resumeFileName: a.resumeFileName,
      status: a.status,
      canAct: (CAN_ACT_STATUSES as readonly string[]).includes(a.status),
      history: a.history,
      referralTargets: await this.referralTargets(),
    };
  }

  async getResume(id: string) {
    const a = await this.typeorm.jobApplication.findUnique({ where: { id } });
    if (!a || !a.resumePath || !fs.existsSync(a.resumePath)) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'رزومه‌ای برای این درخواست ثبت نشده است.',
      });
    }
    return {
      fileName: a.resumeFileName ?? 'resume.pdf',
      mimeType: a.resumeMimeType ?? 'application/pdf',
      stream: fs.createReadStream(a.resumePath),
    };
  }

  private async requireActionable(id: string) {
    const a = await this.typeorm.jobApplication.findUnique({ where: { id } });
    if (!a) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'درخواست استخدام یافت نشد.',
      });
    }
    if (!(CAN_ACT_STATUSES as readonly string[]).includes(a.status)) {
      throw new ConflictException({
        code: ErrorCode.CONFLICT,
        message: 'وضعیت این درخواست دیگر قابل تغییر نیست.',
      });
    }
    return a;
  }

  /** Json fields have no server-side "push" operator (unlike `String[]`
   * scalar-list columns elsewhere in this schema) — the array is read,
   * appended to in JS, and written back whole. */
  private appendHistory(
    existing: unknown,
    step: string,
    label: string,
  ): TypeORM.InputJsonValue {
    const list: unknown[] = Array.isArray(existing) ? existing : [];
    return [
      ...list,
      { step, label, at: new Date().toISOString() },
    ] as TypeORM.InputJsonValue;
  }

  async referApplication(
    actor: AuthenticatedUser,
    id: string,
    dto: ReferApplicationDto,
  ) {
    const existing = await this.requireActionable(id);
    const assignee = await this.typeorm.user.findUnique({
      where: { id: dto.assigneeId },
    });
    if (!assignee) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: 'گیرندهٔ ارجاع نامعتبر است.',
      });
    }
    const updated = await this.typeorm.jobApplication.update({
      where: { id },
      data: {
        status: 'REFERRED',
        assigneeId: assignee.id,
        history: this.appendHistory(
          existing.history,
          'referred',
          `ارجاع به ${assignee.fullName} توسط ادمین سایت`,
        ),
      },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'ارجاع درخواست استخدام',
      detail: `${actor.fullName} درخواست «${updated.firstName} ${updated.lastName}» را به ${assignee.fullName} ارجاع داد.`,
      entityType: 'JobApplication',
      entityId: updated.id,
    });
    return { id: updated.id, status: updated.status };
  }

  async hireApplication(actor: AuthenticatedUser, id: string) {
    const existing = await this.requireActionable(id);
    const updated = await this.typeorm.jobApplication.update({
      where: { id },
      data: {
        status: 'HIRED',
        history: this.appendHistory(
          existing.history,
          'hired',
          'نتیجهٔ استخدام: پذیرفته شد',
        ),
      },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'استخدام متقاضی',
      detail: `${actor.fullName} درخواست «${existing.firstName} ${existing.lastName}» را استخدام کرد.`,
      entityType: 'JobApplication',
      entityId: updated.id,
    });
    return { id: updated.id, status: updated.status };
  }

  async rejectApplication(actor: AuthenticatedUser, id: string) {
    const existing = await this.requireActionable(id);
    const updated = await this.typeorm.jobApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        history: this.appendHistory(
          existing.history,
          'rejected',
          'نتیجهٔ استخدام: رد شد',
        ),
      },
    });
    await this.audit.record({
      actorId: actor.id,
      actorRole: actor.role,
      category: 'CONTENT',
      action: 'رد درخواست استخدام',
      detail: `${actor.fullName} درخواست «${existing.firstName} ${existing.lastName}» را رد کرد.`,
      entityType: 'JobApplication',
      entityId: updated.id,
    });
    return { id: updated.id, status: updated.status };
  }
}
