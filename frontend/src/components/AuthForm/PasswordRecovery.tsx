'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { http } from '@/services/http';
import { useAuthStore } from '@/store/auth';
import css from './Auth.module.css';

export default function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (reset) {
      const value = window.location.hash.slice(1);
      if (value) {
        setToken(value);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [reset]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage('');
    if (reset && data.get('password') !== data.get('confirm')) { setMessage('Паролі не збігаються.'); return; }
    setBusy(true);
    try {
      const response = await http.post<{message:string}>(reset ? '/auth/reset-password' : '/auth/forgot-password', reset ? {token,password:data.get('password')} : {email:data.get('email')});
      if (reset) useAuthStore.getState().setSession(null);
      setMessage(response.data.message);
      setDone(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Спробуйте пізніше.');
    } finally { setBusy(false); }
  }
  return <main className={css.page}>
    <p className={css.brand}>omee store</p>
    <h1>{reset ? 'Новий пароль' : 'Відновлення пароля'}</h1>
    {!done && <form className={css.form} onSubmit={submit}>
      {reset ? <>
        <label>Новий пароль<input name="password" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/></label>
        <label>Повторіть пароль<input name="confirm" type="password" autoComplete="new-password" minLength={8} required disabled={busy}/></label>
        {!token && <p role="alert">Відкрийте посилання з листа або замовте нове.</p>}
      </> : <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={busy}/></label>}
      <button disabled={busy || (reset && !token)}>{busy ? 'Зачекайте…' : reset ? 'Змінити пароль' : 'Надіслати посилання'}</button>
    </form>}
    {message && <p role="status">{message}</p>}
    <Link className={css.link} href="/login">Повернутися до входу</Link>
    {reset && <p><Link className={css.link} href="/forgot-password">Замовити нове посилання</Link></p>}
  </main>;
}
