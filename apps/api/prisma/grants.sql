-- STOMVP DB permissions setup
--
-- Применять КАК postgres-superuser:
--   sudo -u postgres psql -d stomvp -f apps/api/prisma/grants.sql
--
-- Делает 2 вещи:
--   1. Раздаёт права на ВСЕ существующие таблицы/секвенсы/функции в schema public роли stomvp
--   2. Настраивает ALTER DEFAULT PRIVILEGES — для всех БУДУЩИХ объектов в public,
--      созданных ролями postgres или stomvp, права на stomvp выдаются автоматически.
--
-- Идемпотентно: можно прогонять много раз без побочных эффектов.
--
-- История: исторически (до 2026-04-26) на проде встречалась ошибка
--   "permission denied for table User" — таблицы создавались под postgres,
--   а API ходит под stomvp. Этот скрипт превентивно решает проблему
--   на любом будущем чистом деплое.

-- 1) Существующие объекты
GRANT USAGE ON SCHEMA public TO stomvp;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER
    ON ALL TABLES IN SCHEMA public TO stomvp;
GRANT USAGE, SELECT, UPDATE
    ON ALL SEQUENCES IN SCHEMA public TO stomvp;
GRANT EXECUTE
    ON ALL FUNCTIONS IN SCHEMA public TO stomvp;

-- 2) Будущие объекты, созданные ролью postgres
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO stomvp;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO stomvp;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO stomvp;

-- 3) Будущие объекты, созданные ролью stomvp (если sometimes stomvp сам создаёт через Prisma)
ALTER DEFAULT PRIVILEGES FOR ROLE stomvp IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER ON TABLES TO stomvp;
ALTER DEFAULT PRIVILEGES FOR ROLE stomvp IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO stomvp;
ALTER DEFAULT PRIVILEGES FOR ROLE stomvp IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO stomvp;
