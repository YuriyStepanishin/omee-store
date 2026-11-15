'use client';
import Link from 'next/link';
import {useFavorites} from '@/hooks/useFavorites';
import css from './ProductCard.module.css';
export default function FavoriteButton({productId,title}:{productId:string;title:string}) {
  const {user,ids,query,mutation}=useFavorites();
  const saved=ids.includes(productId);
  const label=`${saved?'Видалити':'Додати'} ${title} ${saved?'зі списку':'до списку'} бажань`;
  return <div className={css.favoriteControl}>
    {user ? <button type="button" className={css.favorite} aria-label={label} aria-pressed={saved} disabled={mutation.isPending||query.isPending||query.isError} onClick={()=>mutation.mutate({productId,saved})}>
      <svg width="21" height="21" viewBox="0 0 24 24" fill={saved?'currentColor':'none'} stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0l-1 1-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>
    </button> : <Link href="/login" className={css.favorite} aria-label={`Увійти, щоб додати ${title} до списку бажань`}>♡</Link>}
    {(mutation.isError||query.isError)&&<span className={css.favoriteError} role="alert">Не вдалося оновити список бажань.</span>}
  </div>;
}
