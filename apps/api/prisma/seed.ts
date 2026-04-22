import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hash('Admin123!', 10);

  await prisma.user.upsert({
    where: { phone: '+998900000001' },
    update: {},
    create: {
      fullName: 'Platform Admin',
      phone: '+998900000001',
      email: 'admin@stomvp.local',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
    },
  });

  const categories = [
    ['Диагностика', 'diagnostics'],
    ['Ходовая часть', 'suspension'],
    ['Электрика', 'electrics'],
    ['Двигатель', 'engine'],
    ['Кузовной ремонт', 'body-repair'],
    ['Шиномонтаж', 'tire-service'],
    ['Масло и фильтры', 'oil-service'],
  ] as const;

  for (const [name, slug] of categories) {
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
