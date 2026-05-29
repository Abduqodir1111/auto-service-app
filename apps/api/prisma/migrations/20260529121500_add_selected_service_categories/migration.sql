INSERT INTO "Category" ("id", "name", "slug", "description", "isActive", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'Автомойка',
    'car-wash',
    'Мойка кузова, салона, двигателя и комплексный уход за автомобилем.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Эвакуатор',
    'tow-truck',
    'Эвакуация автомобиля, помощь на дороге и перевозка транспорта.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Автосигнализация',
    'car-alarm',
    'Установка и настройка сигнализаций, иммобилайзеров и охранных систем.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Запчасти',
    'auto-parts',
    'Подбор, продажа и заказ автозапчастей для ремонта и обслуживания.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Техосмотр',
    'technical-inspection',
    'Проверка технического состояния автомобиля и подготовка к техосмотру.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Автоподбор',
    'car-selection',
    'Подбор автомобиля под бюджет, задачи и состояние рынка.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Проверка авто перед покупкой',
    'pre-purchase-inspection',
    'Диагностика кузова, двигателя, документов и истории перед покупкой.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Защитная пленка',
    'paint-protection-film',
    'Оклейка кузова защитной пленкой, бронепленка и защита ЛКП.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Электромобили',
    'electric-vehicles',
    'Диагностика, обслуживание и ремонт электромобилей и гибридных систем.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
