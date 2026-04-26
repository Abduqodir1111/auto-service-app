# MasterTop App Review Notes

## Review Notes Template

Use this text in App Store Connect -> `App Review Information` / `Notes`.

---

`MasterTop` is a marketplace for clients and auto service providers.

The app supports two main roles:

- client
- master / workshop owner

Please use the test accounts below for review.

### Client test account

- Phone: `TODO`
- Password: `TODO`

### Master test account

- Phone: `TODO`
- Password: `TODO`

### What can be tested

1. Sign in as client
2. Browse workshop catalog
3. Open workshop card
4. View workshop location on the map
5. Add workshop to favorites
6. Create a service request
7. Leave a review
8. Sign in as master
9. Create or edit a workshop listing
10. Upload workshop photos

### Account deletion flow

Account deletion is available directly in the app:

1. Sign in with a test account or create a new account
2. Open the `Профиль` tab
3. Scroll to the `Удаление аккаунта` section
4. Tap `Удалить аккаунт`
5. Confirm `Удалить аккаунт` in the native confirmation dialog
6. The app signs the user out and returns to the sign-in screen after the server deletes the account

This action permanently deletes the user profile and related server-side data, including listings,
listing photos, requests, reviews and favorites.

### Extra notes

- The app works with the production API: `https://api.nedvigagregat.uz/api`
- If location permission is requested, it is used to show nearby workshops on the map
- Camera and photo library permissions are used only for listing photo upload by workshop owners

---

## Before Submission

- Replace both `TODO` placeholders with real working test credentials
- Make sure both accounts are not blocked
- Make sure at least one approved workshop is visible in the catalog for App Review
