// Convenience wrappers so individual specs don't repeat the
// "log in, capture JWT, attach Bearer header" choreography.

import { INestApplication } from '@nestjs/common';
import request from "supertest";

export type AuthedClient = {
  token: string;
  authHeader: string;
};

export async function loginAs(
  app: INestApplication,
  phone: string,
  password: string,
): Promise<AuthedClient> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ phone, password })
    .expect(201);

  const token: string = res.body.accessToken;
  return { token, authHeader: `Bearer ${token}` };
}
