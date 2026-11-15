'use client';
import { useAuthStore } from '@/store/auth';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/hooks/useCart';
import CartIcon from '@/components/CartIcon/CartIcon';
import Container from '../Container/Container';
import BrandLogo from '../BrandLogo/BrandLogo';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import css from '../shared/Layout.module.css';
import {useFavorites} from '@/hooks/useFavorites';

export default function Header() {
  const user = useAuthStore(state => state.user);
  const [open, setOpen] = useState(false);
  const { itemsCount, openCart } = useCart();
  const {ids}=useFavorites();
  const accountLabel=user?(user.name.trim()||user.email):'Увійти';
  return (
    <header className={css.header}>
      <Container>
        <div className={css.inner}>
          <Link className={css.logo} href="/">
            <BrandLogo />
          </Link>
          <Link className={css.catalogButton} href="/#catalog" onClick={()=>setOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Каталог
          </Link>
          <nav
            id="navigation"
            className={open ? css.navOpen : css.nav}
            onClick={() => setOpen(false)}
          >
            <Link href="/#media">Журнал про корисне</Link>
            <Link href="/#about">Про магазин</Link>
          </nav>
          <div className={css.actions}>
            <button
              className={css.menu}
              aria-label="Меню"
              aria-controls="navigation"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
            >
              ☰
            </button>
            <Link className={css.profileLink} href={user ? (user.role === 'ADMIN' ? '/admin' : '/profile') : '/login'} title={user?`Профіль: ${accountLabel}`:'Увійти'} aria-label={user?`Профіль: ${accountLabel}`:'Увійти'}>
              {accountLabel}
            </Link>
            <Link className={css.accountShortcut} href="/profile/orders" aria-label="Мої замовлення" title="Мої замовлення"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></Link>
            <Link className={css.accountShortcut} href="/profile/wishlist" aria-label={`Список бажань${user?`: ${ids.length}`:''}`} title="Список бажань"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>{user&&ids.length>0&&<span className={css.shortcutCount}>{ids.length}</span>}</Link>
            <button type="button" className={`${css.accountShortcut} ${css.cartButton}`} onClick={openCart} aria-label={`Кошик: ${itemsCount}`} title="Кошик">
              <CartIcon className={css.cartIcon} />
              {itemsCount > 0 && <span className={css.shortcutCount}>{itemsCount}</span>}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </header>
  );
}
