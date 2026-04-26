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

## Архитектурные заметки

- геолокация зарезервирована через PostGIS в PostgreSQL и поля `latitude` / `longitude`
- загрузка файлов идёт через S3-compatible abstraction и подходит для AWS S3, Cloudflare R2 и MinIO
- Redis подключается отдельным сервисом и может использоваться для кэша публичных списков, rate limiting и временных данных
- backend выделен по доменным модулям, чтобы позже без боли добавить карты, push, realtime и монетизацию
