'use client';
import Link from 'next/link';
import ProductPhoto from '@/components/ProductPhoto/ProductPhoto';
import ReactPaginate from 'react-paginate';
import { useDesktop } from '@/hooks/useDesktop';
import paging from '@/components/ProductResults/ProductResults.module.css';
import { useState, type FormEvent } from 'react';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getCategories,
  getBrands,
  getProduct,
  getProducts,
  saveProduct,
  deleteProduct,
  setProductPublication,
  uploadPhoto,
  type AdminProduct,
  type ProductPublicationStatus,
} from '@/services/catalogAdmin';
import css from '../Admin.module.css';
import EditPanel from '../EditPanel';
import VariantFields, {
  VariantExtraFields,
  variantForm,
} from './VariantFields';
import ProductBadgeEditor from './ProductBadgeEditor';
import type { ProductBadge } from '@/types/store';
import { PRODUCT_LINES, type ProductLine } from '@/constants/productLines';

import { createSlug } from '@/utils/createSlug';

const defaults = {
  categoryId: '',
  brandId: '',
  audience: '' as ProductLine | '',
  name: '',
  slug: '',
  description: '',
  variants: [variantForm('primary')],
  isActive: false,
  images: [] as string[],
  badges: [] as ProductBadge[],
  characteristics: [] as Array<{ name: string; value: string }>,
};

const managedCharacteristics = new Set([
  'brand', 'brandId', 'Бренд', 'Brand', 'group', 'Група', 'Лінійка', 'audience',
]);

function editableCharacteristics(product: AdminProduct) {
  return Object.entries(product.characteristics).filter(
    ([name, value]) =>
      typeof value === 'string' &&
      !name.startsWith('source') &&
      !managedCharacteristics.has(name)
  );
}

