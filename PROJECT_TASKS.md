# MasterTop Project Tasks

Last updated: 2026-05-25

## Срочно

- [x] Починить локальное окружение: переустановить зависимости и добиться, чтобы API и admin собирались без ошибок.
- [x] Закрыть публичный Swagger `/docs` на production.
- [x] Отключить cleartext HTTP в Android release, оставить только HTTPS.
- [x] Исправить deploy-процесс на VPS: перейти на `npm ci`, убрать грязный `package-lock.json`.
- [ ] Запускать backend не от `root`, а от отдельного пользователя `stomvp`.
- [ ] Настроить off-server backup: база и MinIO должны копироваться не только на тот же VPS.

## Следующий этап

- [ ] Усилить загрузку фото: проверка реального типа файла, лимит размеров, сжатие, удаление EXIF.
- [ ] Сократить срок JWT и подготовить refresh-token схему.
- [ ] Проверить App Store privacy: указать реальные собираемые данные.
- [ ] Удалить/почистить старые Android package на устройствах, чтобы не было двух MasterTop.
- [ ] Закрыть или ограничить healthcheck, чтобы не светить статус Redis/Postgres/S3 всем.

## Планово

- [ ] Обновить уязвимые зависимости: отдельно `multer`, потом Nest, потом Expo.
- [ ] Добавить нормальный CI: install, build API/admin/shared, e2e backend.
- [ ] Добавить мониторинг: Sentry alerts, uptime check, disk/RAM alerts.
- [ ] Сделать полноценную landing/support страницу на `nedvigagregat.uz`, а не редирект на админку.
- [ ] Подготовить production privacy/support/account deletion страницы под App Store и Google Play.
