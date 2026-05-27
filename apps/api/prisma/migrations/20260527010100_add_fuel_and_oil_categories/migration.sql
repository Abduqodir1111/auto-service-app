INSERT INTO "Category" ("id", "name", "slug", "description", "isActive", "createdAt", "updatedAt")
VALUES
  (
    gen_random_uuid(),
    'АЗС',
    'gas-station',
    'Автозаправочные станции, топливо и сопутствующие услуги.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    gen_random_uuid(),
    'Замена масла',
    'oil-change',
    'Замена моторного масла, фильтров и технических жидкостей.',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
