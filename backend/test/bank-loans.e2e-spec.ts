import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { BankLoanApplication } from '../src/database/entities/bank-loan-application.entity';
import { BankLoanWebhookEvent } from '../src/database/entities/bank-loan-webhook-event.entity';
import { WalletEntry } from '../src/database/entities/wallet-entry.entity';
import {
  BANK_LOAN_PROVIDER,
  BankLoanHttpAdapter,
} from '../src/modules/loans/bank-loan.http.adapter';
import type { BankLoanProvider } from '../src/modules/loans/bank-loan.types';
import { loginAsCustomer } from './helpers/login.helper';

class FakeBank implements BankLoanProvider {
  created = 0;
  createApplication(req: {
    idempotencyKey: string;
    requestedAmountIrr: string;
  }) {
    this.created += 1;
    return Promise.resolve({
      bankReferenceId: `BANK-${req.idempotencyKey}-${this.created}`,
      bankStatus: 'SUBMITTED' as const,
      summary: { status: 'SUBMITTED' },
    });
  }
  getStatus(bankReferenceId: string) {
    return Promise.resolve({
      bankReferenceId,
      bankStatus: 'UNDER_REVIEW' as const,
      summary: { status: 'UNDER_REVIEW' },
    });
  }
}

function sign(payload: unknown) {
  const raw = JSON.stringify(payload);
  const sig = createHmac('sha256', 'e2e-bank-webhook-secret')
    .update(raw)
    .digest('hex');
  return { raw, sig };
}

