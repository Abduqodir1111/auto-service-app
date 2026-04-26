// Helpers to keep the test DB clean between tests.
//
// `resetTestDb` truncates every Prisma-managed table (CASCADE so FKs go
// down with their parents). Categories are re-seeded after reset because
// many tests assume they exist (the catalog is keyed off them).

import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';

let prismaSingleton: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient();
  }
  return prismaSingleton;
}

const TABLES_IN_FK_SAFE_ORDER = [
  'ModerationLog',
  'Report',
  'Application',
  'Favorite',
  'Review',
  'WorkshopPhoto',
  'WorkshopService',
  'WorkshopCategory',
  'Workshop',
  'User',
  'Category',
];

export async function resetTestDb(): Promise<void> {
  const prisma = getTestPrisma();
  // One TRUNCATE … CASCADE call is faster than 11 sequential DELETEs and
  // resets identity sequences too.
  const tables = TABLES_IN_FK_SAFE_ORDER.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`,
  );
  await seedTestCategories();
}

export async function seedTestCategories(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.category.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Электрика', slug: 'electrics' },
      { name: 'Шиномонтаж', slug: 'tire-service' },
      { name: 'Двигатель', slug: 'engine' },
    ],
  });
}

export async function createTestUser(overrides: {
  phone: string;
  password: string;
  role: UserRole;
  fullName?: string;
}): Promise<{ id: string; phone: string; password: string; role: UserRole }> {
  const prisma = getTestPrisma();
  const passwordHash = await hash(overrides.password, 10);
  const user = await prisma.user.create({
    data: {
      phone: overrides.phone,
      fullName: overrides.fullName ?? `Test ${overrides.role}`,
      passwordHash,
      role: overrides.role,
    },
  });
  return {
    id: user.id,
    phone: user.phone,
    password: overrides.password,
    role: user.role,
  };
}

export async function createTestWorkshop(args: {
  ownerId: string;
  title?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  status?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';
}): Promise<string> {
  const prisma = getTestPrisma();
  const ws = await prisma.workshop.create({
    data: {
      ownerId: args.ownerId,
      title: args.title ?? 'Test workshop',
      description: 'Test description',
      phone: '+998900000000',
      addressLine: 'Test 1',
      city: args.city ?? 'Tashkent',
      latitude: args.latitude ?? null,
      longitude: args.longitude ?? null,
      status: args.status ?? 'APPROVED',
    },
  });
  return ws.id;
}
