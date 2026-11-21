'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { logout } from '@/services/auth';
import { waitForCartSave } from '@/services/cartSync';
import { useCartStore } from '@/store/cart';
import css from './Profile.module.css';
export default function Profile() {
  const { user, loaded, error, setSession } = useAuthStore();
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try {
      await waitForCartSave();
      if (useCartStore.getState().syncError)
        throw new Error(
          'Кошик ще не збережено. Повторіть збереження перед виходом.'
        );
      await logout();
      setSession(null);
      client.clear();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Не вдалося завершити сесію. Спробуйте ще раз.'
      );
    } finally {
      setBusy(false);
    }
  }
  if (!loaded)
    return (
      <main className={css.page}>
        <p role="status">Перевіряємо сесію…</p>
      </main>
    );
  if (!user)
    return (
      <main className={css.page}>
        <h1>Особистий кабінет</h1>
        {error && <p role="alert">{error}</p>}
        <Link className={css.link} href="/login">
          Увійти до акаунта
        </Link>
      </main>
    );
  return (
    <main className={css.page}>
      <Link className={css.close} href="/" aria-label="Закрити кабінет">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m6 6 12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </Link>
      <header className={css.heading}>
        <p className={css.eyebrow}>Особистий кабінет</p>
        <h1>Вітаємо, {user.name}</h1>
      </header>
      <div className={css.details} aria-label="Контактні дані">
        <p>{user.email}</p>
        {user.phone && <p>{user.phone}</p>}
      </div>
      <nav className={css.navigation} aria-label="Розділи кабінету">
        <Link href="/profile/orders">
          <strong>Мої замовлення</strong>
          <span>Історія, склад і статуси</span>
        </Link>
        <Link href="/profile/wishlist">
          <strong>Список бажань</strong>
          <span>Збережені товари</span>
        </Link>
      </nav>
      <div className={css.actions}>
        <Link className={css.link} href="/#catalog">
          Продовжити покупки
        </Link>
        <button
          className={css.signOut}
          type="button"
          disabled={busy}
          onClick={signOut}
        >
          {busy ? 'Вихід…' : 'Вийти з акаунта'}
        </button>
      </div>
      {message && (
        <p className={css.error} role="alert">
          {message}
        </p>
      )}
    </main>
  );
}
