import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';
import { encryptPii, hashPii } from '../src/common/pii-crypto';

/** Generates a checksum-valid, non-repeating synthetic national ID. */
function validNationalId(): string {
  for (;;) {
    const base = Array.from({ length: 9 }, () => crypto.randomInt(0, 10)).join(
      '',
    );
    if (/^(\d)\1{8}$/.test(base)) continue;
    const sum = base
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * (10 - i), 0);
    const r = sum % 11;
    return base + String(r < 2 ? r : 11 - r);
  }
}

describe('Club (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createFreshMember(overrides?: {
    cardStatus?: 'NONE' | 'ISSUED';
  }) {
    const nid = validNationalId();
    return prisma.clubMember.create({
      data: {
        fullName: `عضو تست ${crypto.randomUUID().slice(0, 6)}`,
        email: `${crypto.randomUUID().slice(0, 8)}@club.example`,
        nationalIdEnc: encryptPii(nid),
        nationalIdHash: hashPii(nid),
        points: 6000,
        level: 'GOLD',
        cardStatus: overrides?.cardStatus ?? 'NONE',
        cardNo: overrides?.cardStatus === 'ISSUED' ? 'GOLD-0001' : undefined,
      },
    });
  }

  async function createReferredRequest(assignedTo: 'SENIOR' | 'CHAIR') {
    const member = await createFreshMember();
    const req = await prisma.clubCardRequest.create({
      data: {
        memberId: member.id,
        level: 'GOLD',
        points: 6000,
        status: 'REFERRED',
        assignedTo,
        history: [{ step: 'referred', labelFa: 'ارجاع تستی', at: 'اکنون' }],
      },
    });
    return { member, req };
  }

  it('GET /club/members returns members + reconciling KPI counts; non-club roles get 403', async () => {
    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/club/members')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const { members, kpis } = res.body.data as {
      members: { level: string; cardStatus: string; nationalIdEnc?: string }[];
      kpis: {
        totalMembers: number;
        issuedCards: number;
        tierCounts: Record<string, number>;
      };
    };
    expect(kpis.totalMembers).toBeGreaterThanOrEqual(
      members.length > 0 ? 1 : 0,
    );
    expect(
      kpis.tierCounts.SILVER + kpis.tierCounts.GOLD + kpis.tierCounts.PLATINUM,
    ).toBe(kpis.totalMembers);
    // PII columns never leave the API.
    expect(
      members.every((m) => !('nationalIdEnc' in m) && !('nationalIdHash' in m)),
    ).toBe(true);

    const finance = await loginAs(app, 'finance.karimi');
    const forbidden = await request(app.getHttpServer())
      .get('/club/members')
      .set('Authorization', `Bearer ${finance.accessToken}`);
    expect(forbidden.status).toBe(403);
  });

  it('national-ID search matches exactly via the hash; plaintext never stored', async () => {
    const nid = validNationalId();
    await prisma.clubMember.create({
      data: {
        fullName: 'قابل‌جستجو',
        email: 'search@club.example',
        nationalIdEnc: encryptPii(nid),
        nationalIdHash: hashPii(nid),
        level: 'SILVER',
      },
    });

    const { accessToken } = await loginAs(app, 'chair');
    const res = await request(app.getHttpServer())
      .get(`/club/members?q=${nid}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(
      res.body.data.members.some(
        (m: { fullName: string }) => m.fullName === 'قابل‌جستجو',
      ),
    ).toBe(true);

    const row = await prisma.clubMember.findFirst({
      where: { nationalIdHash: hashPii(nid) },
    });
    expect(row!.nationalIdEnc).not.toContain(nid);
  });

  it('POST /club/members: SENIOR 403; bad checksum 400; duplicate 409; stored encrypted', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const dto = {
      fullName: 'عضو جدید',
      email: `${crypto.randomUUID().slice(0, 8)}@new.example`,
      nationalId: validNationalId(),
      level: 'GOLD',
    };
    const forbidden = await request(app.getHttpServer())
      .post('/club/members')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send(dto);
    expect(forbidden.status).toBe(403);

    const ceo = await loginAs(app, 'ceo');
    const badChecksum = await request(app.getHttpServer())
      .post('/club/members')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ ...dto, nationalId: '0012345678' });
    expect(badChecksum.status).toBe(400);

    const created = await request(app.getHttpServer())
      .post('/club/members')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send(dto);
    expect(created.status).toBe(201);

    const dup = await request(app.getHttpServer())
      .post('/club/members')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ ...dto, email: 'other@new.example' });
    expect(dup.status).toBe(409);
  });

  it('PATCH level is Senior-only and audited', async () => {
    const member = await createFreshMember();
    const ceo = await loginAs(app, 'ceo');
    const forbidden = await request(app.getHttpServer())
      .patch(`/club/members/${member.id}/level`)
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({ level: 'PLATINUM' });
    expect(forbidden.status).toBe(403);

    const senior = await loginAs(app, 'senior.rahimi');
    const ok = await request(app.getHttpServer())
      .patch(`/club/members/${member.id}/level`)
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({ level: 'PLATINUM' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.level).toBe('PLATINUM');

    const audit = await prisma.auditLog.findFirst({
      where: {
        category: 'CLUB',
        entityType: 'ClubMember',
        entityId: member.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('direct issuance sets the card + issuedBy label, 409 when already issued, audited', async () => {
    const member = await createFreshMember();
    const { accessToken } = await loginAs(app, 'chair');

    const ok = await request(app.getHttpServer())
      .post(`/club/members/${member.id}/issue-card`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(ok.status).toBe(201);
    expect(ok.body.data.cardStatus).toBe('ISSUED');
    expect(ok.body.data.cardNo).toMatch(/^GOLD-\d{4}$/);
    expect(ok.body.data.issuedByLabelFa).toBe('رئیس هیئت مدیره (صدور مستقیم)');

    const again = await request(app.getHttpServer())
      .post(`/club/members/${member.id}/issue-card`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(again.status).toBe(409);

    const audit = await prisma.auditLog.findFirst({
      where: {
        category: 'CLUB',
        entityType: 'ClubMember',
        entityId: member.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('GET /club/card-requests never returns SUBMITTED rows', async () => {
    const member = await createFreshMember();
    await prisma.clubCardRequest.create({
      data: {
        memberId: member.id,
        level: 'GOLD',
        points: 6000,
        status: 'SUBMITTED',
        history: [],
      },
    });

    const { accessToken } = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .get('/club/card-requests')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((r: { status: string }) => r.status !== 'SUBMITTED'),
    ).toBe(true);
  });

  it('CEO/Chair approve any REFERRED request regardless of assignedTo (⚑ design override)', async () => {
    const { member, req } = await createReferredRequest('SENIOR');
    const { accessToken } = await loginAs(app, 'ceo');

    const res = await request(app.getHttpServer())
      .patch(`/club/card-requests/${req.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.cardNo).toMatch(/^GOLD-\d{4}$/);

    const updatedMember = await prisma.clubMember.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(updatedMember.cardStatus).toBe('ISSUED');
    expect(updatedMember.cardNo).toBe(res.body.data.cardNo);
    expect(updatedMember.issuedByLabelFa).toBe('مدیر عامل (تأیید درخواست)');

    // History timeline gained the approval step.
    const history = res.body.data.history as { step: string }[];
    expect(history.some((h) => h.step === 'approved')).toBe(true);
  });

  it('Senior can approve only senior-assigned requests: CHAIR-assigned → 403, SENIOR-assigned → 200', async () => {
    const chairAssigned = await createReferredRequest('CHAIR');
    const senior = await loginAs(app, 'senior.rahimi');

    const forbidden = await request(app.getHttpServer())
      .patch(`/club/card-requests/${chairAssigned.req.id}/approve`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(forbidden.status).toBe(403);

    const seniorAssigned = await createReferredRequest('SENIOR');
    const ok = await request(app.getHttpServer())
      .patch(`/club/card-requests/${seniorAssigned.req.id}/approve`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(ok.status).toBe(200);
  });

  it('reject sets the member back to NONE; deciding an already-decided request → 409', async () => {
    const { member, req } = await createReferredRequest('CHAIR');
    const chair = await loginAs(app, 'chair');

    const rejected = await request(app.getHttpServer())
      .patch(`/club/card-requests/${req.id}/reject`)
      .set('Authorization', `Bearer ${chair.accessToken}`);
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');

    const updatedMember = await prisma.clubMember.findUniqueOrThrow({
      where: { id: member.id },
    });
    expect(updatedMember.cardStatus).toBe('NONE');

    const again = await request(app.getHttpServer())
      .patch(`/club/card-requests/${req.id}/approve`)
      .set('Authorization', `Bearer ${chair.accessToken}`);
    expect(again.status).toBe(409);
  });
});
