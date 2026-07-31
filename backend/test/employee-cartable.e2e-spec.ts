import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as crypto from 'node:crypto';
import { TypeORMService } from '../src/typeorm/typeorm.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

describe('EMPLOYEE cartable (e2e)', () => {
  let app: INestApplication<App>;
  let typeorm: TypeORMService;

  beforeEach(async () => {
    app = await createTestApp();
    typeorm = app.get(TypeORMService);
  });

  afterEach(async () => {
    await app.close();
  });

  async function createEmployeeWithPermissions(permissionKeys: string[]) {
    const it = await loginAs(app, 'itadmin');
    const username = `ect.${crypto.randomUUID().slice(0, 8)}`;
    const res = await request(app.getHttpServer())
      .post('/it/employees')
      .set('Authorization', `Bearer ${it.accessToken}`)
      .send({
        fullName: 'کارمند کارتابل تست',
        username,
        password: 'Blujet@1404',
        dept: 'commercial',
        permissionKeys,
      });
    expect(res.status).toBe(201);
    return { username, id: res.body.data.id as string };
  }

  async function seedTaskFor(assigneeId: string) {
    const commercial = await typeorm.user.findUniqueOrThrow({
      where: { username: 'comm.abbasi' },
    });
    return typeorm.cartableTask.create({
      data: {
        assigneeId,
        category: 'ADMIN',
        title: 'کار تست کارمند',
        description: 'توضیح کار تست',
        senderId: commercial.id,
        senderLabelFa: 'مدیر بازرگانی',
      },
    });
  }

  it('sales.moradi nav includes cartable when ct_list+ct_process are granted', async () => {
    const { accessToken } = await loginAs(app, 'sales.moradi');
    const res = await request(app.getHttpServer())
      .get('/panels/nav')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    const keys = res.body.data.map((t: { key: string }) => t.key);
    expect(keys).toContain('cartable');
  });

  it("GET /cartable returns only the employee's own tasks with ct_list", async () => {
    const { username, id } = await createEmployeeWithPermissions(['ct_list', 'ct_process']);
    const other = await createEmployeeWithPermissions(['ct_list']);
    await seedTaskFor(id);
    await seedTaskFor(other.id);

    const { accessToken } = await loginAs(app, username);
    const res = await request(app.getHttpServer())
      .get('/cartable')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tasks).toHaveLength(1);
    expect(res.body.data.tasks[0].title).toBe('کار تست کارمند');
    expect(res.body.data.totalOpen).toBe(1);
  });

  it('employee without ct_list gets 403 on GET /cartable', async () => {
    const { username } = await createEmployeeWithPermissions(['ag_list']);
    const { accessToken } = await loginAs(app, username);
    const res = await request(app.getHttpServer())
      .get('/cartable')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(403);
  });

  it('PATCH approve marks task done; reject stays forbidden for EMPLOYEE', async () => {
    const { username, id } = await createEmployeeWithPermissions(['ct_list', 'ct_process']);
    const task = await seedTaskFor(id);
    const { accessToken } = await loginAs(app, username);

    const approve = await request(app.getHttpServer())
      .patch(`/cartable/${task.id}/approve`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'انجام شد' });
    expect(approve.status).toBe(200);

    const reject = await request(app.getHttpServer())
      .patch(`/cartable/${crypto.randomUUID()}/reject`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ note: 'x' });
    expect(reject.status).toBe(403);
  });

  it('POST /cartable/manager-message delivers a cartable task to the manager', async () => {
    const { username } = await createEmployeeWithPermissions(['ct_list', 'ct_process']);
    const manager = await typeorm.user.findUniqueOrThrow({
      where: { username: 'comm.abbasi' },
    });
    const { accessToken } = await loginAs(app, username);

    const send = await request(app.getHttpServer())
      .post('/cartable/manager-message')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ toId: manager.id, body: 'پیام تست کارمند' });
    expect(send.status).toBeGreaterThanOrEqual(200);
    expect(send.status).toBeLessThan(300);

    const mgrCartable = await request(app.getHttpServer())
      .get('/cartable')
      .set('Authorization', `Bearer ${(await loginAs(app, 'comm.abbasi')).accessToken}`);
    expect(mgrCartable.body.data.tasks.some((t: { title: string }) => t.title.includes('پیام'))).toBe(
      true,
    );

    const sent = await request(app.getHttpServer())
      .get('/cartable/manager-message/sent')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(sent.status).toBe(200);
    expect(sent.body.data).toHaveLength(1);
    expect(sent.body.data[0].body).toBe('پیام تست کارمند');
  });

  it('GET /panels/employee-context returns dept and permission labels', async () => {
    const { accessToken } = await loginAs(app, 'sales.moradi');
    const res = await request(app.getHttpServer())
      .get('/panels/employee-context')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deptLabelFa).toBeTruthy();
    expect(res.body.data.permissionLabelsFa).toContain('کارتابل');
  });
});
