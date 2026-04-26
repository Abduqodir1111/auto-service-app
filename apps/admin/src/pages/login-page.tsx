import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { AppLogo } from '../components/app-logo';
import { useAuth } from '../features/auth/auth-provider';

const schema = z.object({
  phone: z.string().min(6, 'Введите телефон'),
  password: z.string().min(6, 'Минимум 6 символов'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: '',
      password: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      setError(null);
      await login(values.phone, values.password);
      navigate('/');
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'Не удалось войти в админку',
      );
    }
  });

  return (
    <div className="login-page">
      <section className="login-card panel">
        <div>
          <AppLogo />
          <p className="eyebrow">MasterTop</p>
          <h1>Админ-панель сервиса для СТО</h1>
          <p className="muted">
            Войдите с администраторскими данными из базы.
          </p>
        </div>

        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Телефон</span>
            <input placeholder="+998..." {...register('phone')} />
            {errors.phone && <small>{errors.phone.message}</small>}
          </label>

          <label className="field">
            <span>Пароль</span>
            <input type="password" {...register('password')} />
            {errors.password && <small>{errors.password.message}</small>}
          </label>

          {error ? <div className="alert">{error}</div> : null}

          <button className="button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </section>
    </div>
  );
}
