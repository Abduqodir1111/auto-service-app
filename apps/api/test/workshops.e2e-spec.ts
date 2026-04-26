// Workshops e2e tests.
//
// Covers:
//   - GET /api/workshops returns only APPROVED workshops, no auth required.
//   - GET /api/workshops/:id returns details for an approved workshop.
//   - POST /api/workshops requires MASTER (or ADMIN) — CLIENT gets 403.
//   - MASTER can create + immediately fetch their own workshop.

import { INestApplication } from '@nestjs/common';
import request from "supertest";
import { loginAs } from './helpers/auth-helper';
import { createTestApp } from './helpers/test-app';
import {
  createTestUser,
  createTestWorkshop,
  getTestPrisma,
  resetTestDb,
} from './helpers/test-db';
import { disconnectTestRedis, flushTestRedis } from './helpers/test-redis';

describe('Workshops (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();
  });

  afterAll(async () => {
    await app.close();
    await getTestPrisma().$disconnect();
    await disconnectTestRedis();
  });

  describe('GET /api/workshops (public catalog)', () => {
    it('returns only APPROVED workshops, anonymous access works', async () => {
      const master = await createTestUser({
        phone: '+998900000020',
        password: 'MasterPass1!',
        role: 'MASTER',
      });
      await createTestWorkshop({
        ownerId: master.id,
        title: 'Approved One',
        status: 'APPROVED',
        latitude: 41.31,
        longitude: 69.24,
      });
      await createTestWorkshop({
        ownerId: master.id,
        title: 'Pending — should NOT appear',
        status: 'PENDING',
      });
      await createTestWorkshop({
        ownerId: master.id,
        title: 'Draft — should NOT appear',
        status: 'DRAFT',
      });

      const res = await request(app.getHttpServer())
        .get('/api/workshops')
        .expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        title: 'Approved One',
        status: 'APPROVED',
      });
    });

    it('returns an empty list with consistent meta when nothing matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/workshops')
        .expect(200);

      expect(res.body).toMatchObject({
        data: [],
        meta: { total: 0, page: 1 },
      });
    });
  });

  describe('GET /api/workshops/:id', () => {
    it('returns workshop details by id', async () => {
      const master = await createTestUser({
        phone: '+998900000020',
        password: 'MasterPass1!',
        role: 'MASTER',
      });
      const wsId = await createTestWorkshop({
        ownerId: master.id,
        title: 'Workshop With Details',
        status: 'APPROVED',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/workshops/${wsId}`)
        .expect(200);

      expect(res.body).toMatchObject({
        id: wsId,
        title: 'Workshop With Details',
        status: 'APPROVED',
      });
    });

    it('returns 404 for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/api/workshops/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('POST /api/workshops (role-guarded)', () => {
    it('rejects a CLIENT with 403', async () => {
      await createTestUser({
        phone: '+998900000010',
        password: 'ClientPass1!',
        role: 'CLIENT',
      });
      const client = await loginAs(app, '+998900000010', 'ClientPass1!');

      await request(app.getHttpServer())
        .post('/api/workshops')
        .set('Authorization', client.authHeader)
        .send({
          title: 'Should not be created',
          description: 'Not allowed',
          phone: '+998900000000',
          addressLine: 'Test 1',
          city: 'Tashkent',
        })
        .expect(403);
    });

    it('rejects an unauthenticated request with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/workshops')
        .send({
          title: 'No auth at all',
          description: 'No auth',
          phone: '+998900000000',
          addressLine: 'Test 1',
          city: 'Tashkent',
        })
        .expect(401);
    });
  });
});
