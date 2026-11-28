'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle';
import AdminIcon, { type AdminIconName } from './AdminIcon';
import css from './Admin.module.css';

type Section = {
  href: string;
  icon: AdminIconName;
  label: string;
  paths?: readonly string[];
};
const editing: readonly Section[] = [
  { href: '/admin/hero', icon: 'hero', label: 'Банери' },
  {
    href: '/admin/products',
    icon: 'products',
    label: 'Товари та каталоги',
    paths: ['/admin/products', '/admin/categories', '/admin/brands'],
  },
  { href: '/admin/articles', icon: 'articles', label: 'Журнал сайту' },
];
const sales: readonly Section[] = [
  { href: '/admin/customers', icon: 'customers', label: 'Клієнти' },
  { href: '/admin/orders', icon: 'orders', label: 'Замовлення' },
  { href: '/admin', icon: 'overview', label: 'Sales-аналітика' },
];
const groups = [
  { label: 'Редагування', sections: editing },
  { label: 'Продажі', sections: sales },
] as const;
const matchesSection = (section: Section, pathname: string) =>
  (section.paths ?? [section.href]).some(path =>
    path === '/admin'
      ? pathname === path
      : pathname === path || pathname.startsWith(path + '/')
  );
const productTabs = [
  ['/admin/products', 'Товари'],
  ['/admin/categories', 'Категорії'],
  ['/admin/brands', 'Бренди'],
] as const;
const journalTabs = [
  ['/admin/articles', 'Статті'],
  ['/admin/articles/media', 'Фото та відео'],
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loaded, error } = useAuthStore();
  const pathname = usePathname() ?? '';
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
  const section = [...editing, ...sales].find(item =>
    matchesSection(item, pathname)
  );
  const tabs =
    section?.href === '/admin/products'
      ? productTabs
      : section?.href === '/admin/articles' ? journalTabs : null;
  return (
    <div className={css.adminShell}>
      <aside className={css.sidebar}>
        <Link href="/admin" className={css.adminBrand}>
          <AdminIcon name="store" />
          <span>
            <strong>omee store</strong>
            <small>Панель адміністратора</small>
          </span>
        </Link>
        <nav className={css.sideNav} aria-label="Розділи адміністратора">
          {groups.map(group => (
            <div className={css.navGroup} key={group.label}>
              <h2 className={css.navGroupLabel}>{group.label}</h2>
              <div className={css.navGroupItems}>
                {group.sections.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={
                      matchesSection(item, pathname) ? 'page' : undefined
                    }
                  >
                    <AdminIcon name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <Link href="/profile" className={css.adminAccount}>
          <span className={css.avatar}>
            {(user.name || user.email).slice(0, 1).toLocaleUpperCase('uk-UA')}
          </span>
          <span>
            <strong>{user.name || user.email}</strong>
            <small>Адміністратор</small>
          </span>
        </Link>
      </aside>
      <main className={css.adminMain}>
        <header className={css.workspaceHeader}>
          <div>
            <p className={css.eyebrow}>
              {section && editing.includes(section) ? 'Редагування' : 'Продажі'}
            </p>
            <h1 className={css.title}>
              {section?.label || 'Керування магазином'}
            </h1>
          </div>
          <div className={css.workspaceActions}>
            <ThemeToggle />
            <Link className={css.button} href="/">
              До магазину
            </Link>
          </div>
        </header>
        {tabs && (
          <nav className={css.subNav} aria-label={section?.label}>
            {tabs.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
        {children}
      </main>
    </div>
  );
}
