import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  BANK_LOAN_PROVIDER,
  BankLoanHttpAdapter,
} from '../src/modules/loans/bank-loan.http.adapter';
import type { BankLoanProvider } from '../src/modules/loans/bank-loan.types';
import { loginAsCustomer } from './helpers/login.helper';

class FakeBank implements BankLoanProvider {
  created = 0;
  async createApplication(req: {
    idempotencyKey: string;
    requestedAmountIrr: string;
  }) {
    this.created += 1;
    return {
      bankReferenceId: `BANK-${req.idempotencyKey}`,
      bankStatus: 'SUBMITTED' as const,
      summary: { status: 'SUBMITTED' },
    };
  }
  async getStatus(bankReferenceId: string) {
    return {
      bankReferenceId,
      bankStatus: 'UNDER_REVIEW' as const,
      summary: { status: 'UNDER_REVIEW' },
    };
  }
}

describe('Bank loans adapter (e2e)', () => {
  let app: INestApplication<App>;
  let fake: FakeBank;

  beforeEach(async () => {
    fake = new FakeBank();
    process.env.BANK_LOAN_WEBHOOK_SECRET = 'e2e-bank-webhook-secret';
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
  });

  afterEach(async () => {
    await app.close();
  });

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
    };
    const raw = JSON.stringify(payload);
    const sig = createHmac('sha256', 'e2e-bank-webhook-secret')
      .update(raw)
      .digest('hex');
    const wh = await request(app.getHttpServer())
      .post('/webhooks/bank-loans')
      .set('Content-Type', 'application/json')
      .set('X-Bank-Signature', sig)
      .send(payload);
    expect(wh.status).toBe(200);

    const got = await request(app.getHttpServer())
      .get(`/me/loan-applications/${created.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(got.status).toBe(200);
    expect(got.body.data.displayStatus).toBe('approved');

    const dup = await request(app.getHttpServer())
      .post('/webhooks/bank-loans')
      .set('Content-Type', 'application/json')
      .set('X-Bank-Signature', sig)
      .send(payload);
    expect(dup.status).toBe(200);
    expect(dup.body.data.duplicate).toBe(true);
  });
});
