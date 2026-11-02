'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getContent, saveContent, type Banner } from '@/services/contentAdmin';
import { uploadPhoto } from '@/services/catalogAdmin';
import { http } from '@/services/http';
import css from '../Admin.module.css';
const empty: Banner = {
  title: '',
  imageUrl: '',
  link: '/#catalog',
  isActive: false,
};
export default function HeroAdmin() {
  const client = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['admin', 'content'],
    queryFn: getContent,
  });
  const [form, setForm] = useState<Banner>(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function perform(task: () => Promise<unknown>, done?: () => void) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await task();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'content'] }),
        client.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      done?.();
      setMessage('Зміни збережено.');
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : 'Не вдалося зберегти.');
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await perform(
      () => saveContent('banners', form),
      () => setForm(empty)
    );
  }
  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error('Максимальний розмір фото — 5 МБ.');
      const imageUrl = await uploadPhoto(file);
      setForm(v => ({ ...v, imageUrl }));
      setMessage('Фото завантажено. Збережіть банер.');
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : 'Помилка завантаження.');
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <p role="status">Завантаження банерів…</p>;
  if (error || !data)
    return (
      <div role="alert">
        <p>{error?.message || 'Немає даних.'}</p>
        <button className={css.button} onClick={() => void refetch()}>
          Спробувати ще
        </button>
      </div>
    );
  return (
    <>
      {message && (
        <p
          role={failed ? 'alert' : 'status'}
          className={css.status + (failed ? ' ' + css.error : '')}
        >
          {message}
        </p>
      )}
      <div className={css.grid}>
        <section className={css.panel}>
          <h2>Банери hero · {data.banners.length}</h2>
          <p className={css.muted}>
            На головній видно лише опубліковані банери. Рекомендований розмір:
            1942 × 809 px.
          </p>
          {!data.banners.length && <p>Банерів ще немає. Додайте перший.</p>}
          <ul>
            {data.banners.map(b => (
              <li className={css.row} key={b.id}>
                <img
                  className={css.bannerPreview}
                  src={b.imageUrl}
                  alt={b.title}
                />
                <strong>{b.title}</strong>
                <p>{b.isActive ? 'Опублікований' : 'Прихований'}</p>
                <div className={css.actions}>
                  <button
                    className={css.button}
                    disabled={busy}
                    onClick={() => {
                      setForm(b);
                      setMessage('');
                    }}
                  >
                    Редагувати
                  </button>
                  <button
                    className={css.button}
                    disabled={busy}
                    onClick={() =>
                      void perform(
                        () =>
                          saveContent('banners', {
                            ...b,
                            isActive: !b.isActive,
                          }),
                        () => {
                          if (form.id === b.id)
                            setForm({ ...b, isActive: !b.isActive });
                        }
                      )
                    }
                  >
                    {b.isActive ? 'Приховати' : 'Опублікувати'}
                  </button>
                  <button
                    className={css.button + ' ' + css.danger}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Видалити банер «' + b.title + '»?'))
                        void perform(
                          () => http.delete('/admin/content/banners/' + b.id),
                          () => {
                            if (form.id === b.id) setForm(empty);
                          }
                        );
                    }}
                  >
                    Видалити
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className={css.panel}>
          <h2>{form.id ? 'Редагувати банер' : 'Додати банер'}</h2>
          <form className={css.form} onSubmit={submit}>
            <fieldset disabled={busy}>
              <label>
                Назва / альтернативний текст
                <input
                  required
                  minLength={2}
                  maxLength={200}
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label>
                Завантажити зображення
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={e => {
                    void upload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <label>
                HTTPS-посилання на фото
                <input
                  type="url"
                  required
                  value={form.imageUrl}
                  onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                />
              </label>
              {form.imageUrl && (
                <img
                  className={css.bannerPreview}
                  src={form.imageUrl}
                  alt="Попередній перегляд банера"
                />
              )}
              <label>
                Посилання при натисканні
                <input
                  maxLength={2000}
                  value={form.link}
                  onChange={e => setForm({ ...form, link: e.target.value })}
                  placeholder="/#catalog"
                />
              </label>
              <label className={css.check}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={e =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                Показувати на головній
              </label>
              <div className={css.actions}>
                <button className={css.button + ' ' + css.primary}>
                  {busy ? 'Збереження…' : 'Зберегти банер'}
                </button>
                <button
                  type="button"
                  className={css.button}
                  onClick={() => setForm(empty)}
                >
                  Новий банер
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      </div>
    </>
  );
}
