import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { http } from '../api/http';
import { ServiceCategory } from '@stomvp/shared';

const schema = z.object({
  name: z.string().min(2, 'Введите название'),
  slug: z.string().min(2, 'Введите slug'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await http.get<ServiceCategory[]>('/categories');
      return response.data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const createCategory = useMutation({
    mutationFn: async (values: FormValues) => {
      await http.post('/categories', values);
    },
    onSuccess: async () => {
      reset();
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const removeCategory = useMutation({
    mutationFn: async (id: string) => {
      await http.delete(`/categories/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return (
    <section className="page page--two-columns">
      <div className="panel">
        <p className="eyebrow">Новая категория</p>
        <h2>Добавить услугу</h2>
        <form className="form" onSubmit={handleSubmit((values) => createCategory.mutate(values))}>
          <label className="field">
            <span>Название</span>
            <input {...register('name')} />
            {errors.name && <small>{errors.name.message}</small>}
          </label>
          <label className="field">
            <span>Slug</span>
            <input {...register('slug')} />
            {errors.slug && <small>{errors.slug.message}</small>}
          </label>
          <label className="field">
            <span>Описание</span>
            <textarea rows={4} {...register('description')} />
          </label>
          <button className="button" type="submit" disabled={isSubmitting}>
            Создать
          </button>
        </form>
      </div>

      <div className="panel table-panel">
        <p className="eyebrow">Категории</p>
        <h2>Текущий справочник</h2>
        {isLoading || !data ? (
          <p>Загружаем категории...</p>
        ) : (
          <div className="stack">
            {data.map((category) => (
              <div className="inline-card" key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  <p className="muted">{category.slug}</p>
                </div>
                <button
                  className="button button--ghost"
                  onClick={() => removeCategory.mutate(category.id)}
                >
                  Деактивировать
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
