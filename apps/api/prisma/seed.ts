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

  // Test accounts for App Store / Google Play review.
  // Reviewers can sign in directly with these credentials.
  // Same password for both to keep the review notes simple.
  const reviewPassword = await hash('Review2026!', 10);

  await prisma.user.upsert({
    where: { phone: '+998900000010' },
    update: {},
    create: {
      fullName: 'Review Client',
      phone: '+998900000010',
      email: 'review-client@mastertop.local',
      passwordHash: reviewPassword,
      role: UserRole.CLIENT,
    },
  });

  await prisma.user.upsert({
    where: { phone: '+998900000020' },
    update: {},
    create: {
      fullName: 'Review Master',
      phone: '+998900000020',
      email: 'review-master@mastertop.local',
      passwordHash: reviewPassword,
      role: UserRole.MASTER,
    },
  });

  const categories = [
    {
      name: 'Русификация',
      slug: 'localization',
      description: 'Русификация меню, мультимедиа и бортовых систем автомобиля.',
    },
    {
      name: 'Чип-тюнинг',
      slug: 'chip-tuning',
      description: 'Прошивка, настройка ЭБУ и оптимизация работы двигателя.',
    },
    {
      name: 'Автозвук',
      slug: 'car-audio',
      description: 'Установка магнитол, усилителей, сабвуферов и акустики.',
    },
    {
      name: 'GPS',
      slug: 'gps-tracking',
      description: 'Установка GPS-трекеров, навигации и систем мониторинга.',
    },
    {
      name: 'Шумоизоляция',
      slug: 'soundproofing',
      description: 'Шумо- и виброизоляция салона, дверей, пола и багажника.',
    },
    {
      name: 'Диагностика',
      slug: 'diagnostics',
      description: 'Компьютерная и ручная диагностика основных систем автомобиля.',
    },
    {
      name: 'Электрика',
      slug: 'electrics',
      description: 'Ремонт электропроводки, генераторов, стартеров и освещения.',
    },
    {
      name: 'Ходовая часть',
      slug: 'suspension',
      description: 'Ремонт подвески, амортизаторов, стоек и сайлентблоков.',
    },
    {
      name: 'Двигатель',
      slug: 'engine',
      description: 'Ремонт и обслуживание двигателя, навесного оборудования и ГРМ.',
    },
    {
      name: 'КПП',
      slug: 'transmission',
      description: 'Ремонт механических и автоматических коробок передач.',
    },
    {
      name: 'Тормоза',
      slug: 'brakes',
      description: 'Обслуживание тормозной системы, колодок, дисков и суппортов.',
    },
    {
      name: 'Шиномонтаж',
      slug: 'tire-service',
      description: 'Монтаж, балансировка, ремонт и сезонная замена шин.',
    },
    {
      name: 'Развал-схождение',
      slug: 'wheel-alignment',
      description: 'Настройка развала и схождения для правильной геометрии колёс.',
    },
    {
      name: 'Кондиционер',
      slug: 'air-conditioning',
      description: 'Диагностика, заправка и ремонт кондиционера и печки.',
    },
    {
      name: 'Кузовной ремонт',
      slug: 'body-repair',
      description: 'Рихтовка, восстановление кузова и устранение повреждений.',
    },
    {
      name: 'Покраска',
      slug: 'paint',
      description: 'Покраска деталей, локальный ремонт ЛКП и подбор цвета.',
    },
    {
      name: 'Автостекла',
      slug: 'auto-glass',
      description: 'Замена, ремонт и обслуживание автостёкол.',
    },
    {
      name: 'Тонировка',
      slug: 'tinting',
      description: 'Тонировка боковых, задних и лобовых стёкол по правилам.',
    },
    {
      name: 'Детейлинг',
      slug: 'detailing',
      description: 'Полировка, химчистка, защита кузова и уход за салоном.',
    },
    {
      name: 'Автоэлектроника и мультимедиа',
      slug: 'auto-electronics-multimedia',
      description: 'Установка камер, мультимедиа, датчиков, сигнализаций и аксессуаров.',
    },
    {
      name: 'Выездной мастер',
      slug: 'field-service',
      description: 'Ремонт и диагностика автомобиля с выездом к клиенту.',
    },
  ] as const;

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        isActive: true,
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
    });
  }

  await prisma.category.updateMany({
    where: {
      slug: {
        notIn: categories.map((category) => category.slug),
      },
    },
    data: {
      isActive: false,
    },
  });
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
