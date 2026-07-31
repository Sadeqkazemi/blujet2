import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { TypeORMService } from '../src/typeorm/typeorm.service';
import { loginAs, loginAsCustomer } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('Saved passengers (e2e)', () => {
  let app: INestApplication<App>;
  let typeorm: TypeORMService;

  beforeEach(async () => {
    app = await createTestApp();
    typeorm = app.get(TypeORMService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET/POST/PATCH/DELETE /my/saved-passengers — USER only; PII round-trip', async () => {
    const { accessToken, userId } = await loginAsCustomer(app, '09180000001');

    const create = await request(app.getHttpServer())
      .post('/my/saved-passengers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'محمد رضایی',
        latinName: 'Mohammad Rezaei',
        passportNo: 'A22113344',
      });
    expect(create.status).toBe(201);
    expect(create.body.data.latinName).toBe('MOHAMMAD REZAEI');
    expect(create.body.data.passportNo).toBe('A22113344');

    const list = await request(app.getHttpServer())
      .get('/my/saved-passengers')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const withNid = await request(app.getHttpServer())
      .post('/my/saved-passengers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'سارا احمدی',
        latinName: 'Sara Ahmadi',
        nationalId: '0012345679',
      });
    expect(withNid.status).toBe(201);

    const dup = await request(app.getHttpServer())
      .post('/my/saved-passengers')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'تکراری',
        latinName: 'Duplicate',
        nationalId: '0012345679',
      });
    expect(dup.status).toBe(409);

    const patch = await request(app.getHttpServer())
      .patch(`/my/saved-passengers/${create.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fullName: 'محمد رضایی (ویرایش)', isChild: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.fullName).toBe('محمد رضایی (ویرایش)');

    const del = await request(app.getHttpServer())
      .delete(`/my/saved-passengers/${create.body.data.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(del.status).toBe(200);

    const stored = await typeorm.savedPassenger.findMany({
      where: { userId: userId! },
    });
    expect(stored.every((r) => r.id !== create.body.data.id)).toBe(true);
    expect(stored.some((r) => r.passportNoEnc?.includes('A22113344'))).toBe(
      false,
    );
  });

  it('400 without id doc; 403 for staff; 404 when removing another user row', async () => {
    const customer = await loginAsCustomer(app, '09180000002');
    const bad = await request(app.getHttpServer())
      .post('/my/saved-passengers')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        fullName: 'بدون مدرک',
        latinName: 'No Doc',
      });
    expect(bad.status).toBe(400);

    const save = await request(app.getHttpServer())
      .post('/my/saved-passengers')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        fullName: 'کیان رضایی',
        latinName: 'Kian Rezaei',
        passportNo: 'C55667788',
        isChild: true,
      });
    expect(save.status).toBe(201);
    expect(save.body.data.isChild).toBe(true);

    const ceo = await loginAs(app, 'ceo');
    const forbidden = await request(app.getHttpServer())
      .get('/my/saved-passengers')
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(forbidden.status).toBe(403);

    const other = await loginAsCustomer(app, '09180000004');
    const notFound = await request(app.getHttpServer())
      .delete(`/my/saved-passengers/${save.body.data.id}`)
      .set('Authorization', `Bearer ${other.accessToken}`);
    expect(notFound.status).toBe(404);
  });
});
