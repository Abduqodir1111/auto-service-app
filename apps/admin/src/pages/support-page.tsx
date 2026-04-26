import { AppLogo } from '../components/app-logo';

export function SupportPage() {
  return (
    <main className="public-page">
      <section className="public-card panel">
        <div className="public-card__hero">
          <AppLogo />
          <div>
            <p className="eyebrow">MasterTop</p>
            <h1>Поддержка пользователей</h1>
            <p className="muted">
              Страница поддержки для пользователей приложения MasterTop.
            </p>
          </div>
        </div>

        <div className="public-copy">
          <p>
            Если у вас возникли сложности со входом, публикацией объявления, картой,
            избранным, заявками или отзывами, используйте официальный сайт проекта и
            актуальные контактные данные владельца приложения.
          </p>

          <section className="public-section">
            <h2>По каким вопросам можно обратиться</h2>
            <ul>
              <li>проблемы со входом в аккаунт;</li>
              <li>ошибки при публикации объявления или загрузке фотографий;</li>
              <li>вопросы по модерации карточек, отзывов и изображений;</li>
              <li>вопросы по удалению данных и работе приложения.</li>
            </ul>
          </section>

          <section className="public-section">
            <h2>Официальные ссылки</h2>
            <ul>
              <li>
                Сайт проекта: <a href="https://nedvigagregat.uz">nedvigagregat.uz</a>
              </li>
              <li>
                Политика конфиденциальности:{' '}
                <a href="https://admin.nedvigagregat.uz/privacy">
                  admin.nedvigagregat.uz/privacy
                </a>
              </li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
