import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Cartable + referrals + messages (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function userId(username: string): Promise<string> {
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    return user.id;
  }

  /** A throwaway OPEN task for the given assignee, independent of seed data. */
  async function createFreshTask(assigneeId: string) {
    return prisma.cartableTask.create({
      data: {
        assigneeId,
        category: 'ADMIN',
        title: `تست ${crypto.randomUUID().slice(0, 8)}`,
        description: 'مورد تستی',
        senderLabelFa: 'تست',
      },
    });
  }

  // ── Listing & filters ─────────────────────────────────────────────────

  it('GET /cartable returns only the caller’s own tasks and per-category counts', async () => {
    const ceoId = await userId('ceo');
    const financeId = await userId('finance.karimi');
    const ceoTask = await createFreshTask(ceoId);
    const financeTask = await createFreshTask(financeId);

    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/cartable')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.tasks.map((t: { id: string }) => t.id);
    expect(ids).toContain(ceoTask.id);
    expect(ids).not.toContain(financeTask.id);
    expect(
      res.body.data.counts.ADMIN +
        res.body.data.counts.AGENCY +
        res.body.data.counts.MANAGER,
    ).toBe(res.body.data.totalOpen);
  });

  it('category= filters rows; counts stay unfiltered (KPI cards show all OPEN)', async () => {
    const ceoId = await userId('ceo');
    await createFreshTask(ceoId); // ADMIN
    await prisma.cartableTask.create({
      data: {
        assigneeId: ceoId,
        category: 'AGENCY',
        title: 'تست دسته',
        description: 'د',
        senderLabelFa: 'ت',
      },
    });

    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/cartable?category=AGENCY')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(
      res.body.data.tasks.every(
        (t: { category: string }) => t.category === 'AGENCY',
      ),
    ).toBe(true);
    expect(res.body.data.counts.ADMIN).toBeGreaterThan(0);
  });

  it('a non-exec role (IT_MANAGER) gets 403 on cartable endpoints', async () => {
    const { accessToken } = await loginAs(app, 'itadmin');
    const res = await request(app.getHttpServer())
      .get('/cartable')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  // ── Review actions ───────────────────────────────────────────────────

  it('approve/reject without a note → 400 with the design’s message', async () => {
    const ceoId = await userId('ceo');
    const task = await createFreshTask(ceoId);
    const { accessToken } = await loginAs(app, 'ceo');

    const res = await request(app.getHttpServer())
      .patch(`/cartable/${task.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('resolving an already-resolved task → 409; resolving someone else’s → 403', async () => {
    const ceoId = await userId('ceo');
    const task = await createFreshTask(ceoId);
    const ceo = await loginAs(app, 'ceo');

    const first = await request(app.getHttpServer())
      .patch(`/cartable/${task.id}/approve`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ note: 'تأیید شد' });
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .patch(`/cartable/${task.id}/reject`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ note: 'رد' });
    expect(second.status).toBe(409);

    const otherTask = await createFreshTask(await userId('finance.karimi'));
    const foreign = await request(app.getHttpServer())
      .patch(`/cartable/${otherTask.id}/approve`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ note: 'تأیید' });
    expect(foreign.status).toBe(403);
  });

  it('resolution writes an AuditLog row with the note', async () => {
    const ceoId = await userId('ceo');
    const task = await createFreshTask(ceoId);
    const { accessToken } = await loginAs(app, 'ceo');

    await request(app.getHttpServer())
      .patch(`/cartable/${task.id}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'دلیل مشخص' });

    const auditRow = await prisma.auditLog.findFirst({
      where: { entityType: 'CartableTask', entityId: task.id },
    });
    expect(auditRow).not.toBeNull();
    expect(auditRow!.detail).toContain('دلیل مشخص');
  });

  it('transfer creates a new OPEN task for the target and marks the original TRANSFERRED', async () => {
    const ceoId = await userId('ceo');
    const financeId = await userId('finance.karimi');
    const task = await createFreshTask(ceoId);
    const ceo = await loginAs(app, 'ceo');

    const res = await request(app.getHttpServer())
      .patch(`/cartable/${task.id}/transfer`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ toId: financeId, note: 'به مدیر مالی منتقل شود' });
    expect(res.status).toBe(200);
    expect(res.body.data.assigneeId).toBe(financeId);
    expect(res.body.data.status).toBe('OPEN');

    const original = await prisma.cartableTask.findUniqueOrThrow({
      where: { id: task.id },
    });
    expect(original.status).toBe('TRANSFERRED');
    expect(original.transferredToId).toBe(financeId);

    // The target actually sees it.
    const finance = await loginAs(app, 'finance.karimi');
    const list = await request(app.getHttpServer())
      .get('/cartable')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(list.body.data.tasks.map((t: { id: string }) => t.id)).toContain(
      res.body.data.id,
    );
  });

  it('transfer to a non-staff user → 400', async () => {
    const ceoId = await userId('ceo');
    const task = await createFreshTask(ceoId);
    const customer = await prisma.user.findFirstOrThrow({
      where: { role: 'USER' },
    });
    const { accessToken } = await loginAs(app, 'ceo');

    const res = await request(app.getHttpServer())
      .patch(`/cartable/${task.id}/transfer`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ toId: customer.id, note: 'انتقال' });
    expect(res.status).toBe(400);
  });

  // ── Chair permission gate ─────────────────────────────────────────────

  it('chair-permission full loop: request → chair cartable task → approve → requester sees APPROVED', async () => {
    // Fresh slate for the commercial manager's requests.
    const commId = await userId('comm.abbasi');
    await prisma.cartableTask.deleteMany({
      where: { sourceType: 'CHAIR_PERMISSION' },
    });
    await prisma.chairReportPermission.deleteMany({
      where: { requesterId: commId },
    });

    const comm = await loginAs(app, 'comm.abbasi');
    const created = await request(app.getHttpServer())
      .post('/cartable/chair-permission')
      .set('Authorization', `Bearer ${comm.accessToken}`);
    expect(created.status).toBe(201);

    // Duplicate while PENDING → 409.
    const dup = await request(app.getHttpServer())
      .post('/cartable/chair-permission')
      .set('Authorization', `Bearer ${comm.accessToken}`);
    expect(dup.status).toBe(409);

    // The chair received a cartable task and approves it.
    const chairTask = await prisma.cartableTask.findFirstOrThrow({
      where: { sourceType: 'CHAIR_PERMISSION', sourceId: created.body.data.id },
    });
    const chair = await loginAs(app, 'chair');
    const approve = await request(app.getHttpServer())
      .patch(`/cartable/${chairTask.id}/approve`)
      .set('Authorization', `Bearer ${chair.accessToken}`)
      .send({ note: 'مجوز صادر شد' });
    expect(approve.status).toBe(200);

    const status = await request(app.getHttpServer())
      .get('/cartable/chair-permission')
      .set('Authorization', `Bearer ${comm.accessToken}`);
    expect(status.body.data.latest.status).toBe('APPROVED');
  });

  it('chair-permission request as SENIOR_MANAGER → 403 (gate exists only in Finance/Commercial)', async () => {
    const { accessToken } = await loginAs(app, 'senior.rahimi');
    const res = await request(app.getHttpServer())
      .post('/cartable/chair-permission')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  // ── Referrals ────────────────────────────────────────────────────────

  it('creating a referral requires title/body/≥1 recipient and creates recipient cartable tasks', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const financeId = await userId('finance.karimi');

    const invalid = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ title: '', body: '', recipientIds: [] });
    expect(invalid.status).toBe(400);

    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({
        title: 'گزارش تستی',
        body: 'شرح تستی',
        recipientIds: [financeId],
        priority: 'HIGH',
      });
    expect(created.status).toBe(201);

    const recipientTask = await prisma.cartableTask.findFirst({
      where: {
        sourceType: 'MANAGER_REFERRAL',
        sourceId: created.body.data.id,
        assigneeId: financeId,
      },
    });
    expect(recipientTask).not.toBeNull();
    expect(recipientTask!.category).toBe('MANAGER');
  });

  it('POST /referrals as a non-senior role → 403; KPI counts reconcile with statuses', async () => {
    const finance = await loginAs(app, 'finance.karimi');
    const forbidden = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send({ title: 'ت', body: 'ت', recipientIds: [await userId('ceo')] });
    expect(forbidden.status).toBe(403);

    const senior = await loginAs(app, 'senior.rahimi');
    const list = await request(app.getHttpServer())
      .get('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(list.status).toBe(200);
    const { kpis, referrals } = list.body.data as {
      kpis: {
        total: number;
        awaitingReport: number;
        reported: number;
        closed: number;
      };
      referrals: { status: string }[];
    };
    expect(kpis.total).toBe(referrals.length);
    expect(kpis.awaitingReport).toBe(
      referrals.filter((r) => r.status === 'SENT' || r.status === 'REVIEWING')
        .length,
    );
  });

  it('a non-recipient, non-sender exec gets 403 on referral detail; a non-recipient cannot report', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const financeId = await userId('finance.karimi');
    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ title: 'محرمانه', body: 'شرح', recipientIds: [financeId] });

    const ceo = await loginAs(app, 'ceo');
    const detail = await request(app.getHttpServer())
      .get(`/referrals/${created.body.data.id}`)
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(detail.status).toBe(403);

    const report = await request(app.getHttpServer())
      .post(`/referrals/${created.body.data.id}/reports`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ body: 'گزارش نامربوط' });
    expect(report.status).toBe(403);
  });

  it('full referral loop: report flips to REPORTED, close only from REPORTED, revision back to REVIEWING', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const financeId = await userId('finance.karimi');
    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ title: 'چرخه کامل', body: 'شرح', recipientIds: [financeId] });
    const referralId = created.body.data.id as string;

    // Closing before any report → 409.
    const early = await request(app.getHttpServer())
      .patch(`/referrals/${referralId}/close`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(early.status).toBe(409);

    const finance = await loginAs(app, 'finance.karimi');
    const report = await request(app.getHttpServer())
      .post(`/referrals/${referralId}/reports`)
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send({ body: 'گزارش آماده است' });
    expect(report.status).toBe(201);

    const detail = await request(app.getHttpServer())
      .get(`/referrals/${referralId}`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(detail.body.data.status).toBe('REPORTED');
    expect(detail.body.data.reports).toHaveLength(1);

    const revision = await request(app.getHttpServer())
      .patch(`/referrals/${referralId}/request-revision`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(revision.status).toBe(200);
    expect(revision.body.data.status).toBe('REVIEWING');

    // Report again, then close.
    await request(app.getHttpServer())
      .post(`/referrals/${referralId}/reports`)
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send({ body: 'گزارش اصلاح‌شده' });
    const close = await request(app.getHttpServer())
      .patch(`/referrals/${referralId}/close`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(close.status).toBe(200);
    expect(close.body.data.status).toBe('CLOSED');

    // Reporting on a CLOSED referral → 409.
    const late = await request(app.getHttpServer())
      .post(`/referrals/${referralId}/reports`)
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send({ body: 'دیر شد' });
    expect(late.status).toBe(409);
  });

  // ── Attachments (Phase 29 — resolve raw StoredFile ids into metadata) ──
  const PNG_BYTES = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );

  it('a referral created with attachmentIds resolves real fileName/mimeType/sizeBytes in list() and detail(); myReferrals() resolves it for the recipient too', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const financeId = await userId('finance.karimi');

    const uploaded = await request(app.getHttpServer())
      .post('/files')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .attach('file', PNG_BYTES, {
        filename: 'مدرک.png',
        contentType: 'image/png',
      });
    const fileId = uploaded.body.data.id as string;

    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({
        title: 'با پیوست',
        body: 'شرح',
        recipientIds: [financeId],
        attachmentIds: [fileId],
      });
    expect(created.status).toBe(201);
    const referralId = created.body.data.id as string;

    const list = await request(app.getHttpServer())
      .get('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`);
    const listed = (
      list.body.data.referrals as {
        id: string;
        attachments: { id: string; fileName: string }[];
      }[]
    ).find((r) => r.id === referralId)!;
    expect(listed.attachments).toEqual([
      expect.objectContaining({
        id: fileId,
        fileName: 'مدرک.png',
        mimeType: 'image/png',
        sizeBytes: expect.any(Number),
      }),
    ]);

    const detail = await request(app.getHttpServer())
      .get(`/referrals/${referralId}`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(detail.body.data.attachments).toEqual([
      expect.objectContaining({ id: fileId, fileName: 'مدرک.png' }),
    ]);

    const finance = await loginAs(app, 'finance.karimi');
    const mine = await request(app.getHttpServer())
      .get('/referrals/mine')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    const mineRow = (
      mine.body.data.referrals as {
        id: string;
        attachments: { id: string; fileName: string }[];
      }[]
    ).find((r) => r.id === referralId)!;
    expect(mineRow.attachments).toEqual([
      expect.objectContaining({ id: fileId, fileName: 'مدرک.png' }),
    ]);
  });

  it('a report submitted with attachmentIds resolves real metadata inside detail().reports', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const financeId = await userId('finance.karimi');
    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({
        title: 'گزارش با پیوست',
        body: 'شرح',
        recipientIds: [financeId],
      });
    const referralId = created.body.data.id as string;

    const finance = await loginAs(app, 'finance.karimi');
    const uploaded = await request(app.getHttpServer())
      .post('/files')
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .attach('file', PNG_BYTES, {
        filename: 'گزارش.png',
        contentType: 'image/png',
      });
    const fileId = uploaded.body.data.id as string;

    await request(app.getHttpServer())
      .post(`/referrals/${referralId}/reports`)
      .set('Authorization', `Bearer ${finance.accessToken}`)
      .send({ body: 'گزارش آماده است', attachmentIds: [fileId] });

    const detail = await request(app.getHttpServer())
      .get(`/referrals/${referralId}`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(detail.body.data.reports[0].attachments).toEqual([
      expect.objectContaining({ id: fileId, fileName: 'گزارش.png' }),
    ]);
  });

  it('a referral with no attachments resolves to an empty array, not null/undefined', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const financeId = await userId('finance.karimi');
    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ title: 'بدون پیوست', body: 'شرح', recipientIds: [financeId] });
    const referralId = created.body.data.id as string;

    const detail = await request(app.getHttpServer())
      .get(`/referrals/${referralId}`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(detail.body.data.attachments).toEqual([]);
  });

  // ── GET /referrals/mine (Phase 26 — recipient-side listing) ────────────

  it('GET /referrals/mine returns only referrals where the caller is a recipient, not ones they sent', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const employeeId = await userId('com.ahmadi');
    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({
        title: 'ارجاع به کارمند',
        body: 'شرح',
        recipientIds: [employeeId],
      });
    expect(created.status).toBe(201);

    const employee = await loginAs(app, 'com.ahmadi');
    const mine = await request(app.getHttpServer())
      .get('/referrals/mine')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    expect(mine.status).toBe(200);
    const ids = (mine.body.data.referrals as { id: string }[]).map((r) => r.id);
    expect(ids).toContain(created.body.data.id);

    // The sender is not a recipient of their own referral.
    const seniorMine = await request(app.getHttpServer())
      .get('/referrals/mine')
      .set('Authorization', `Bearer ${senior.accessToken}`);
    const seniorIds = (seniorMine.body.data.referrals as { id: string }[]).map(
      (r) => r.id,
    );
    expect(seniorIds).not.toContain(created.body.data.id);
  });

  it('GET /referrals/mine: hasMyReport flips true only after this recipient reports, and counts reconcile', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const employeeId = await userId('com.ahmadi');
    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({
        title: 'گزارش من کجاست',
        body: 'شرح',
        recipientIds: [employeeId],
      });
    const referralId = created.body.data.id as string;

    const employee = await loginAs(app, 'com.ahmadi');
    const before = await request(app.getHttpServer())
      .get('/referrals/mine')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    const rowBefore = (
      before.body.data.referrals as { id: string; hasMyReport: boolean }[]
    ).find((r) => r.id === referralId)!;
    expect(rowBefore.hasMyReport).toBe(false);
    expect(before.body.data.counts.total).toBe(
      before.body.data.referrals.length,
    );
    expect(before.body.data.counts.awaitingMyReport).toBe(
      (
        before.body.data.referrals as { hasMyReport: boolean; status: string }[]
      ).filter((r) => !r.hasMyReport && r.status !== 'CLOSED').length,
    );

    await request(app.getHttpServer())
      .post(`/referrals/${referralId}/reports`)
      .set('Authorization', `Bearer ${employee.accessToken}`)
      .send({ body: 'گزارش من' });

    const after = await request(app.getHttpServer())
      .get('/referrals/mine')
      .set('Authorization', `Bearer ${employee.accessToken}`);
    const rowAfter = (
      after.body.data.referrals as { id: string; hasMyReport: boolean }[]
    ).find((r) => r.id === referralId)!;
    expect(rowAfter.hasMyReport).toBe(true);
  });

  it('GET /referrals/mine: 401 without login', async () => {
    const res = await request(app.getHttpServer()).get('/referrals/mine');
    expect(res.status).toBe(401);
  });

  it('approving a referral-sourced cartable task submits the note as the report', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const commId = await userId('comm.abbasi');
    const created = await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ title: 'از طریق کارتابل', body: 'شرح', recipientIds: [commId] });
    const referralId = created.body.data.id as string;

    const recipientTask = await prisma.cartableTask.findFirstOrThrow({
      where: {
        sourceType: 'MANAGER_REFERRAL',
        sourceId: referralId,
        assigneeId: commId,
      },
    });

    const comm = await loginAs(app, 'comm.abbasi');
    const approve = await request(app.getHttpServer())
      .patch(`/cartable/${recipientTask.id}/approve`)
      .set('Authorization', `Bearer ${comm.accessToken}`)
      .send({ note: 'گزارش من از طریق کارتابل' });
    expect(approve.status).toBe(200);

    const referral = await prisma.managerReferral.findUniqueOrThrow({
      where: { id: referralId },
      include: { reports: true },
    });
    expect(referral.status).toBe('REPORTED');
    expect(
      referral.reports.some((r) => r.body === 'گزارش من از طریق کارتابل'),
    ).toBe(true);
  });

  // ── Manager messages ─────────────────────────────────────────────────

  it('a message to FINANCE delivers exactly one cartable task to the finance manager', async () => {
    const ceo = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .post('/manager-messages')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ toDept: 'FINANCE', subject: 'موضوع تستی', body: 'متن تستی' });
    expect(res.status).toBe(201);
    expect(res.body.data.deliveredCount).toBe(1);

    const financeId = await userId('finance.karimi');
    const delivered = await prisma.cartableTask.findFirst({
      where: {
        sourceType: 'MANAGER_MESSAGE',
        sourceId: res.body.data.message.id,
        assigneeId: financeId,
      },
    });
    expect(delivered).not.toBeNull();
    expect(delivered!.title).toBe('موضوع تستی');
  });

  it('ALL_MANAGERS fans out to the other 4 exec roles (sender excluded); SUPPORT flags PARTIAL_DELIVERY', async () => {
    const ceo = await loginAs(app, 'ceo');
    const broadcast = await request(app.getHttpServer())
      .post('/manager-messages')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ toDept: 'ALL_MANAGERS', subject: 'اعلان عمومی', body: 'متن' });
    expect(broadcast.status).toBe(201);
    expect(broadcast.body.data.deliveredCount).toBe(4);

    const support = await request(app.getHttpServer())
      .post('/manager-messages')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ toDept: 'SUPPORT', subject: 'به پشتیبانی', body: 'متن' });
    expect(support.status).toBe(201);
    expect(support.body.data.deliveredCount).toBe(0);
    expect(support.body.data.warning).toBe('PARTIAL_DELIVERY');
  });

  it('GET /manager-messages/sent returns only the caller’s messages', async () => {
    const ceo = await loginAs(app, 'ceo');
    await request(app.getHttpServer())
      .post('/manager-messages')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ toDept: 'COMMERCIAL', subject: 'مال من', body: 'متن' });

    const finance = await loginAs(app, 'finance.karimi');
    const sent = await request(app.getHttpServer())
      .get('/manager-messages/sent')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(sent.status).toBe(200);
    expect(
      (sent.body.data as { subject: string }[]).every(
        (m) => m.subject !== 'مال من',
      ),
    ).toBe(true);
  });

  // ── Staff directory & agency-request wiring ─────────────────────────

  it('staff-directory lists active staff (no customers/agencies, not the caller)', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/staff-directory')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const rows = res.body.data as { id: string; role: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.role !== 'USER' && r.role !== 'AGENCY')).toBe(
      true,
    );
    const ceoId = await userId('ceo');
    expect(rows.every((r) => r.id !== ceoId)).toBe(true);
  });

  it('referring an agency membership request creates a cartable task for the referred-to manager', async () => {
    const financeId = await userId('finance.karimi');
    const reqRow = await prisma.agencyMembershipRequest.create({
      data: {
        applicantName: `متقاضی کارتابل ${crypto.randomUUID().slice(0, 6)}`,
        managerName: 'م',
        licenseNo: `AG-CT-${crypto.randomUUID().slice(0, 8)}`,
        city: 'تهران',
        phone: `+9893${crypto.randomUUID().replace(/\D/g, '').slice(0, 8)}`,
        email: `${crypto.randomUUID().slice(0, 8)}@x.example`,
        status: 'PENDING',
      },
    });

    const senior = await loginAs(app, 'senior.rahimi');
    const refer = await request(app.getHttpServer())
      .patch(`/agencies/requests/${reqRow.id}/refer`)
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ referredToId: financeId, note: 'بررسی اعتباری شود' });
    expect(refer.status).toBe(200);

    const task = await prisma.cartableTask.findFirst({
      where: {
        sourceType: 'AGENCY_REQUEST',
        sourceId: reqRow.id,
        assigneeId: financeId,
      },
    });
    expect(task).not.toBeNull();
    expect(task!.category).toBe('AGENCY');
  });
});