export default function Products() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<ProductPublicationStatus | ''>('');
  const { data: categories = [], error: categoryError } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: getCategories,
  });
  const { data: brands = [], error: brandError } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: getBrands,
  });
  const desktop = useDesktop();
  const filters = {
    q,
    category: category || undefined,
    brand: brand || undefined,
    status: status || undefined,
  };
  const paged = useQuery({
    queryKey: ['admin', 'products', page, filters],
    queryFn: () => getProducts({ page, ...filters }),
    enabled: desktop,
  });
  const more = useInfiniteQuery({
    queryKey: ['admin', 'products', 'more', filters],
    queryFn: ({ pageParam }) => getProducts({ page: pageParam, ...filters }),
    initialPageParam: 1,
    getNextPageParam: last =>
      last.page * last.limit < last.total ? last.page + 1 : undefined,
    enabled: !desktop,
  });
  const data = desktop
    ? paged.data
    : more.data
      ? {
          ...more.data.pages[0],
          items: more.data.pages.flatMap(part => part.items),
        }
      : undefined;
  const isPending = desktop ? paged.isPending : more.isPending;
  const error = desktop ? paged.error : more.error;
  const [form, setForm] = useState(defaults);
  const [id, setId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin', 'products'] }),
      client.invalidateQueries({ queryKey: ['admin', 'overview'] }),
      client.invalidateQueries({ queryKey: ['catalog'] }),
      client.invalidateQueries({ queryKey: ['favorites'] }),
      client.invalidateQueries({ queryKey: ['cart-products'] }),
    ]);
  }
  function edit(product: AdminProduct) {
    setMessage('');
    setSaveError('');
    setId(product.id);
    setForm({
      categoryId:
        product.categorySlug?.startsWith('import-') ||
        product.categorySlug?.startsWith('brand-')
          ? ''
          : product.categoryId,
      brandId:
        product.brandId ||
        brands.find(
          brand =>
            brand.name.toLocaleLowerCase('uk-UA') ===
            (product.brand || '').toLocaleLowerCase('uk-UA')
        )?.id ||
        '',
      name: product.name,
      audience: product.audience ?? '',
      slug: product.slug,
      description: product.description,
      variants: product.variants?.length
        ? [...product.variants]
            .sort(
              (a, b) =>
                Number(b.sourceProductId === product.id) -
                Number(a.sourceProductId === product.id)
            )
            .map(v =>
              variantForm(v.id, {
                ...v,
                isActive:
                  v.isActive ||
                  (!product.isActive &&
                    !product.variants?.some(row => row.isActive) &&
                    (v.volume !== null || v.sourceProductId === product.id)),
              })
            )
        : [
            {
              ...variantForm('primary'),
              price: String(product.price),
              oldPrice: product.oldPrice?.toString() ?? '',
              stock: String(product.stock),
              sku: product.sku,
            },
          ],
      isActive: product.isActive,
      images: product.images,
      characteristics: editableCharacteristics(product).map(([name, value]) => ({ name, value })),
      badges: product.badges || [],
    });
    setMessage('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    setSaveError('');
    try {
      const rows = form.characteristics.filter(
        row => row.name.trim() || row.value.trim()
      );
      if (rows.some(row => !row.name.trim() || !row.value.trim()))
        throw Error('Заповніть назву та значення кожної характеристики.');
      if (new Set(rows.map(row => row.name.trim())).size !== rows.length)
        throw Error('Назви характеристик не повинні повторюватися.');
      if (rows.some(({ name }) => managedCharacteristics.has(name.trim()) || name.trim().startsWith('source')))
        throw Error('Оберіть іншу назву характеристики. Бренд, група й лінійка заповнюються окремо.');
      const characteristics = Object.fromEntries(
        rows.map(row => [row.name.trim(), row.value.trim()])
      );
      const { characteristics: ignored, ...input } = form;
      const variants = form.variants.map((row, index) => ({
        id: row.id,
        volume: row.volume === '' ? null : Number(row.volume),
        unit: row.unit || null,
        price: Number(row.price),
        oldPrice: row.oldPrice === '' ? null : Number(row.oldPrice),
        stock: Number(row.stock),
        sku:
          row.id || (id && index === 0)
            ? row.sku.trim()
            : row.sku.trim() || `OMEE-${crypto.randomUUID()}`,
        isActive: row.isActive,
      }));
      const { price, oldPrice, stock, sku } = variants[0];
      await saveProduct(
        {
          ...input,
          audience: form.audience || undefined,
          slug: id ? form.slug : createSlug(form.name, 'tovar', 160),
          variants,
          price,
          oldPrice,
          stock,
          sku,
          images: form.images.map(url => url.trim()).filter(Boolean),
          characteristics,
        },
        id
      );
      if (id) {
        try {
          const saved = await getProduct(id);
          const entries = editableCharacteristics(saved);
          if (
            saved.name !== form.name.trim() ||
            entries.length !== rows.length ||
            entries.some(([name, value]) => characteristics[name] !== value)
          ) {
            setSaveError('Повторне читання з бази показало іншу назву або характеристики. Введені дані залишилися у формі.');
          } else {
            edit(saved);
            setMessage('Зміни збережено. Дані товару оновлено з бази.');
          }
        } catch {
          setSaveError('Зміни збережено. Не вдалося повторно завантажити товар для перевірки.');
        }
        await refresh();
        return;
      }
      await refresh();
      setForm(defaults);
      setMessage('Товар збережено як чернетку. Для публікації відкрийте редагування товару й натисніть «Опублікувати на сайті».');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Не вдалося зберегти товар.');
    } finally {
      setBusy(false);
    }
  }
  function stepBackIfLast(productId: string) {
    if (
      desktop &&
      page > 1 &&
      data?.items.length === 1 &&
      data.items[0].id === productId
    ) {
      setPage(page - 1);
    }
  }

  async function remove() {
    if (
      busy ||
      !id ||
      !window.confirm(
        'Видалити товар «' +
          form.name +
          '» з бази даних назавжди? Відновити його через адмінпанель буде неможливо.'
      )
    )
      return;
    setBusy(true);
    setMessage('');
    try {
      await deleteProduct(id);
      setId(undefined);
      setForm(defaults);
      stepBackIfLast(id);
      await refresh();
      setMessage('Товар видалено з бази даних.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Не вдалося видалити товар.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function togglePublication() {
    if (busy || !id) return;
    const isActive = !form.isActive;
    setBusy(true);
    setMessage('');
    try {
      await setProductPublication(id, isActive);
      setForm(current => ({ ...current, isActive }));
      if (status) stepBackIfLast(id);
      await refresh();
      setMessage(
        isActive ? 'Товар опубліковано.' : 'Товар знято з публікації.'
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Не вдалося змінити публікацію.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function photo(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error('Максимальний розмір фото — 5 МБ.');
      const url = await uploadPhoto(file);
      setForm(current => ({
        ...current,
        images: [...current.images.filter(Boolean), url],
      }));
      setMessage('Фото завантажено. Збережіть товар.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Помилка фото.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {message && !id && (
        <p role="status" className={css.status}>
          {message}
        </p>
      )}
      {(error || categoryError || brandError) && (
        <p className={css.error} role="alert">
          {(error || categoryError || brandError)?.message}
        </p>
      )}
      <div className={css.grid}>
        <section className={css.panel}>
          <h2>Товари ({data?.total || 0})</h2>
          <form
            className={`${css.toolbar} ${css.productFilters}`}
            onSubmit={e => {
              e.preventDefault();
              setPage(1);
              setQ(search);
            }}
          >
            <input
              type="search"
              aria-label="Пошук товарів"
              placeholder="Назва або артикул"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              aria-label="Фільтр категорії"
              value={category}
              onChange={e => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Усі категорії</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Фільтр бренду"
              value={brand}
              onChange={e => {
                setBrand(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Усі бренди</option>
              {brands.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Фільтр статусу публікації"
              value={status}
              onChange={e => {
                setStatus(e.target.value as ProductPublicationStatus | '');
                setPage(1);
              }}
            >
              <option value="">Усі статуси</option>
              <option value="published">Опубліковано</option>
              <option value="unpublished">Не опубліковано</option>
            </select>
            <button className={css.button}>Знайти</button>
          </form>
          {isPending && <p>Завантаження…</p>}
          {data && !data.items.length && (
            <p>
              {q || category || brand || status
                ? 'За вибраними фільтрами товарів немає.'
                : 'Товарів немає. Створіть перший товар у формі.'}
            </p>
          )}
          <ul className={css.list}>
            {data?.items.map(product => (
              <li className={css.row} key={product.id}>
                <ProductPhoto
                  className={css.productThumb}
                  image={product.images[0] || ''}
                  images={product.images}
                  alt={product.name}
                />
                <strong>{product.name}</strong>
                <p>
                  Лінійка:{' '}
                  {PRODUCT_LINES.find(item => item.id === product.audience)
                    ?.label ?? '—'}
                </p>
                <p>
                  {product.sku} · {product.categoryName}
                  {product.brand && <> · {product.brand}</>}
                </p>
                <p>
                  {product.variants && product.variants.length > 1
                    ? `Фасувань: ${product.variants.length}`
                    : `${product.price.toFixed(2)} грн`}
                </p>
                <div className={css.actions}>
                  <button
                    className={css.button}
                    disabled={busy}
                    onClick={() => edit(product)}
                  >
                    Редагувати
                  </button>
                  <span
                    className={css.productPublicationStatus}
                    data-published={product.isActive}
                  >
                    {product.isActive ? '● Опубліковано' : '○ Не опубліковано'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <div className={paging.controls}>
            {desktop && data && data.total > 20 && (
              <nav aria-label="Сторінки товарів адмінпанелі">
                <ReactPaginate
                  pageCount={Math.ceil(data.total / 20)}
                  forcePage={Math.min(
                    page - 1,
                    Math.max(0, Math.ceil(data.total / 20) - 1)
                  )}
                  onPageChange={({ selected }: { selected: number }) =>
                    setPage(selected + 1)
                  }
                  disableInitialCallback
                  pageRangeDisplayed={3}
                  marginPagesDisplayed={1}
                  previousLabel="← Назад"
                  nextLabel="Далі →"
                  breakLabel="…"
                  ariaLabelBuilder={(number: number) => 'Сторінка ' + number}
                  containerClassName={paging.pages}
                  activeClassName={paging.active}
                  disabledClassName={paging.disabled}
                  renderOnZeroPageCount={null}
                />
              </nav>
            )}
            {!desktop && more.hasNextPage && (
              <button
                type="button"
                className={paging.more}
                disabled={busy || more.isFetchingNextPage}
                onClick={() => void more.fetchNextPage()}
              >
                {more.isFetchingNextPage
                  ? 'Завантаження…'
                  : 'Показати ще ' +
                    Math.min(
                      20,
                      (data?.total || 0) - (data?.items.length || 0)
                    )}
              </button>
            )}
            {data && (
              <p className={paging.count}>
                Показано {data.items.length} із {data.total}
              </p>
            )}
          </div>
        </section>
        <EditPanel
          title={id ? 'Редагування товару' : 'Новий товар'}
          editing={Boolean(id)}
          busy={busy}
          onDismiss={() => {
            setId(undefined);
            setForm(defaults);
            setMessage('');
            setSaveError('');
          }}
        >
          {!categories.length && (
            <p>
              Спочатку <Link href="/admin/categories">створіть категорію</Link>.
            </p>
          )}
          <form
            className={css.form}
            onSubmit={submit}
            onInvalidCapture={event => {
              const control = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
                'input:invalid, select:invalid, textarea:invalid'
              );
              const label = control?.labels?.[0]?.firstChild?.textContent?.trim();
              setMessage('');
              setSaveError(label ? `Перевірте поле «${label}».` : 'Перевірте поле, яке виділив браузер.');
            }}
          >
            <fieldset disabled={busy || !categories.length}>
              <label>
                Категорія
                <select
                  required
                  value={form.categoryId}
                  onChange={e =>
                    setForm({ ...form, categoryId: e.target.value })
                  }
                >
                  <option value="">Оберіть категорію</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isActive ? '' : ' (прихована)'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Бренд
                <select
                  required
                  value={form.brandId}
                  onChange={e => setForm({ ...form, brandId: e.target.value })}
                >
                  <option value="">Оберіть бренд</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                      {brand.isActive ? '' : ' (прихований)'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Лінійка
                <select
                  value={form.audience}
                  onChange={e =>
                    setForm({
                      ...form,
                      audience: e.target.value as ProductLine | '',
                    })
                  }
                >
                  <option value="" disabled={Boolean(id)}>
                    Автоматично за категорією
                  </option>
                  {PRODUCT_LINES.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Назва
                <input
                  required
                  minLength={2}
                  maxLength={240}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <VariantFields
                variants={form.variants}
                editing={Boolean(id)}
                onChange={variants => setForm({ ...form, variants })}
              />
              <label>
                Опис
                <textarea
                  maxLength={12000}
                  value={form.description}
                  onChange={e =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <label>
                Завантажити фото (до 5 МБ)
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={form.images.length >= 8}
                  onChange={e => {
                    void photo(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <div className={css.photos}>
                {form.images.map(
                  (url, index) =>
                    url && (
                      <div className={css.photo} key={index}>
                        <img src={url} alt={'Фото ' + (index + 1)} />
                        <button
                          className={css.button}
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              images: form.images.filter((_, i) => i !== index),
                            })
                          }
                        >
                          Прибрати
                        </button>
                      </div>
                    )
                )}
              </div>
              <details
                key={id ?? 'new-product'}
                className={css.productExtras}
                onInvalidCapture={e => {
                  e.currentTarget.open = true;
                }}
              >
                <summary>Додатково</summary>
                <div className={css.productExtraFields}>
                  <VariantExtraFields
                    variants={form.variants}
                    editing={Boolean(id)}
                    onChange={variants => setForm({ ...form, variants })}
                  />
                  <ProductBadgeEditor
                    value={form.badges}
                    onChange={badges => setForm({ ...form, badges })}
                  />
                  <div>
                    <p>Характеристики</p>
                    {form.characteristics.map((row, index) => (
                      <div className={css.toolbar} key={index}>
                        <input
                          aria-label={'Назва характеристики ' + (index + 1)}
                          placeholder="Наприклад, тип волосся"
                          maxLength={80}
                          value={row.name}
                          onChange={e =>
                            setForm({
                              ...form,
                              characteristics: form.characteristics.map(
                                (item, i) =>
                                  i === index
                                    ? { ...item, name: e.target.value }
                                    : item
                              ),
                            })
                          }
                        />
                        <input
                          aria-label={'Значення характеристики ' + (index + 1)}
                          placeholder="Наприклад, сухе"
                          maxLength={500}
                          value={row.value}
                          onChange={e =>
                            setForm({
                              ...form,
                              characteristics: form.characteristics.map(
                                (item, i) =>
                                  i === index
                                    ? { ...item, value: e.target.value }
                                    : item
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          className={css.button}
                          onClick={() =>
                            setForm({
                              ...form,
                              characteristics: form.characteristics.filter(
                                (_, i) => i !== index
                              ),
                            })
                          }
                        >
                          Прибрати
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className={css.button}
                      disabled={form.characteristics.length >= 30}
                      onClick={() =>
                        setForm({
                          ...form,
                          characteristics: [
                            ...form.characteristics,
                            { name: '', value: '' },
                          ],
                        })
                      }
                    >
                      Додати характеристику
                    </button>
                  </div>
                  <label>
                    Фото — до 8 HTTPS-посилань, кожне з нового рядка
                    <textarea
                      value={form.images.join('\n')}
                      onChange={e =>
                        setForm({ ...form, images: e.target.value.split('\n') })
                      }
                    />
                  </label>
                </div>
              </details>
              <div className={css.actions}>
                <button className={css.button + ' ' + css.primary}>
                  {busy ? 'Збереження…' : 'Зберегти'}
                </button>
                {id && (
                  <button
                    className={css.button}
                    type="button"
                    onClick={() => {
                      setId(undefined);
                      setForm(defaults);
                      setMessage('');
                      setSaveError('');
                    }}
                  >
                    Скасувати
                  </button>
                )}
              </div>
            </fieldset>
            {saveError && <p className={css.error} role="alert">{saveError}</p>}
            {message && id && <p className={css.status} role="status">{message}</p>}
          </form>
          {id && (
            <div
              className={css.publishBox + ' ' + css.productPublicationActions}
            >
              <p>{form.isActive ? 'Опубліковано' : 'Не опубліковано'}</p>
              <div className={css.actions}>
                <button
                  type="button"
                  className={
                    form.isActive ? css.button : css.button + ' ' + css.primary
                  }
                  disabled={busy}
                  onClick={() => void togglePublication()}
                >
                  {form.isActive ? 'Зняти з сайту' : 'Опублікувати на сайті'}
                </button>
                <button
                  type="button"
                  className={css.button + ' ' + css.danger}
                  disabled={busy}
                  onClick={() => void remove()}
                >
                  Видалити з Бази Даних
                </button>
              </div>
            </div>
          )}
        </EditPanel>
      </div>
    </>
  );
}
