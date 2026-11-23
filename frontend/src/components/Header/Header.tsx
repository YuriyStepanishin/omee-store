'use client';
import { useAuthStore } from '@/store/auth';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import CartIcon from '@/components/CartIcon/CartIcon';
import AdminIcon from '@/app/admin/AdminIcon';
import Container from '../Container/Container';
import BrandLogo from '../BrandLogo/BrandLogo';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import css from '../shared/Layout.module.css';
import {useFavorites} from '@/hooks/useFavorites';

export default function Header() {
  const user = useAuthStore(state => state.user);
  const pathname = usePathname();
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  const open = openForPath !== null && openForPath === pathname;
  const header = useRef<HTMLElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const { itemsCount, openCart } = useCart();
  const {ids}=useFavorites();
  const accountLabel = user ? user.name.trim() || user.email : 'Увійти';
  const accountHref = user ? '/profile' : '/login';
  const closeMenu = () => setOpenForPath(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        setOpenForPath(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenForPath(null);
        menu.current?.focus();
      }
    }
    const desktop = window.matchMedia('(min-width: 768px)');
    function onDesktop() {
      if (desktop.matches) setOpenForPath(null);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [open]);
  return (
    <header ref={header} className={css.header}>
      <Container>
        <div className={css.inner}>
          <Link className={css.logo} href="/" onClick={closeMenu}>
            <BrandLogo />
          </Link>
          <Link className={css.catalogButton} href="/#catalog" onClick={closeMenu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Каталог
          </Link>
          <button
            ref={menu}
            type="button"
            className={css.menu}
            aria-label={open ? 'Закрити меню' : 'Відкрити меню'}
            aria-controls="navigation"
            aria-expanded={open}
            onClick={() => setOpenForPath(open ? null : pathname)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d={open ? 'm6 6 12 12M18 6 6 18' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
          <nav
            id="navigation"
            aria-label="Головне меню"
            className={css.nav}
            data-open={open}
          >
            <Link className={css.mobileOnly} href="/#catalog" onClick={closeMenu}>Каталог</Link>
            <Link href="/#media" onClick={closeMenu}>Журнал про корисне</Link>
            <Link href="/#about" onClick={closeMenu}>Для покупців</Link>
            {user?.role === 'ADMIN' && (
              <Link
                className={css.adminLink}
                href="/admin"
                aria-label="Панель адміністратора"
                title="Панель адміністратора"
                onClick={closeMenu}
              >
                <AdminIcon name="settings" />
                <span>Панель адміністратора</span>
              </Link>
            )}
            <div className={css.mobileAccount}>
              <Link href={accountHref} onClick={closeMenu}>{user ? 'Профіль' : 'Увійти'}</Link>
              <Link href="/profile/orders" onClick={closeMenu}>Мої замовлення</Link>
              <Link href="/profile/wishlist" onClick={closeMenu}>Список бажань{user && ids.length > 0 ? ` (${ids.length})` : ''}</Link>
            </div>
          </nav>
          <div className={css.actions}>
            <Link className={css.profileLink} href={accountHref} title={user?`Профіль: ${accountLabel}`:'Увійти'} aria-label={user?`Профіль: ${accountLabel}`:'Увійти'}>
              {accountLabel}
            </Link>
            <Link className={css.accountShortcut} href="/profile/orders" aria-label="Мої замовлення" title="Мої замовлення"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></Link>
            <Link className={css.accountShortcut} href="/profile/wishlist" aria-label={`Список бажань${user?`: ${ids.length}`:''}`} title="Список бажань"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>{user&&ids.length>0&&<span className={css.shortcutCount}>{ids.length}</span>}</Link>
            <button type="button" className={`${css.accountShortcut} ${css.cartButton}`} onClick={() => { closeMenu(); openCart(); }} aria-label={`Кошик: ${itemsCount}`} title="Кошик">
              <CartIcon />
              {itemsCount > 0 && <span className={css.shortcutCount}>{itemsCount}</span>}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </header>
  );
}
