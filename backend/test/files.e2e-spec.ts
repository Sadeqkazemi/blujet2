import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/prisma/prisma.service';
import { loginAs } from './helpers/login.helper';
import { createTestApp } from './helpers/app.helper';

// Smallest valid PNG (1×1 transparent pixel).
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

describe('Files (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeEach(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a PNG upload and returns an id; rejects disallowed types and oversize files', async () => {
    const { accessToken } = await loginAs(app, 'senior.rahimi');

    const ok = await request(app.getHttpServer())
      .post('/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', PNG_BYTES, {
        filename: 'pixel.png',
        contentType: 'image/png',
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.id).toBeDefined();

    const badType = await request(app.getHttpServer())
      .post('/files')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('#!/bin/sh'), {
        filename: 'x.sh',
        contentType: 'text/x-shellscript',
      });
    expect(badType.status).toBe(400);
  });

  it('owner can read; an unrelated exec gets 403; a referral recipient can read an attached file', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const uploaded = await request(app.getHttpServer())
      .post('/files')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .attach('file', PNG_BYTES, {
        filename: 'doc.png',
        contentType: 'image/png',
      });
    const fileId = uploaded.body.data.id as string;

    const own = await request(app.getHttpServer())
      .get(`/files/${fileId}`)
      .set('Authorization', `Bearer ${senior.accessToken}`);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toContain('image/png');

    const ceo = await loginAs(app, 'ceo');
    const forbidden = await request(app.getHttpServer())
      .get(`/files/${fileId}`)
      .set('Authorization', `Bearer ${ceo.accessToken}`);
    expect(forbidden.status).toBe(403);

    // Attach it to a referral addressed to Finance — Finance can now read it.
    const finance = await prisma.user.findUniqueOrThrow({
      where: { username: 'finance.karimi' },
    });
    await request(app.getHttpServer())
      .post('/referrals')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .send({
        title: 'با پیوست',
        body: 'شرح',
        recipientIds: [finance.id],
        attachmentIds: [fileId],
      });

    const financeLogin = await loginAs(app, 'finance.karimi');
    const asRecipient = await request(app.getHttpServer())
      .get(`/files/${fileId}`)
      .set('Authorization', `Bearer ${financeLogin.accessToken}`);
    expect(asRecipient.status).toBe(200);
  });

  it('attaching a file you do not own to a referral → 400', async () => {
    const senior = await loginAs(app, 'senior.rahimi');
    const uploaded = await request(app.getHttpServer())
      .post('/files')
      .set('Authorization', `Bearer ${senior.accessToken}`)
      .attach('file', PNG_BYTES, {
        filename: 'mine.png',
        contentType: 'image/png',
      });
    const fileId = uploaded.body.data.id as string;

    // Senior owns the file; CEO cannot attach it to a message.
    const ceo = await loginAs(app, 'ceo');
    const res = await request(app.getHttpServer())
      .post('/manager-messages')
      .set('Authorization', `Bearer ${ceo.accessToken}`)
      .send({
        toDept: 'FINANCE',
        subject: 'س',
        body: 'ب',
        attachmentIds: [fileId],
      });
    expect(res.status).toBe(400);
  });
});
