# MasterTop Android Google Play Checklist

## Что уже подготовлено

- `targetSdkVersion` поднят до `35`
- release-сборка готова под `Android App Bundle (.aab)`
- добавлен шаблон release signing:
  - `apps/mobile/android/keystore.properties.example`
- убраны лишние permissions для Google Play:
  - `READ_EXTERNAL_STORAGE`
  - `WRITE_EXTERNAL_STORAGE`
  - `RECORD_AUDIO`
  - `SYSTEM_ALERT_WINDOW`

## Что сделать перед первой загрузкой в Play Console

1. Создать upload keystore:

   ```bash
   keytool -genkeypair -v \
     -storetype PKCS12 \
     -keystore release-key.jks \
     -alias upload \
     -keyalg RSA \
     -keysize 2048 \
     -validity 10000
   ```

2. Скопировать шаблон:

   `apps/mobile/android/keystore.properties.example` -> `apps/mobile/android/keystore.properties`

3. Заполнить:

   - `storeFile`
   - `storePassword`
   - `keyAlias`
   - `keyPassword`

4. Собрать `.aab`:

   ```bash
   npm run bundle:android -w @stomvp/mobile
   ```

5. Готовый файл будет лежать примерно здесь:

   `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`

## Что нужно заполнить в Google Play Console

- App name
- Short description
- Full description
- App icon
- Feature graphic
- Screenshots
- Privacy Policy URL
- Data safety form
- App access
- Content rating
- Contact details

## Важно

- Для первой публикации лучше перейти на production domain с `HTTPS`
- Текущий Android package name пока: `com.anonymous.stomvp`
- Перед реальным релизом лучше заменить его на более брендовый package id
