import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-provider';

const links = [
  ['/', 'Сводка'],
  ['/users', 'Пользователи'],
  ['/workshops', 'СТО'],
  ['/reviews', 'Отзывы'],
  ['/photos', 'Фото'],
  ['/reports', 'Жалобы'],
  ['/moderation-history', 'История'],
  ['/categories', 'Категории'],
  ['/applications', 'Заявки'],
];

export function AppShell() {
  const { auth, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar panel">
        <div>
          <p className="eyebrow">MasterTop Admin</p>
          <h1>Панель модерации</h1>
          <p className="muted">
            Управление мастерскими, отзывами, фото и клиентскими заявками.
          </p>
        </div>

        <nav className="sidebar__nav">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              className={({ isActive }) => `sidebar__link${isActive ? ' is-active' : ''}`}
              to={to}
              end={to === '/'}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="panel panel--soft">
            <p className="eyebrow">Сессия</p>
            <strong>{auth?.user.fullName}</strong>
            <span>{auth?.user.phone}</span>
          </div>
          <button className="button button--ghost" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
