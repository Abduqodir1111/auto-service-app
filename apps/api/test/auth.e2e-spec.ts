// Auth flow e2e tests.
//
// Critical paths covered:
//   - Phone-based registration (request-code → verify-code → register) using
//     the review-bypass phone +998900000099, which is wired to never call
//     DevSMS and to accept the fixed code 00000.
//   - Login: happy path returns a JWT, wrong password gives 401, unknown
//     phone gives 401, blocked user can't log in.
//   - GET /api/auth/me: rejects requests without a Bearer token.

import { INestApplication } from '@nestjs/common';
import request from "supertest";
import { createTestApp } from './helpers/test-app';
import { createTestUser, getTestPrisma, resetTestDb } from './helpers/test-db';
import { disconnectTestRedis, flushTestRedis } from './helpers/test-redis';

const REVIEW_PHONE = '+998900000099';
const REVIEW_CODE = '00000';

describe('Auth (e2e)', () => {
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

  describe('POST /api/auth/register/request-code', () => {
    it('returns 201 for a fresh phone (review bypass — no SMS sent)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register/request-code')
        .send({ phone: REVIEW_PHONE })
        .expect(201);

      expect(res.body).toMatchObject({
        success: true,
        expiresIn: expect.any(Number),
        resendIn: expect.any(Number),
      });
    });

    it('returns 409 when the phone already belongs to a user', async () => {
      await createTestUser({
        phone: REVIEW_PHONE,
        password: 'IrrelevantPwd1!',
        role: 'CLIENT',
      });

      await request(app.getHttpServer())
        .post('/api/auth/register/request-code')
        .send({ phone: REVIEW_PHONE })
        .expect(409);
    });
  });

  describe('POST /api/auth/register/verify-code', () => {
    it('returns 400 when the code is wrong', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register/request-code')
        .send({ phone: REVIEW_PHONE })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register/verify-code')
        .send({ phone: REVIEW_PHONE, code: '11111' })
        .expect(400);

      expect(res.body.message).toMatch(/Неверный код/);
    });

    it('returns 400 with no pending code', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register/verify-code')
        .send({ phone: REVIEW_PHONE, code: REVIEW_CODE })
        .expect(400);
    });

    it('returns 201 with a verificationToken for the bypass code', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register/request-code')
        .send({ phone: REVIEW_PHONE })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register/verify-code')
        .send({ phone: REVIEW_PHONE, code: REVIEW_CODE })
        .expect(201);

      expect(res.body).toMatchObject({
        verificationToken: expect.any(String),
        expiresIn: expect.any(Number),
      });
    });
  });

  describe('full register flow (request → verify → register)', () => {
    it('produces a usable account with a JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register/request-code')
        .send({ phone: REVIEW_PHONE })
        .expect(201);

      const verify = await request(app.getHttpServer())
        .post('/api/auth/register/verify-code')
        .send({ phone: REVIEW_PHONE, code: REVIEW_CODE })
        .expect(201);

      const register = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          phone: REVIEW_PHONE,
          fullName: 'Brand New User',
          password: 'NewUserPass1!',
          role: 'CLIENT',
          verificationToken: verify.body.verificationToken,
        })
        .expect(201);

      expect(register.body).toMatchObject({
        accessToken: expect.any(String),
        user: {
          phone: REVIEW_PHONE,
          fullName: 'Brand New User',
          role: 'CLIENT',
          isBlocked: false,
        },
      });

      // The newly-registered user can immediately log in with the same password.
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: REVIEW_PHONE, password: 'NewUserPass1!' })
        .expect(201);

      expect(login.body.accessToken).toEqual(expect.any(String));
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createTestUser({
        phone: '+998900000010',
        password: 'CorrectPass1!',
        role: 'CLIENT',
        fullName: 'Existing User',
      });
    });

    it('returns a JWT for correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '+998900000010', password: 'CorrectPass1!' })
        .expect(201);

      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        user: { phone: '+998900000010', role: 'CLIENT' },
      });
    });

    it('rejects a wrong password with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '+998900000010', password: 'WrongPwd1!' })
        .expect(401);
    });

    it('rejects an unknown phone with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '+998900000999', password: 'CorrectPass1!' })
        .expect(401);
    });

    it('refuses login for a blocked user', async () => {
      await getTestPrisma().user.update({
        where: { phone: '+998900000010' },
        data: { isBlocked: true },
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '+998900000010', password: 'CorrectPass1!' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns 401 without a Bearer token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns the current user with a valid token', async () => {
      await createTestUser({
        phone: '+998900000011',
        password: 'MePass1234!',
        role: 'MASTER',
        fullName: 'Me Tester',
      });

      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ phone: '+998900000011', password: 'MePass1234!' })
        .expect(201);

      const me = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);

      expect(me.body).toMatchObject({
        phone: '+998900000011',
        role: 'MASTER',
      });
    });
  });
});
