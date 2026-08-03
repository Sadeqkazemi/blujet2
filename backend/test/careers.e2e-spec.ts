import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import * as crypto from 'node:crypto';
import { TypeORMClient } from '../generated/typeorm/client';
import { TypeORMPg } from '@typeorm/adapter-pg';
import { createTestApp } from './helpers/app.helper';
import { loginAs } from './helpers/login.helper';

const typeorm = new TypeORMClient({
  adapter: new TypeORMPg({ connectionString: process.env.DATABASE_URL }),
});

// Smallest valid PDF — enough for FileInterceptor + our mimetype check.
const PDF_BYTES = Buffer.from('%PDF-1.4\n%%EOF');
const VALID_NATIONAL_ID = '0012345679';

function auth(token: string | null | undefined) {
  return { Authorization: `Bearer ${token}` };
}

/** Phase 67 — فرصت‌های شغلی: public job listing/apply, SITE_ADMIN posting
 * CRUD + application review. See docs/API.md. */
describe('Careers (e2e)', () => {
  let app: INestApplication<App>;
  const createdPostingIds: string[] = [];
  const createdApplicationIds: string[] = [];

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(async () => {
    await typeorm.jobApplication.deleteMany({
      where: { id: { in: createdApplicationIds } },
    });
    await typeorm.jobPosting.deleteMany({
      where: { id: { in: createdPostingIds } },
    });
    await typeorm.careersSettings.updateMany({ data: { enabled: true } });
    await typeorm.$disconnect();
  });

  async function createPostingDirect(overrides?: { active?: boolean }) {
    const posting = await typeorm.jobPosting.create({
      data: {
        title: `تستر QA ${crypto.randomUUID().slice(0, 6)}`,
        dept: 'کنترل کیفیت',
        city: 'تهران',
        type: 'FULL_TIME',
        generalReqs: ['حداقل ۲ سال سابقه'],
        specialReqs: ['آشنایی با تست خودکار'],
        active: overrides?.active ?? true,
      },
    });
    createdPostingIds.push(posting.id);
    return posting;
  }

  describe('public: job listing + application', () => {
    it('GET /careers/jobs returns only active postings; GET /careers/jobs/:id 404s for unknown or inactive', async () => {
      const activePosting = await createPostingDirect();
      const inactivePosting = await createPostingDirect({ active: false });

      const list = await request(app.getHttpServer()).get('/careers/jobs');
      expect(list.status).toBe(200);
      const ids = list.body.data.map((j: { id: string }) => j.id);
      expect(ids).toContain(activePosting.id);
      expect(ids).not.toContain(inactivePosting.id);

      const detail = await request(app.getHttpServer()).get(
        `/careers/jobs/${activePosting.id}`,
      );
      expect(detail.status).toBe(200);
      expect(detail.body.data.generalReqs).toEqual(['حداقل ۲ سال سابقه']);

      const inactiveDetail = await request(app.getHttpServer()).get(
        `/careers/jobs/${inactivePosting.id}`,
      );
      expect(inactiveDetail.status).toBe(404);

      const unknown = await request(app.getHttpServer()).get(
        '/careers/jobs/00000000-0000-0000-0000-000000000000',
      );
      expect(unknown.status).toBe(404);
    });

    it('POST /careers/jobs/:id/apply — happy path with a PDF resume creates a SUBMITTED application', async () => {
      const posting = await createPostingDirect();
      const res = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'نگار')
        .field('lastName', 'رضایی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09121234567')
        .attach('resume', PDF_BYTES, {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      createdApplicationIds.push(res.body.data.id);

      const row = await typeorm.jobApplication.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(row.status).toBe('SUBMITTED');
      expect(row.jobTitleSnapshot).toBe(posting.title);
      expect(row.resumeFileName).toBe('resume.pdf');
    });

    it('POST .../apply succeeds without a resume file (resume columns stay null)', async () => {
      const posting = await createPostingDirect();
      const res = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'سارا')
        .field('lastName', 'محمدی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09121112233');
      expect(res.status).toBe(201);
      createdApplicationIds.push(res.body.data.id);

      const row = await typeorm.jobApplication.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(row.resumeFileName).toBeNull();
      expect(row.resumePath).toBeNull();
    });

    it('POST .../apply rejects a non-PDF resume with 400', async () => {
      const posting = await createPostingDirect();
      const res = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'نگار')
        .field('lastName', 'رضایی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09121234567')
        .attach('resume', Buffer.from('not a pdf'), {
          filename: 'resume.txt',
          contentType: 'text/plain',
        });
      expect(res.status).toBe(400);
    });

    it('POST .../apply rejects an oversize resume with 400', async () => {
      const posting = await createPostingDirect();
      const big = Buffer.alloc(3 * 1024 * 1024 + 500, 1);
      const res = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'نگار')
        .field('lastName', 'رضایی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09121234567')
        .attach('resume', big, {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        });
      expect(res.status).toBe(400);
    });

    it('POST .../apply validates required fields and the national-ID checksum', async () => {
      const posting = await createPostingDirect();

      const missingFields = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'نگار');
      expect(missingFields.status).toBe(400);

      const badNationalId = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'نگار')
        .field('lastName', 'رضایی')
        .field('nationalId', '1111111111')
        .field('phone', '09121234567');
      expect(badNationalId.status).toBe(400);
    });

    it('POST .../apply 404s for an unknown or inactive job id', async () => {
      const inactivePosting = await createPostingDirect({ active: false });
      const res = await request(app.getHttpServer())
        .post(`/careers/jobs/${inactivePosting.id}/apply`)
        .field('firstName', 'نگار')
        .field('lastName', 'رضایی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09121234567');
      expect(res.status).toBe(404);
    });

    it('POST .../apply is rate-limited per-IP', async () => {
      const posting = await createPostingDirect();
      const attempts = await Promise.all(
        Array.from({ length: 12 }, () =>
          request(app.getHttpServer())
            .post(`/careers/jobs/${posting.id}/apply`)
            .field('firstName', 'نگار')
            .field('lastName', 'رضایی')
            .field('nationalId', VALID_NATIONAL_ID)
            .field('phone', '09121234567'),
        ),
      );
      const successIds = attempts
        .filter((r) => r.status === 201)
        .map((r) => r.body.data.id as string);
      createdApplicationIds.push(...successIds);
      expect(attempts.some((r) => r.status === 429)).toBe(true);
    });

    it('national ID is stored encrypted, never in plaintext', async () => {
      const posting = await createPostingDirect();
      const res = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'نگار')
        .field('lastName', 'رضایی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09121234567');
      createdApplicationIds.push(res.body.data.id);

      const row = await typeorm.jobApplication.findUniqueOrThrow({
        where: { id: res.body.data.id },
      });
      expect(row.nationalIdEnc).not.toContain(VALID_NATIONAL_ID);
      expect(row.nationalIdHash).toBeTruthy();
      expect(row.nationalIdHash).not.toBe(VALID_NATIONAL_ID);
    });
  });

  describe('SITE_ADMIN: job-posting CRUD', () => {
    it('GET/POST/PATCH /careers/postings — SITE_ADMIN only, 403 for CEO', async () => {
      const admin = await loginAs(app, 'site.admin');

      const created = await request(app.getHttpServer())
        .post('/careers/postings')
        .set(auth(admin.accessToken))
        .send({
          title: 'کارشناس تست خودکار',
          dept: 'IT',
          city: 'تهران',
          type: 'FULL_TIME',
          generalReqs: ['۳ سال سابقه'],
          specialReqs: ['Playwright'],
        });
      expect(created.status).toBe(201);
      const postingId = created.body.data.id as string;
      createdPostingIds.push(postingId);
      expect(created.body.data.active).toBe(true);

      const list = await request(app.getHttpServer())
        .get('/careers/postings')
        .set(auth(admin.accessToken));
      expect(list.status).toBe(200);
      expect(
        list.body.data.some((p: { id: string }) => p.id === postingId),
      ).toBe(true);

      const updated = await request(app.getHttpServer())
        .patch(`/careers/postings/${postingId}`)
        .set(auth(admin.accessToken))
        .send({ active: false });
      expect(updated.status).toBe(200);
      expect(updated.body.data.active).toBe(false);

      const publicList = await request(app.getHttpServer()).get(
        '/careers/jobs',
      );
      expect(
        publicList.body.data.some((j: { id: string }) => j.id === postingId),
      ).toBe(false);

      const ceo = await loginAs(app, 'ceo');
      const forbidden = await request(app.getHttpServer())
        .get('/careers/postings')
        .set(auth(ceo.accessToken));
      expect(forbidden.status).toBe(403);
    });
  });

  describe('SITE_ADMIN: application review', () => {
    async function applyDirect(postingId: string) {
      const res = await request(app.getHttpServer())
        .post(`/careers/jobs/${postingId}/apply`)
        .field('firstName', 'نگار')
        .field('lastName', 'رضایی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09121234567')
        .attach('resume', PDF_BYTES, {
          filename: 'resume.pdf',
          contentType: 'application/pdf',
        });
      createdApplicationIds.push(res.body.data.id);
      return res.body.data.id as string;
    }

    it('GET /careers/applications — SITE_ADMIN only, 403 for other exec roles', async () => {
      const posting = await createPostingDirect();
      await applyDirect(posting.id);
      const admin = await loginAs(app, 'site.admin');

      const list = await request(app.getHttpServer())
        .get('/careers/applications')
        .set(auth(admin.accessToken));
      expect(list.status).toBe(200);
      expect(list.body.data.length).toBeGreaterThan(0);

      for (const username of [
        'ceo',
        'itadmin',
        'comm',
        'finance',
      ]) {
        const { accessToken } = await loginAs(app, username);
        const forbidden = await request(app.getHttpServer())
          .get('/careers/applications')
          .set(auth(accessToken));
        expect(forbidden.status).toBe(403);
      }
    });

    it('GET /careers/applications/:id returns full detail incl. computed referral targets', async () => {
      const posting = await createPostingDirect();
      const appId = await applyDirect(posting.id);
      const admin = await loginAs(app, 'site.admin');

      const detail = await request(app.getHttpServer())
        .get(`/careers/applications/${appId}`)
        .set(auth(admin.accessToken));
      expect(detail.status).toBe(200);
      expect(detail.body.data.nationalId).toBe(VALID_NATIONAL_ID);
      expect(detail.body.data.canAct).toBe(true);
      const labels = detail.body.data.referralTargets.map(
        (t: { labelFa: string }) => t.labelFa,
      );
      expect(labels.some((l: string) => l.includes('محمد رحیمی'))).toBe(true);
      expect(labels.some((l: string) => l.includes('رضا مرادی'))).toBe(true);
    });

    it('GET /careers/applications/:id/resume streams the PDF; 404 when there is none', async () => {
      const posting = await createPostingDirect();
      const withResumeId = await applyDirect(posting.id);
      const admin = await loginAs(app, 'site.admin');

      const withResume = await request(app.getHttpServer())
        .get(`/careers/applications/${withResumeId}/resume`)
        .set(auth(admin.accessToken));
      expect(withResume.status).toBe(200);
      expect(withResume.headers['content-type']).toContain('application/pdf');

      const noResumeRes = await request(app.getHttpServer())
        .post(`/careers/jobs/${posting.id}/apply`)
        .field('firstName', 'بدون رزومه')
        .field('lastName', 'تستی')
        .field('nationalId', VALID_NATIONAL_ID)
        .field('phone', '09129998877');
      createdApplicationIds.push(noResumeRes.body.data.id);

      const missing = await request(app.getHttpServer())
        .get(`/careers/applications/${noResumeRes.body.data.id}/resume`)
        .set(auth(admin.accessToken));
      expect(missing.status).toBe(404);
    });

    it('refer/hire/reject transitions + audit log; illegal transitions 409', async () => {
      const posting = await createPostingDirect();
      const appId = await applyDirect(posting.id);
      const admin = await loginAs(app, 'site.admin');
      const commercial = await typeorm.user.findUniqueOrThrow({
        where: { username: 'comm' },
      });

      const referred = await request(app.getHttpServer())
        .patch(`/careers/applications/${appId}/refer`)
        .set(auth(admin.accessToken))
        .send({ assigneeId: commercial.id });
      expect(referred.status).toBe(200);
      expect(referred.body.data.status).toBe('REFERRED');

      const auditRow = await typeorm.auditLog.findFirst({
        where: { entityType: 'JobApplication', entityId: appId },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow?.category).toBe('CONTENT');

      const rowAfterRefer = await typeorm.jobApplication.findUniqueOrThrow({
        where: { id: appId },
      });
      expect(
        Array.isArray(rowAfterRefer.history) && rowAfterRefer.history.length,
      ).toBe(2);

      const hired = await request(app.getHttpServer())
        .patch(`/careers/applications/${appId}/hire`)
        .set(auth(admin.accessToken));
      expect(hired.status).toBe(200);
      expect(hired.body.data.status).toBe('HIRED');

      const illegal = await request(app.getHttpServer())
        .patch(`/careers/applications/${appId}/reject`)
        .set(auth(admin.accessToken));
      expect(illegal.status).toBe(409);
    });

    it('refer with an invalid assigneeId → 400', async () => {
      const posting = await createPostingDirect();
      const appId = await applyDirect(posting.id);
      const admin = await loginAs(app, 'site.admin');

      const res = await request(app.getHttpServer())
        .patch(`/careers/applications/${appId}/refer`)
        .set(auth(admin.accessToken))
        .send({ assigneeId: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(400);
    });
  });

  describe('CareersSettings (footer visibility)', () => {
    it('GET /careers/settings is public; PATCH is SITE_ADMIN only and audits', async () => {
      const get = await request(app.getHttpServer()).get('/careers/settings');
      expect(get.status).toBe(200);
      expect(typeof get.body.data.enabled).toBe('boolean');

      const admin = await loginAs(app, 'site.admin');
      const patched = await request(app.getHttpServer())
        .patch('/careers/settings')
        .set(auth(admin.accessToken))
        .send({ enabled: false });
      expect(patched.status).toBe(200);
      expect(patched.body.data.enabled).toBe(false);

      const afterToggle = await request(app.getHttpServer()).get(
        '/careers/settings',
      );
      expect(afterToggle.body.data.enabled).toBe(false);

      // Careers pages themselves stay reachable regardless of the toggle.
      const jobs = await request(app.getHttpServer()).get('/careers/jobs');
      expect(jobs.status).toBe(200);

      const auditRow = await typeorm.auditLog.findFirst({
        where: { entityType: 'CareersSettings' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditRow?.category).toBe('CONTENT');

      await request(app.getHttpServer())
        .patch('/careers/settings')
        .set(auth(admin.accessToken))
        .send({ enabled: true });

      const ceo = await loginAs(app, 'ceo');
      const forbidden = await request(app.getHttpServer())
        .patch('/careers/settings')
        .set(auth(ceo.accessToken))
        .send({ enabled: false });
      expect(forbidden.status).toBe(403);
    });
  });
});
