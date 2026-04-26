# MasterTop iOS App Store Connect Checklist

## Текущее состояние проекта

- Приложение: `MasterTop`
- Workspace: `apps/mobile/ios/STOMVP.xcworkspace`
- Scheme: `MasterTop`
- Bundle Identifier: `com.abduqodir.stomvp`
- Version: `1.0.0`
- Build: `3`
- Production API: `https://api.nedvigagregat.uz/api`
- Admin panel: `https://admin.nedvigagregat.uz`
- Icon: `apps/mobile/assets/icon.png` (`1024x1024`)

## Что уже подготовлено

- Нативный iOS-проект создан и собирается через Xcode
- Включён production HTTPS API
- Privacy manifest присутствует: `apps/mobile/ios/STOMVP/PrivacyInfo.xcprivacy`
- Добавлены permission-тексты для:
  - фото
  - камеры
  - геолокации `When In Use`
- Убраны лишние iOS-разрешения для `Face ID` и `Always Location`
- Приложение готово к `Archive` через Xcode

## Что проверить в Xcode перед загрузкой

1. Открыть:

   `apps/mobile/ios/STOMVP.xcworkspace`

2. Выбрать target `MasterTop`

3. Вкладка `Signing & Capabilities`

   - `Automatically manage signing`: включено
   - `Team`: ваш Apple Developer Team
   - `Bundle Identifier`: `com.abduqodir.stomvp`

4. Вкладка `General`

   - `Display Name`: `MasterTop`
   - `Version`: `1.0.0`
   - `Build`: `3`

5. В списке устройств выбрать:

   `Any iOS Device (arm64)`

## Как собрать и отправить build

1. В Xcode:

   `Product` -> `Archive`

2. После успешной сборки откроется `Organizer`

3. Выбрать свежий архив `MasterTop`

4. Нажать:

   `Distribute App` -> `App Store Connect` -> `Upload`

5. Если Xcode покажет предупреждения про `dSYM` для Hermes, это не блокирует сам upload, если build загружается успешно

## Что нужно заполнить в App Store Connect

- App Name
- Subtitle
- Description
- Keywords
- Support URL
- Privacy Policy URL
- App Review Information
- Screenshots iPhone 6.9" / 6.5" или актуальные требуемые размеры

Готовые шаблоны лежат здесь:

- `apps/mobile/APP_STORE_CONNECT_METADATA_RU.md`
- `apps/mobile/APP_STORE_REVIEW_NOTES.md`

## До отправки на ревью

- Проверить логин клиента
- Проверить логин мастера
- Проверить каталог
- Проверить карту
- Проверить избранное
- Проверить создание объявления мастером
- Проверить загрузку фото
- Проверить открытие карточки мастерской

## Важно

- Если build `3` уже был загружен в App Store Connect, перед новой загрузкой увеличьте `Build` до `4`
- Для ревью Apple лучше дать отдельные тестовые аккаунты клиента и мастера
- `Privacy Policy URL` должен быть публичным и открываться без авторизации
