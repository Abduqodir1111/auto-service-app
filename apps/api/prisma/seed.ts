import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const seedAdminPhone = process.env.SEED_ADMIN_PHONE?.trim();
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (seedAdminPhone && seedAdminPassword) {
    const adminPassword = await hash(seedAdminPassword, 10);

    await prisma.user.upsert({
      where: { phone: seedAdminPhone },
      update: {
        passwordHash: adminPassword,
        role: UserRole.ADMIN,
        isBlocked: false,
      },
      create: {
        fullName: process.env.SEED_ADMIN_NAME?.trim() || 'Platform Admin',
        phone: seedAdminPhone,
        email: process.env.SEED_ADMIN_EMAIL?.trim() || null,
        passwordHash: adminPassword,
        role: UserRole.ADMIN,
      },
    });
  } else {
    console.log('Skipping admin seed: set SEED_ADMIN_PHONE and SEED_ADMIN_PASSWORD if needed.');
  }

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
      name: 'Автомойка',
      slug: 'car-wash',
      description: 'Мойка кузова, салона, двигателя и комплексный уход за автомобилем.',
    },
    {
      name: 'Эвакуатор',
      slug: 'tow-truck',
      description: 'Эвакуация автомобиля, помощь на дороге и перевозка транспорта.',
    },
    {
      name: 'Автосигнализация',
      slug: 'car-alarm',
      description: 'Установка и настройка сигнализаций, иммобилайзеров и охранных систем.',
    },
    {
      name: 'АЗС',
      slug: 'gas-station',
      description: 'Автозаправочные станции, топливо и сопутствующие услуги.',
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
      name: 'Замена масла',
      slug: 'oil-change',
      description: 'Замена моторного масла, фильтров и технических жидкостей.',
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
      name: 'Запчасти',
      slug: 'auto-parts',
      description: 'Подбор, продажа и заказ автозапчастей для ремонта и обслуживания.',
    },
    {
      name: 'Техосмотр',
      slug: 'technical-inspection',
      description: 'Проверка технического состояния автомобиля и подготовка к техосмотру.',
    },
    {
      name: 'Автоподбор',
      slug: 'car-selection',
      description: 'Подбор автомобиля под бюджет, задачи и состояние рынка.',
    },
    {
      name: 'Проверка авто перед покупкой',
      slug: 'pre-purchase-inspection',
      description: 'Диагностика кузова, двигателя, документов и истории перед покупкой.',
    },
    {
      name: 'Защитная пленка',
      slug: 'paint-protection-film',
      description: 'Оклейка кузова защитной пленкой, бронепленка и защита ЛКП.',
    },
    {
      name: 'Электромобили',
      slug: 'electric-vehicles',
      description: 'Диагностика, обслуживание и ремонт электромобилей и гибридных систем.',
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
