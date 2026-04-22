import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminUser } from '../api/types';
import { http } from '../api/http';
import { StatusBadge } from '../components/status-badge';
import { formatDate } from '../lib/format';

export function UsersPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await http.get<AdminUser[]>('/admin/users');
      return response.data;
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async (payload: { id: string; isBlocked: boolean }) => {
      await http.patch(`/admin/users/${payload.id}/block`, {
        isBlocked: payload.isBlocked,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  return (
    <section className="page">
      <header className="page__header">
        <div>
          <p className="eyebrow">Пользователи</p>
          <h2>Управление аккаунтами</h2>
        </div>
      </header>

      <div className="panel table-panel">
        {isLoading || !data ? (
          <p>Загружаем список пользователей...</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Роль</th>
                <th>Дата</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <tr key={user.id}>
                  <td>{user.fullName}</td>
                  <td>{user.phone}</td>
                  <td>{user.role}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <StatusBadge tone={user.isBlocked ? 'danger' : 'success'}>
                      {user.isBlocked ? 'Заблокирован' : 'Активен'}
                    </StatusBadge>
                  </td>
                  <td>
                    <button
                      className="button button--ghost"
                      onClick={() =>
                        toggleBlock.mutate({
                          id: user.id,
                          isBlocked: !user.isBlocked,
                        })
                      }
                    >
                      {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