describe('Bank loans adapter (e2e)', () => {
  let app: INestApplication<App>;
  let fake: FakeBank;
  let dataSource: DataSource;

  beforeEach(async () => {
    fake = new FakeBank();
    process.env.BANK_LOAN_WEBHOOK_SECRET = 'e2e-bank-webhook-secret';
    process.env.BANK_LOAN_PROVIDER = 'e2e-bank';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BANK_LOAN_PROVIDER)
      .useValue(fake)
      .overrideProvider(BankLoanHttpAdapter)
      .useValue(fake)
      .compile();
    app = moduleFixture.createNestApplication({
      bufferLogs: true,
      rawBody: true,
    });
    const logger = app.get(Logger);
    app.useLogger(logger);
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter(logger));
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await app.close();
  });

  async function postWebhook(payload: Record<string, unknown>) {
    const { sig } = sign(payload);
    return request(app.getHttpServer())
      .post('/webhooks/bank-loans')
      .set('Content-Type', 'application/json')
      .set('X-Bank-Signature', sig)
      .send(payload);
  }

  async function walletTopups(userId: string) {
    return dataSource.getRepository(WalletEntry).count({
      where: { userId, type: 'TOPUP' },
    });
  }

  it('create is idempotent; webhook updates status with valid signature', async () => {
    const { accessToken } = await loginAsCustomer(app, '09138880001');
    const key = `loan-e2e-${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/me/loan-applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ requestedAmountIrr: '500000000', idempotencyKey: key });
    expect(created.status).toBe(201);
    expect(created.body.data.displayStatus).toBe('awaiting_bank');
    expect(fake.created).toBe(1);

    const replay = await request(app.getHttpServer())
      .post('/me/loan-applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ requestedAmountIrr: '500000000', idempotencyKey: key });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(created.body.data.id);
    expect(fake.created).toBe(1);

    const payload = {
      eventId: `evt-${key}`,
      bankReferenceId: created.body.data.bankReferenceId,
      status: 'APPROVED',
      occurredAt: new Date().toISOString(),
    };
    const wh = await postWebhook(payload);
    expect(wh.status).toBe(200);

    const got = await request(app.getHttpServer())
      .get(`/me/loan-applications/${created.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(got.status).toBe(200);
    expect(got.body.data.displayStatus).toBe('approved');

    const dup = await postWebhook(payload);
    expect(dup.status).toBe(200);
    expect(dup.body.data.duplicate).toBe(true);

    const events = await dataSource.getRepository(BankLoanWebhookEvent).count({
      where: { eventId: payload.eventId },
    });
    expect(events).toBe(1);
  });

  it('PENDING and REJECTED never credit the wallet', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, '09138880011');
    expect(userId).toBeTruthy();
    const key = `loan-no-credit-${Date.now()}`;
    const amount = '750000000';
    const created = await request(app.getHttpServer())
      .post('/me/loan-applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ requestedAmountIrr: amount, idempotencyKey: key });
    expect(created.status).toBe(201);
    const before = await walletTopups(userId!);
    const ref = created.body.data.bankReferenceId as string;

    const pending = await postWebhook({
      eventId: `evt-pending-${key}`,
      bankReferenceId: ref,
      status: 'PENDING',
      walletCreditIrr: amount,
      walletCreditReference: `cred-pending-${key}`,
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(pending.status).toBe(200);

    const rejected = await postWebhook({
      eventId: `evt-rejected-${key}`,
      bankReferenceId: ref,
      status: 'REJECTED',
      walletCreditIrr: amount,
      walletCreditReference: `cred-rejected-${key}`,
      occurredAt: new Date().toISOString(),
    });
    expect(rejected.status).toBe(200);

    const after = await walletTopups(userId!);
    expect(after).toBe(before);
    const loan = await dataSource
      .getRepository(BankLoanApplication)
      .findOneByOrFail({ id: created.body.data.id });
    expect(loan.walletCreditReference).toBeNull();
    expect(loan.bankStatus).toBe('REJECTED');
  });

  it('duplicate/concurrent DISBURSED credits wallet only once', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, '09138880012');
    const key = `loan-disb-${Date.now()}`;
    const amount = '600000000';
    const created = await request(app.getHttpServer())
      .post('/me/loan-applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ requestedAmountIrr: amount, idempotencyKey: key });
    expect(created.status).toBe(201);
    const before = await walletTopups(userId!);
    const ref = created.body.data.bankReferenceId as string;
    const creditRef = `cred-disb-${key}`;
    const occurredAt = new Date().toISOString();

    const payloads = [1, 2].map((n) => ({
      eventId: `evt-disb-${key}-${n}`,
      bankReferenceId: ref,
      status: 'DISBURSED',
      walletCreditIrr: amount,
      walletCreditReference: creditRef,
      occurredAt,
    }));

    const results = await Promise.all(payloads.map((p) => postWebhook(p)));
    for (const r of results) expect(r.status).toBe(200);

    const after = await walletTopups(userId!);
    expect(after - before).toBe(1);
    const loan = await dataSource
      .getRepository(BankLoanApplication)
      .findOneByOrFail({ id: created.body.data.id });
    expect(loan.walletCreditReference).toBe(creditRef);
    expect(loan.bankStatus).toBe('DISBURSED');
  });

  it('same idempotencyKey across users does not leak entities', async () => {
    const a = await loginAsCustomer(app, '09138880013');
    const b = await loginAsCustomer(app, '09138880014');
    const key = `shared-key-${Date.now()}`;
    const amount = '400000000';

    const createdA = await request(app.getHttpServer())
      .post('/me/loan-applications')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ requestedAmountIrr: amount, idempotencyKey: key });
    expect(createdA.status).toBe(201);

    const createdB = await request(app.getHttpServer())
      .post('/me/loan-applications')
      .set('Authorization', `Bearer ${b.accessToken}`)
      .send({ requestedAmountIrr: amount, idempotencyKey: key });
    expect(createdB.status).toBe(201);
    expect(createdB.body.data.id).not.toBe(createdA.body.data.id);
    expect(createdB.body.data.bankReferenceId).not.toBe(
      createdA.body.data.bankReferenceId,
    );

    const leak = await request(app.getHttpServer())
      .get(`/me/loan-applications/${createdA.body.data.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`);
    expect(leak.status).toBe(404);

    const own = await request(app.getHttpServer())
      .get(`/me/loan-applications/${createdB.body.data.id}`)
      .set('Authorization', `Bearer ${b.accessToken}`);
    expect(own.status).toBe(200);
    expect(own.body.data.id).toBe(createdB.body.data.id);
  });

  it('stale webhook cannot rollback DISBURSED/REJECTED', async () => {
    const { accessToken } = await loginAsCustomer(app, '09138880015');
    const key = `loan-stale-${Date.now()}`;
    const created = await request(app.getHttpServer())
      .post('/me/loan-applications')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ requestedAmountIrr: '300000000', idempotencyKey: key });
    expect(created.status).toBe(201);
    const ref = created.body.data.bankReferenceId as string;

    const newer = await postWebhook({
      eventId: `evt-new-${key}`,
      bankReferenceId: ref,
      status: 'DISBURSED',
      walletCreditIrr: '300000000',
      walletCreditReference: `cred-stale-${key}`,
      occurredAt: new Date('2026-08-09T12:00:00.000Z').toISOString(),
    });
    expect(newer.status).toBe(200);

    const stale = await postWebhook({
      eventId: `evt-old-${key}`,
      bankReferenceId: ref,
      status: 'PENDING',
      occurredAt: new Date('2026-08-09T10:00:00.000Z').toISOString(),
    });
    expect(stale.status).toBe(200);
    expect(stale.body.data.ignored).toBe(true);

    const got = await request(app.getHttpServer())
      .get(`/me/loan-applications/${created.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(got.body.data.displayStatus).toBe('disbursed');
    expect(got.body.data.bankStatus).toBe('DISBURSED');
  });
});
