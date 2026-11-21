'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login, register as registerAccount } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import css from './Auth.module.css';
const schema = z.object({
  name: z.string().optional(),
  email: z.string().email('Вкажіть коректний email.'),
  password: z
    .string()
    .min(8, 'Щонайменше 8 символів.')
    .refine(
      value => new TextEncoder().encode(value).length <= 72,
      'Пароль завеликий (максимум 72 байти).'
    ),
  confirmPassword: z.string().optional(),
});
type Fields = z.infer<typeof schema>;
export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const setSession = useAuthStore(s => s.setSession);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === 'register';
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema) });
  async function submit({ confirmPassword, ...values }: Fields) {
    setMessage('');
    if (isRegister && (!values.name || values.name.trim().length < 2)) {
      setError('name', { message: 'Вкажіть ім’я (від 2 символів).' });
      return;
    }
    if (isRegister && confirmPassword !== values.password) {
      setError('confirmPassword', { message: 'Паролі не збігаються.' });
      return;
    }
    try {
      const user = await (isRegister ? registerAccount({...values,confirmPassword}) : login(values));
      setSession(user);
      router.replace('/profile');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не вдалося увійти.');
    }
  }
  return (
    <main className={css.page}>
      <p className={css.brand}>omee store</p>
      <h1>{isRegister ? 'Зареєструватися' : 'Вхід до облікового запису'}</h1>
      <p className={css.subtitle}>{isRegister ? 'Створіть обліковий запис' : 'Введіть дані для входу'}</p>
      <form className={css.form} onSubmit={handleSubmit(submit)} noValidate>
        {isRegister && (
          <label>
            Ім’я
            <input
              {...register('name')}
              autoComplete="name"
              maxLength={120}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.name)}
            />
            {errors.name && (
              <span className={css.error}>{errors.name.message}</span>
            )}
          </label>
        )}
        <label>
          Email
          <input
            {...register('email')}
            type="email"
            placeholder="example@gmail.com"
            autoComplete="email"
            maxLength={254}
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && (
            <span className={css.error}>{errors.email.message}</span>
          )}
        </label>
        <div className={css.passwordField}>
          <label htmlFor="auth-password">Пароль</label>
          <div className={css.passwordControl}>
            <input
              id="auth-password"
              placeholder="Введіть пароль"
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            <button
              className={css.passwordToggle}
              type="button"
              aria-controls="auth-password"
              aria-label={showPassword ? 'Приховати пароль' : 'Показати пароль'}
              aria-pressed={showPassword}
              disabled={isSubmitting}
              onClick={() => setShowPassword(value => !value)}
            >
              {showPassword ? 'Приховати' : 'Показати'}
            </button>
          </div>
          {errors.password && (
            <span id="password-error" className={css.error}>
              {errors.password.message}
            </span>
          )}
        </div>
        {isRegister && (
          <label>
            Повторіть пароль
            <input
              {...register('confirmPassword')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.confirmPassword)}
            />
            {errors.confirmPassword && (
              <span className={css.error}>{errors.confirmPassword.message}</span>
            )}
          </label>
        )}
        {!isRegister && <Link className={css.forgot} href="/forgot-password">Забули пароль?</Link>}
        <button disabled={isSubmitting}>
          {isSubmitting
            ? 'Зачекайте…'
            : isRegister
              ? 'Зареєструватися'
              : 'Увійти'}
        </button>
        {message && (
          <p role="alert" className={css.error}>
            {message}
          </p>
        )}
      </form>
      <Link className={css.link} href={isRegister ? '/login' : '/register'}>
        {isRegister
          ? 'Уже маєте акаунт? Увійти'
          : 'Якщо ще немаєте акаунта? Зареєструватися'}
      </Link>
    </main>
  );
}
