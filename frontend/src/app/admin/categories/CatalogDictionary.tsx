'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCategories,
  getBrands, saveBrand, archiveBrand,
  saveCategory,
  archiveCategory,
  uploadPhoto,
  type Category,
} from '@/services/catalogAdmin';
import css from '../Admin.module.css';
const empty = { name: '', slug: '', image: '', isActive: true };
export default function CatalogDictionary({kind='categories'}:{kind?:'categories'|'brands'}) {
  const isBrand = kind === 'brands';
  const title = isBrand ? 'Бренди' : 'Категорії';
  const client = useQueryClient();
  const {
    data: categories = [],
    isPending,
    error,
  } = useQuery({ queryKey: ['admin', kind], queryFn: isBrand ? getBrands : getCategories });
  const [form, setForm] = useState(empty);
  const [id, setId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin', kind] }),
      client.invalidateQueries({ queryKey: ['admin', 'products'] }),
      client.invalidateQueries({ queryKey: ['admin', 'dashboard-catalog'] }),
      client.invalidateQueries({ queryKey: ['catalog'] }),
    ]);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await (isBrand ? saveBrand : saveCategory)(form, id);
      await refresh();
      setForm(empty);
      setId(undefined);
      setMessage(isBrand ? 'Бренд збережено.' : 'Категорію збережено.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Помилка збереження.'
      );
    } finally {
      setBusy(false);
    }
  }
  function edit(category: Category) {
    setId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      image: category.image || '',
      isActive: category.isActive,
    });
    setMessage('');
  }
  async function hide(category: Category) {
    setBusy(true);
    try {
      await (isBrand ? archiveBrand : archiveCategory)(category.id);
      await refresh();
      if (id === category.id) {
        setId(undefined);
        setForm(empty);
      }
      setMessage(
        isBrand ? 'Бренд приховано у довіднику. Збережені товари залишаються доступними для редагування.' : 'Категорію приховано разом із її товарами у вітрині. Відновити її можна через редагування.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Помилка.');
    } finally {
      setBusy(false);
    }
  }
  async function photo(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await uploadPhoto(file);
      setForm(current => ({ ...current, image }));
      setMessage('Фото завантажено. Збережіть категорію.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Не вдалося завантажити фото.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {message && (
        <p className={css.status} role="status">
          {message}
        </p>
      )}
      {error && (
        <p className={css.error} role="alert">
          {error.message}
        </p>
      )}
      <div className={css.grid}>
        <section className={css.panel}>
          <h2>{title} ({categories.length})</h2>
          {isPending && <p>Завантаження…</p>}
          {!isPending && !categories.length && (
            <p>{isBrand ? 'Додайте перший бренд у формі.' : 'Додайте категорію: наприклад, Шампуні або Маски для волосся.'}</p>
          )}
          <ul className={css.list}>
            {categories.map(category => (
              <li key={category.id} className={css.row}>
                <strong>{category.name}</strong>
                <p>
                  {category.slug} ·{' '}
                  {category.isActive ? 'Активна' : 'Прихована'}
                </p>
                <div className={css.actions}>
                  <button
                    className={css.button}
                    disabled={busy}
                    onClick={() => edit(category)}
                  >
                    Редагувати
                  </button>
                  {category.isActive && (
                    <button
                      className={css.button}
                      disabled={busy}
                      onClick={() => void hide(category)}
                    >
                      Приховати
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className={css.panel}>
          <h2>{isBrand ? (id ? 'Редагування бренду' : 'Новий бренд') : (id ? 'Редагування категорії' : 'Нова категорія')}</h2>
          <form className={css.form} onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Назва
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                {isBrand ? 'Slug (наприклад, davroe)' : 'Slug (наприклад, shampoos)'}
                <input
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  maxLength={160}
                  value={form.slug}
                  onChange={e => setForm({ ...form, slug: e.target.value })}
                />
              </label>
              <label>
                URL фото (HTTPS)
                <input
                  type="url"
                  value={form.image}
                  onChange={e => setForm({ ...form, image: e.target.value })}
                />
              </label>
              <label>
                Завантажити фото
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => {
                    void photo(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {form.image && (
                <div className={css.photos}>
                  <img src={form.image} alt="Фото категорії" />
                </div>
              )}
              <label className={css.check}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                {isBrand ? 'Активний у довіднику' : 'Активна у магазині'}
              </label>
              <div className={css.actions}>
                <button className={css.button + ' ' + css.primary}>
                  {busy ? 'Збереження…' : 'Зберегти'}
                </button>
                {id && (
                  <button
                    className={css.button}
                    type="button"
                    onClick={() => {
                      setForm(empty);
                      setId(undefined);
                    }}
                  >
                    Скасувати
                  </button>
                )}
              </div>
            </fieldset>
          </form>
        </section>
      </div>
    </>
  );
}
