'use client';
import { useState } from 'react';
import type { Product } from '@/types/store';
import { useCartStore } from '@/store/cart';
import ProductPhoto from '../ProductPhoto/ProductPhoto';
import css from './ProductCard.module.css';
import FavoriteButton from './FavoriteButton';
import ProductBadges from '../ProductBadges/ProductBadges';
import PackagingOptions from './PackagingOptions';
import {availableVariants, withPackaging} from './productPackaging';
const money = (value: number) =>
  new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(
    value
  );
export const canAddProduct = (p: Product) =>
  p.isPublished === true &&
  Number.isFinite(p.price) &&
  p.price > 0 &&
  (p.stock === undefined || p.stock > 0);
export function ProductPrice({ product: p }: { product: Product }) {
  return (
    <span className={css.price}>
      {p.oldPrice != null && p.oldPrice > p.price && (
        <del>{money(p.oldPrice)}</del>
      )}
      {p.price > 0 ? money(p.price) : 'Ціна уточнюється'}
    </span>
  );
}
export function CartButton({
  product,
  busy,
  added,
  onAdd,
}: {
  product: Product;
  busy: boolean;
  added: boolean;
  onAdd: () => void;
}) {
  const syncing = useCartStore(state => state.syncing);
  const label =
    product.isPublished !== true
      ? 'Ще не опубліковано'
      : product.price <= 0
        ? 'Ціна уточнюється'
        : product.stock === 0
          ? 'Немає в наявності'
          : added
            ? 'Додано ✓'
            : 'До кошика';
  return (
    <button
      type="button"
      className={css.cart}
      disabled={busy || syncing || !canAddProduct(product)}
      aria-label={
        canAddProduct(product) ? `Додати ${product.title} до кошика` : label
      }
      onClick={onAdd}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path d="M3 3h2l3 12h11l2-8H6" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
      {syncing ? 'Завантаження…' : label}
    </button>
  );
}
export default function ProductCard({
  product: p,
  busy,
  added,
  onAdd,
  onOpen,
}: {
  product: Product;
  busy: boolean;
  added: boolean;
  onAdd: (sourceProductId?: string) => void;
  onOpen: () => void;
}) {
  const [sourceId, setSourceId] = useState('');
  const variants = availableVariants(p);
  const variant = variants.find(option => option.sourceProductId === sourceId)
    ?? variants.find(option => option.price > 0 && option.stock > 0)
    ?? variants[0];
  const shown = withPackaging(p, variant);
  return (
    <li
      className={css.card}
      onClick={event => {
        if (!(event.target as HTMLElement).closest('button,a,input,select,label,[role="group"]'))
          onOpen();
      }}
    >
      <button
        type="button"
        className={css.photoButton}
        onClick={onOpen}
        aria-label={`Переглянути ${p.title}`}
      >
        <ProductPhoto
          className={css.photo}
          image={p.image}
          images={p.images}
          alt={p.title}
        />
        <ProductBadges badges={p.badges} limit={3}/>
      </button>
      <div className={css.meta}>
        <p className={css.brand}>
          {[p.brand, p.category].filter(Boolean).join(' · ')}
        </p>
        <FavoriteButton productId={p.id} title={p.title} />
      </div>
      {p.isPublished !== true && <span className={css.badge}>Чернетка</span>}
      <h3>
        <button type="button" className={css.title} onClick={onOpen}>
          {p.title}
        </button>
      </h3>
      <p className={css.description}>{p.description}</p>
      <div className={css.bottom}>
        <PackagingOptions
          variants={variants}
          selected={variant}
          onSelect={option => setSourceId(option.sourceProductId)}
        />
        <ProductPrice product={shown} />
        <CartButton
          product={p.variants?.length && !variant ? {...shown, stock: 0} : shown}
          busy={busy}
          added={added}
          onAdd={() => onAdd(variant?.sourceProductId)}
        />
      </div>
    </li>
  );
}
