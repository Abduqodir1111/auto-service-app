# MasterTop

Monorepo для MVP-платформы поиска СТО, автомастеров и автосервисов.

## Что внутри

- `apps/api` — NestJS API c Prisma, PostgreSQL, Redis и S3-compatible storage
- `apps/admin` — React + Vite админ-панель
- `apps/mobile` — React Native + Expo мобильное приложение
- `packages/shared` — общие типы и enum-ы
- `infra` — инфраструктурные скрипты и конфиги

## MVP-функции

- регистрация и логин
- роли `CLIENT`, `MASTER`, `ADMIN`
- каталог мастерских и мастеров
- карточка мастерской с услугами, ценами, фото, адресом и контактами
- отзывы, рейтинг, избранное и заявки
- админ-модерация мастерских, отзывов, фото и категорий
- подготовка под Redis, PostGIS, S3, push, геопоиск и платные функции

## Быстрый старт

1. Скопируйте `.env.example` в корне и `.env.example` внутри `apps/api`, `apps/admin`, `apps/mobile`.
2. Поднимите инфраструктуру:

```bash
docker compose up -d
```

3. Установите зависимости:

```bash
npm install
```

4. Сгенерируйте Prisma client и примените схему:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

5. (Только для prod / shared DB) Раздайте права роли API на таблицы и настройте default
privileges, чтобы будущие миграции не упирались в `permission denied`:

```bash
sudo -u postgres psql -d stomvp -f apps/api/prisma/grants.sql
```

5. Запустите приложения:

```bash
npm run dev:api
npm run dev:admin
npm run dev:mobile
```

## Тесты

E2E-тесты на API живут в `apps/api/test/*.e2e-spec.ts`. Используют изолированный
Postgres + Redis в Docker (`apps/api/test/docker-compose.test.yml`) на портах
5435 и 6382 соответственно — никакой пересечки с локальным dev-окружением.

Запуск:

```bash
# 1. Поднять test postgres + redis
npm run test:db:up

# 2. Прогнать тесты
npm test

# 3. (опционально) Снять test-стек
npm run test:db:down
```

Покрыто:
- **Auth flow** — request-code / verify-code / register через review-bypass
  телефон `+998900000099` с фиксированным кодом `00000`. Login (правильный
  пароль / неправильный пароль / неизвестный номер / заблокированный юзер).
  `/auth/me` с токеном и без.
- **Workshops** — публичный каталог (только APPROVED), детали по id, 404 на
  unknown, role guards (CLIENT не может POST workshop, anon → 401).
- **Геопоиск (PostGIS)** — без `lat/lng` старая логика; с `lat+lng` сортировка
  по `ST_Distance` ascending, `distanceMeters` в ответе; `radius` как hard
  cut-off; `radius=500` → 0 результатов.

## Архитектурные заметки

- геолокация зарезервирована через PostGIS в PostgreSQL и поля `latitude` / `longitude`
- загрузка файлов идёт через S3-compatible abstraction и подходит для AWS S3, Cloudflare R2 и MinIO
- Redis подключается отдельным сервисом и может использоваться для кэша публичных списков, rate limiting и временных данных
- backend выделен по доменным модулям, чтобы позже без боли добавить карты, push, realtime и монетизацию
