'use client';
import HeroCarousel from '@/components/HeroCarousel/HeroCarousel';
import MediaPreview from '@/components/MediaPreview/MediaPreview';
import MediaCredit from '@/components/MediaCredit/MediaCredit';
import ProductResults from '@/components/ProductResults/ProductResults';
import ProductCard, {
  canAddProduct,
} from '@/components/ProductCard/ProductCard';
import {availableVariants, withPackaging} from '@/components/ProductCard/productPackaging';
import ProductModal from '@/components/ProductModal/ProductModal';
import Link from 'next/link';
import { PRODUCT_LINES, type ProductLine } from '@/constants/productLines';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCatalog, fetchProduct } from '@/services/storeApi';
import { useCart } from '@/hooks/useCart';
import css from './Storefront.module.css';
const cx = (value: string) =>
  value
    .split(' ')
    .map(key => css[key] || key)
    .join(' ');
function UsefulPagination({
  page,
  pageCount,
  label,
  onChange,
}: {
  page: number;
  pageCount: number;
  label: string;
  onChange: (page: number) => void;
}) {
  if (pageCount < 2) return null;
  return (
    <nav className={cx('useful-pagination')} aria-label={label}>
      <button
        type="button"
        className={cx('useful-page-button')}
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >
        ← Назад
      </button>
      <span aria-live="polite">
        Сторінка {page + 1} із {pageCount}
      </span>
      <button
        type="button"
        className={cx('useful-page-button')}
        disabled={page + 1 === pageCount}
        onClick={() => onChange(page + 1)}
      >
        Далі →
      </button>
    </nav>
  );
}
import type { Product } from '@/types/store';
export default function App() {
  const {
    data: catalog,
    error,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ['catalog', 'public'],
    queryFn: fetchCatalog,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const [category, setCategory] = useState('all');
  const [brand, setBrand] = useState('all');
  const [line, setLine] = useState<ProductLine>('women');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const {data:fullProduct,isPending:productLoading,error:productError}=useQuery({
    queryKey:['catalog','product',selectedProduct?.id],
    queryFn:()=>fetchProduct(selectedProduct!.id),
    enabled:Boolean(selectedProduct),
    staleTime:60*1000,
    retry:1,
  });
  const [lastAdded, setLastAdded] = useState('');
  const [cartNotice, setCartNotice] = useState('');
  const [usefulColumns, setUsefulColumns] = useState(3);
  const [usefulPage, setUsefulPage] = useState(0);
  const { items, addToCart, openCart } = useCart();
  const products = catalog?.products ?? [];
  const aboutParagraphs=(catalog?.info.description||'').split(/\n\s*\n/).map(paragraph=>paragraph.trim()).filter(Boolean);
  const aboutSections=aboutParagraphs.slice(1,aboutParagraphs.length>3?-1:undefined);
  const aboutTagline=aboutParagraphs.length>3?aboutParagraphs.at(-1):null;
  useEffect(() => {
    const updateColumns = () =>
      setUsefulColumns(
        window.innerWidth >= 1200 ? 3 : window.innerWidth >= 768 ? 2 : 1
      );
    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);
  useEffect(() => {
    setUsefulPage(0);
  }, [usefulColumns]);
  const usefulPageSize = usefulColumns * 2;
  const usefulItems = [
    ...(catalog?.media ?? []).map(item => ({ type: 'media' as const, item })),
    ...(catalog?.blog ?? []).map(item => ({ type: 'article' as const, item })),
  ];
  const usefulPageCount = Math.ceil(usefulItems.length / usefulPageSize);
  const currentUsefulPage = Math.min(
    usefulPage,
    Math.max(0, usefulPageCount - 1)
  );
  const visibleUsefulItems = usefulItems.slice(
    currentUsefulPage * usefulPageSize,
    (currentUsefulPage + 1) * usefulPageSize
  );

  const lineProducts = products.filter(p => (p.audience || 'women') === line);
  const visible = lineProducts.filter(
    p =>
      (category === 'all' || (p.groups || [p.category]).includes(category)) &&
      (brand === 'all' || p.brand === brand) &&
      `${p.title} ${p.sku} ${p.brand || ''} ${(p.groups || [p.category]).join(' ')}`
        .toLocaleLowerCase('uk')
        .includes(search.toLocaleLowerCase('uk'))
  );
  function addProduct(product: Product, sourceProductId?: string) {
    const variants = availableVariants(product);
    const variant = sourceProductId ? variants.find(v => v.sourceProductId === sourceProductId) : variants[0];
    if (product.variants?.length && !variant) return;
    const chosen = withPackaging(product, variant);
    const cartProductId=variant?.sourceProductId||product.id;
    if (busy || !canAddProduct(chosen)) return;
    const current = items.find(item => item.productId === cartProductId)?.qty || 0;
    if (current >= Math.min(99, chosen.stock ?? 99)) {
      setCartNotice(
        'У кошику вже максимальна доступна кількість цього товару.'
      );
      return;
    }
    addToCart(cartProductId);
    setLastAdded(product.id);
    setCartNotice(product.title + ' — додано до кошика.');
  }
  if (error)
    return (
      <main className={cx('container section')}>
        <h1>Магазин тимчасово недоступний</h1>
        <p role="alert">{error.message}</p>
        <button className={cx('btn')} onClick={() => void refetch()}>
          Спробувати ще раз
        </button>
      </main>
    );
  if (isPending || !catalog)
    return (
      <p className={cx('container section')} role="status">
        Завантаження магазину…
      </p>
    );
  return (
    <>
      <main>
        {cartNotice && (
          <div className={cx('cart-notice')} role="status" aria-live="polite">
            {cartNotice}{' '}
            <button type="button" className={cx('cart-notice-link')} onClick={openCart}>
              Переглянути кошик →
            </button>
          </div>
        )}
        {catalog.info.announcement && (
          <div className={cx('announcement')}>{catalog.info.announcement}</div>
        )}
        <HeroCarousel banners={catalog.banners ?? []} />
        <section className={cx('section')} id="catalog">
          <div className={cx('container')}>
            <h2 className={cx('section__title')}>Каталог</h2>
            <div
              className={cx('product-lines')}
              role="group"
              aria-label="Лінійка товарів"
            >
              {PRODUCT_LINES.map(item => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={line === item.id}
                  onClick={() => {
                    setLine(item.id);
                    setCategory('all');
                    setBrand('all');
                    setSearch('');
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className={cx('catalog-filters')}>
              <label className={cx('search-label')}>
                Пошук
                <input
                  type="search"
                  placeholder="Назва або артикул"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </label>
              <label>
                Бренд
                <select value={brand} onChange={e => setBrand(e.target.value)}>
                  <option value="all">Усі бренди</option>
                  {[
                    ...new Set(
                      lineProducts
                        .map(p => p.brand)
                        .filter((b): b is string => Boolean(b))
                    ),
                  ]
                    .sort((a, b) => a.localeCompare(b, 'uk'))
                    .map(b => (
                      <option value={b} key={b}>
                        {b}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Категорія товарів
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="all">Усі категорії</option>
                  {[
                    ...new Set(
                      [
                        ...(catalog.categories || []).map(c => c.name),
                        ...lineProducts.flatMap(p => p.groups || [p.category]),
                      ].filter(Boolean)
                    ),
                  ]
                    .sort((a, b) => a.localeCompare(b, 'uk'))
                    .map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className={cx('btn btn--ghost')}
                onClick={() => {
                  setBrand('all');
                  setCategory('all');
                  setSearch('');
                  setLine('women');
                }}
              >
                Скинути
              </button>
            </div>
            <p className={cx('catalog-count')} role="status">
              Знайдено товарів: {visible.length}
            </p>
            <ProductResults
              key={JSON.stringify([line, brand, category, search])}
              products={visible}
              renderItem={p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  busy={busy}
                  added={lastAdded === p.id}
                  onAdd={sourceProductId => sourceProductId ? addProduct(p,sourceProductId) : setSelectedProduct(p)}
                  onOpen={() => setSelectedProduct(p)}
                />
              )}
            />
            {!visible.length && (
              <p role="status">
                {!products.length
                  ? 'Каталог наповнюється. Товари з’являться після публікації.'
                  : 'Товарів за цим запитом немає.'}
              </p>
            )}
          </div>
        </section>
        <section className={cx('section section--alt')} id="media">
          <div className={cx('container')}>
            <h2 className={cx('section__title')}>Наш журнал про корисне</h2>
            <p>
              Відео, фото та поради з догляду за волоссям.
            </p>
            <Link href="/blog">Увесь Журнал</Link>
            <ul className={cx('useful-grid')}>
              {visibleUsefulItems.map(entry =>
                entry.type === 'media' ? (
                  <li
                    key={`media-${entry.item.id}`}
                    className={cx('media-card')}
                  >
                    <h3>{entry.item.title}</h3>
                    <MediaPreview
                      item={entry.item}
                      className={cx('media-frame')}
                    />
                    {entry.item.source?.provider !== 'Instagram' && <MediaCredit
                      item={entry.item}
                      className={cx('media-credit')}
                    />}
                  </li>
                ) : (
                  <li
                    className={cx('blog-card')}
                    key={`article-${entry.item.id}`}
                  >
                    <p className={cx('blog-card__date')}>{entry.item.date}</p>
                    <h3 className={cx('blog-card__title')}>
                      {entry.item.slug ? (
                        <Link href={'/blog/' + entry.item.slug}>
                          {entry.item.title}
                        </Link>
                      ) : (
                        entry.item.title
                      )}
                    </h3>
                    <p>{entry.item.excerpt}</p>
                  </li>
                )
              )}
            </ul>
            <UsefulPagination
              page={currentUsefulPage}
              pageCount={usefulPageCount}
              label="Сторінки розділу Корисне"
              onChange={setUsefulPage}
            />
          </div>
        </section>
        <section className={cx('section section--alt')} id="about">
          <div className={cx('container about__layout')}>
            <div>
              <p className={cx('about__eyebrow')}>Про магазин</p>
              <h2 className={cx('section__title')}>{catalog.info.heading}</h2>
              {aboutParagraphs[0]&&<p className={cx('about__lead')}>{aboutParagraphs[0]}</p>}
            </div>
            {aboutSections.length>0&&<div className={cx('about__sections')}>
              {aboutSections.map((paragraph,index)=><div key={index}>
                {index<2&&<h3>{index===0?'Наша місія':'Наші цілі'}</h3>}
                <p>{paragraph}</p>
              </div>)}
            </div>}
            {aboutTagline&&<p className={cx('about__tagline')}>{aboutTagline}</p>}
          </div>
        </section>
      </main>
      {selectedProduct && productError && <p role="alert" className={cx('container')}>Не вдалося завантажити деталі товару. Спробуйте відкрити його повторно.</p>}
      {selectedProduct && (
        <ProductModal
          key={selectedProduct.id}
          product={fullProduct?.id===selectedProduct.id?fullProduct:selectedProduct}
          busy={busy || productLoading || Boolean(productError)}
          added={lastAdded === selectedProduct.id}
          onAdd={(sourceProductId) => addProduct(selectedProduct,sourceProductId)}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
