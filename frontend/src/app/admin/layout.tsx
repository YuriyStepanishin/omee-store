'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import css from './Admin.module.css';
const sections = [
  ['/admin/hero', '01', 'Банери hero'],
  ['/admin/products', '02', 'Товари'],
  ['/admin/articles', '03', 'Журнал'],
  ['/admin/orders', '04', 'Замовлення'],
] as const;
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loaded, error } = useAuthStore();
  const pathname = usePathname();
  if (!loaded)
    return (
      <main className={css.page}>
        <p role="status">Перевіряємо доступ…</p>
      </main>
    );
  if (!user)
    return (
      <main className={css.page}>
        <h1 className={css.title}>Сторінка адміністратора</h1>
        <p>{error || 'Увійдіть до акаунта адміністратора.'}</p>
        <Link href="/login">Увійти</Link>
      </main>
    );
  if (user.role !== 'ADMIN')
    return (
      <main className={css.page}>
        <h1 className={css.title}>Потрібен доступ адміністратора</h1>
        <Link href="/profile">Повернутися в кабінет</Link>
      </main>
    );
  return (
    <main className={css.page}>
      <div className={css.adminHeader}>
        <div>
          <p className={css.eyebrow}>omee store · Керування</p>
          <h1 className={css.title}>Сторінка адміністратора</h1>
        </div>
        <div className={css.actions}>
          <Link href="/profile">Мій кабінет</Link>
          <Link className={css.button} href="/">
            Переглянути магазин ↗
          </Link>
        </div>
      </div>
      <nav className={css.sectionNav} aria-label="Розділи адміністратора">
        {sections.map(([href, n, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
          >
            <span>{n}</span>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
