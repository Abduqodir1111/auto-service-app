import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import appIconUrl from '../assets/app-icon.png';
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
      await login(values.phone.trim(), values.password.trim());
      navigate('/');
    } catch (submissionError) {
      if (axios.isAxiosError(submissionError) && submissionError.response?.status === 401) {
        setError('Неверный телефон или пароль. Проверьте данные и попробуйте ещё раз.');
        return;
      }

      setError('Не удалось войти в админку. Попробуйте обновить страницу.');
    }
  });

  return (
    <div className="login-page">
      <section className="login-card login-card--modern" aria-label="Вход в админ-панель">
        <div className="login-card__brand">
          <img className="login-card__icon" src={appIconUrl} alt="MasterTop" />
        </div>

        <form className="form" autoComplete="off" onSubmit={onSubmit}>
          <label className="field">
            <span>Логин</span>
            <input
              type="tel"
              inputMode="tel"
              placeholder="Логин"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              {...register('phone')}
            />
            {errors.phone && <small>{errors.phone.message}</small>}
          </label>

          <label className="field">
            <span>Пароль</span>
            <input
              type="password"
              placeholder="Пароль"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              {...register('password')}
            />
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
