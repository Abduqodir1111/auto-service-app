// PostGIS geo-search e2e tests.
//
// Covers:
//   - When lat+lng are provided, the catalog uses ST_DWithin/ST_Distance to
//     filter and sort by distance, and each item carries distanceMeters.
//   - radius works as a hard cut-off.
//   - Without lat+lng the response keeps the legacy shape (no distanceMeters).
//
// All workshops live around Tashkent so realistic distances can be asserted.

import { INestApplication } from '@nestjs/common';
import request from "supertest";
import { createTestApp } from './helpers/test-app';
import {
  createTestUser,
  createTestWorkshop,
  getTestPrisma,
  resetTestDb,
} from './helpers/test-db';
import { disconnectTestRedis, flushTestRedis } from './helpers/test-redis';

const TASHKENT_CENTER = { lat: 41.2995, lng: 69.2401 };

describe('Workshop geo-search (e2e)', () => {
  let app: INestApplication;
  let masterId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestDb();
    await flushTestRedis();

    const master = await createTestUser({
      phone: '+998900000020',
      password: 'MasterPass1!',
      role: 'MASTER',
    });
    masterId = master.id;

    // Three workshops at different distances from Tashkent center.
    // Coordinates chosen so the geodesic distance ordering is stable:
    //   - Near (~1 km north)
    //   - Mid (~10 km east)
    //   - Far (~250 km — Samarkand)
    await createTestWorkshop({
      ownerId: masterId,
      title: 'Near workshop',
      city: 'Tashkent',
      latitude: 41.31,
      longitude: 69.2401,
      status: 'APPROVED',
    });
    await createTestWorkshop({
      ownerId: masterId,
      title: 'Mid workshop',
      city: 'Tashkent',
      latitude: 41.2995,
      longitude: 69.36,
      status: 'APPROVED',
    });
    await createTestWorkshop({
      ownerId: masterId,
      title: 'Far workshop',
      city: 'Samarkand',
      latitude: 39.6542,
      longitude: 66.9597,
      status: 'APPROVED',
    });
  });

  afterAll(async () => {
    await app.close();
    await getTestPrisma().$disconnect();
    await disconnectTestRedis();
  });

  it('without lat/lng returns all 3 workshops without distanceMeters', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workshops')
      .expect(200);

    expect(res.body.meta.total).toBe(3);
    for (const item of res.body.data) {
      expect(item.distanceMeters).toBeUndefined();
    }
  });

  it('with lat+lng sorts by distance ascending and attaches distanceMeters', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workshops')
      .query({
        lat: TASHKENT_CENTER.lat,
        lng: TASHKENT_CENTER.lng,
        radius: 500_000,
      })
      .expect(200);

    expect(res.body.data).toHaveLength(3);
    const titles = res.body.data.map((w: { title: string }) => w.title);
    expect(titles).toEqual(['Near workshop', 'Mid workshop', 'Far workshop']);

    const distances: number[] = res.body.data.map(
      (w: { distanceMeters: number }) => w.distanceMeters,
    );
    // sanity: each ~ matches expected order of magnitude
    expect(distances[0]).toBeGreaterThan(0);
    expect(distances[0]).toBeLessThan(5_000); // < 5 km
    expect(distances[1]).toBeGreaterThan(5_000); // > 5 km
    expect(distances[1]).toBeLessThan(20_000); // < 20 km
    expect(distances[2]).toBeGreaterThan(200_000); // > 200 km
    // strictly ascending
    expect(distances[0]).toBeLessThan(distances[1]);
    expect(distances[1]).toBeLessThan(distances[2]);
  });

  it('radius excludes workshops beyond the cut-off', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workshops')
      .query({
        lat: TASHKENT_CENTER.lat,
        lng: TASHKENT_CENTER.lng,
        radius: 30_000, // 30 km — should drop the Samarkand one
      })
      .expect(200);

    expect(res.body.meta.total).toBe(2);
    const titles = res.body.data.map((w: { title: string }) => w.title);
    expect(titles).toContain('Near workshop');
    expect(titles).toContain('Mid workshop');
    expect(titles).not.toContain('Far workshop');
  });

  it('radius=500 m returns nothing because no workshop is that close', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/workshops')
      .query({
        lat: TASHKENT_CENTER.lat,
        lng: TASHKENT_CENTER.lng,
        radius: 500,
      })
      .expect(200);

    expect(res.body.meta.total).toBe(0);
    expect(res.body.data).toHaveLength(0);
  });
});
