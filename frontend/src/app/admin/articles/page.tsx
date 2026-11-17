'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminArticles,
  getAdminArticle,
  saveArticle,
  deleteArticle,
  type ArticleInput,
} from '@/services/admin';
import css from '../Admin.module.css';
import {uploadPhoto} from '@/services/catalogAdmin';
import {uploadVideo} from '@/services/contentAdmin';
const empty: ArticleInput = {
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  category: 'Догляд за волоссям',
  author: 'omee store',
  seoTitle: '',
  seoDescription: '',
  sources: [],
  media: [],
  status: 'draft',
};
export default function Articles() {
  const client = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['admin', 'articles'],
    queryFn: getAdminArticles,
  });
  const [form, setForm] = useState<ArticleInput>(empty);
  const [id, setId] = useState<string>();
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
        client.invalidateQueries({ queryKey: ['admin', 'articles'] }),
        client.invalidateQueries({ queryKey: ['articles'] }),
        client.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      done?.();
      setMessage('Зміни збережено.');
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error ? e.message : 'Не вдалося зберегти статтю.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function edit(articleId: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { id: loadedId, ...input } = await getAdminArticle(articleId);
      setId(loadedId);
      setForm({...input,media:input.media||[]});
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : 'Помилка завантаження.');
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    setId(undefined);
    setForm(empty);
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await perform(() => saveArticle(form, id), reset);
  }
  return (
    <>
      {message && (
        <p
          className={css.status + (failed ? ' ' + css.error : '')}
          role={failed ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
      <div className={css.grid}>
        <section className={css.panel}>
          <h2>Журнал</h2>
          <p className={css.muted}>
            Чернетки видно лише адміністраторам. Опубліковані статті з’являються
            в журналі магазину.
          </p>
          {isPending && <p role="status">Завантаження статей…</p>}
          {error && (
            <p role="alert">
              {error.message}{' '}
              <button className={css.button} onClick={() => void refetch()}>
                Повторити
              </button>
            </p>
          )}
          {data?.length === 0 && <p>Поки немає статей.</p>}
          <ul>
            {data?.map(a => (
              <li className={css.row} key={a.id}>
                <strong>{a.title}</strong>
                <p>
                  {a.category} ·{' '}
                  {a.status === 'published' ? 'Опубліковано' : 'Чернетка'}
                </p>
                <div className={css.actions}>
                  <button
                    className={css.button}
                    disabled={busy}
                    onClick={() => void edit(a.id)}
                  >
                    Редагувати
                  </button>
                  {a.status === 'published' && (
                    <Link href={'/blog/' + a.slug} target="_blank">
                      Переглянути ↗
                    </Link>
                  )}
                  <button
                    className={css.button + ' ' + css.danger}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm('Видалити статтю «' + a.title + '»?'))
                        void perform(
                          () => deleteArticle(a.id),
                          () => {
                            if (id === a.id) reset();
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
          <h2>{id ? 'Редагувати публікацію' : 'Нова публікація'}</h2>
          <form className={css.form} onSubmit={submit}>
            <fieldset disabled={busy}>
              {(
                [
                  { key: 'title', label: 'Заголовок', max: 240 },
                  {
                    key: 'slug',
                    label: 'Адреса статті (латиниця та дефіси)',
                    max: 180,
                  },
                  { key: 'category', label: 'Категорія', max: 120 },
                  { key: 'author', label: 'Автор', max: 120 },
                  { key: 'seoTitle', label: 'SEO-заголовок', max: 160 },
                ] as const
              ).map(f => (
                <label key={f.key}>
                  {f.label}
                  <input
                    required
                    maxLength={f.max}
                    minLength={f.key === 'title' ? 2 : 1}
                    pattern={
                      f.key === 'slug' ? '[a-z0-9]+(-[a-z0-9]+)*' : undefined
                    }
                    value={form[f.key]}
                    onChange={e =>
                      setForm({ ...form, [f.key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Короткий опис
                <textarea
                  required
                  minLength={2}
                  maxLength={2000}
                  value={form.excerpt}
                  onChange={e => setForm({ ...form, excerpt: e.target.value })}
                />
              </label>
              <label>
                Текст статті
                <textarea
                  required
                  minLength={2}
                  maxLength={20000}
                  rows={14}
                  value={form.body}
                  onChange={e => setForm({ ...form, body: e.target.value })}
                />
              </label>
              <p className={css.muted}>
                Розділяйте абзаци порожнім рядком. Для підзаголовка почніть
                рядок із ## та пробілу.
              </p>
              <label>
                SEO-опис
                <textarea
                  required
                  maxLength={320}
                  value={form.seoDescription}
                  onChange={e =>
                    setForm({ ...form, seoDescription: e.target.value })
                  }
                />
              </label>
              <h3>Фото та відео цієї публікації</h3>
              <p className={css.muted}>Один запис журналу може містити текст, кілька фото та відео. Кожен файл додається окремо.</p>
              {form.media.map((item,i)=><div className={css.form} key={i}>
                <strong>{item.type==='photo'?'Фото':'Відео'} №{i+1}</strong>
                <label>HTTPS-посилання<input type="url" required value={item.url} onChange={e=>setForm(current=>({...current,media:current.media.map((v,n)=>n===i?{...v,url:e.target.value}:v)}))}/></label>
                <label>Завантажити {item.type==='photo'?'фото (до 5 МБ)':'відео (до 25 МБ)'}<input type="file" accept={item.type==='photo'?'image/jpeg,image/png,image/webp':'video/mp4,video/webm'} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;e.target.value='';if(busy)return;setBusy(true);try{if(file.size>(item.type==='photo'?5:25)*1024*1024)throw Error('Файл перевищує допустимий розмір.');const url=await (item.type==='photo'?uploadPhoto(file):uploadVideo(file));setForm(current=>({...current,media:current.media.map((v,n)=>n===i?{...v,url}:v)}));setMessage('Файл завантажено. Збережіть публікацію.');}catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'Помилка завантаження.');}finally{setBusy(false);}}}/></label>
                <label>Підпис<input maxLength={300} value={item.caption} onChange={e=>setForm(current=>({...current,media:current.media.map((v,n)=>n===i?{...v,caption:e.target.value}:v)}))}/></label>
                <button type="button" className={css.button+' '+css.danger} onClick={()=>setForm(current=>({...current,media:current.media.filter((_,n)=>n!==i)}))}>Прибрати {item.type==='photo'?'фото':'відео'}</button>
              </div>)}
              <div className={css.actions}><button type="button" className={css.button} disabled={form.media.length>=20} onClick={()=>setForm(current=>({...current,media:[...current.media,{type:'photo',url:'',caption:''}]}))}>+ Додати фото</button><button type="button" className={css.button} disabled={form.media.length>=20} onClick={()=>setForm(current=>({...current,media:[...current.media,{type:'video',url:'',caption:''}]}))}>+ Додати відео</button></div>
              <h3>Джерела</h3>
              {form.sources.map((source, i) => (
                <div className={css.form} key={i}>
                  <label>
                    Назва джерела
                    <input
                      required
                      maxLength={240}
                      value={source.title}
                      onChange={e =>
                        setForm({
                          ...form,
                          sources: form.sources.map((s, n) =>
                            n === i ? { ...s, title: e.target.value } : s
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    HTTPS-посилання
                    <input
                      type="url"
                      required
                      maxLength={2000}
                      value={source.url}
                      onChange={e =>
                        setForm({
                          ...form,
                          sources: form.sources.map((s, n) =>
                            n === i ? { ...s, url: e.target.value } : s
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Дата перевірки
                    <input
                      type="date"
                      required
                      value={source.accessedAt}
                      onChange={e =>
                        setForm({
                          ...form,
                          sources: form.sources.map((s, n) =>
                            n === i ? { ...s, accessedAt: e.target.value } : s
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className={css.button}
                    onClick={() =>
                      setForm({
                        ...form,
                        sources: form.sources.filter((_, n) => n !== i),
                      })
                    }
                  >
                    Прибрати джерело
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={css.button}
                disabled={form.sources.length >= 10}
                onClick={() =>
                  setForm({
                    ...form,
                    sources: [
                      ...form.sources,
                      {
                        title: '',
                        url: '',
                        accessedAt: new Date().toISOString().slice(0, 10),
                      },
                    ],
                  })
                }
              >
                Додати джерело
              </button>
              <label>
                Публікація
                <select
                  value={form.status}
                  onChange={e =>
                    setForm({
                      ...form,
                      status: e.target.value as ArticleInput['status'],
                    })
                  }
                >
                  <option value="draft">Чернетка</option>
                  <option value="published">Опублікувати</option>
                </select>
              </label>
              <div className={css.actions}>
                <button className={css.button + ' ' + css.primary}>
                  {busy ? 'Збереження…' : 'Зберегти публікацію'}
                </button>
                <button type="button" className={css.button} onClick={reset}>
                  Нова стаття
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      </div>
    </>
  );
}
