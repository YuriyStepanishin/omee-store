'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAdminArticles,
  getAdminArticle,
  saveArticle,
  deleteArticle,
  setArticlePublication,
  type ArticleInput,
} from '@/services/admin';
import css from '../Admin.module.css';
import EditPanel from '../EditPanel';
import JournalMediaFields from './JournalMediaFields';
import { createSlug } from '@/utils/createSlug';
import MediaPreview from '@/components/MediaPreview/MediaPreview';
import { uploadPhoto } from '@/services/catalogAdmin';
import {
  deleteMedia,
  getContent,
  saveContent,
  setMediaPublication,
  uploadVideo,
  type SiteMedia,
} from '@/services/contentAdmin';
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
const emptyMedia: SiteMedia = {
  title: '',
  type: 'photo',
  url: '',
  cover: '',
  isActive: false,
  sortOrder: 0,
};

function PublicationActions({
  published,
  busy,
  onToggle,
  onRemove,
}: {
  published: boolean;
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={css.publishBox + ' ' + css.productPublicationActions}>
      <p>{published ? 'Опубліковано' : 'Не опубліковано'}</p>
      <div className={css.actions}>
        <button
          type="button"
          className={css.button + (published ? '' : ' ' + css.primary)}
          disabled={busy}
          onClick={onToggle}
        >
          {published ? 'Зняти з сайту' : 'Опублікувати'}
        </button>
        <button
          type="button"
          className={css.button + ' ' + css.danger}
          disabled={busy}
          onClick={onRemove}
        >
          Видалити з Бази Даних
        </button>
      </div>
    </div>
  );
}

export default function JournalEditor({
  section,
}: {
  section: 'articles' | 'media';
}) {
  const articles = section === 'articles';
  const client = useQueryClient();
  const { data, error, isPending, refetch } = useQuery({
    queryKey: ['admin', 'articles'],
    queryFn: getAdminArticles,
    enabled: articles,
  });
  const content = useQuery({
    queryKey: ['admin', 'content'],
    queryFn: getContent,
    select: data => data.media,
    enabled: !articles,
  });
  const [media, setMedia] = useState(emptyMedia);
  const [savedMedia, setSavedMedia] = useState<SiteMedia>();
  const [form, setForm] = useState<ArticleInput>(empty);
  const [id, setId] = useState<string>();
  const [savedArticle, setSavedArticle] = useState<ArticleInput>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function perform(
    task: () => Promise<unknown>,
    done?: () => void,
    success = 'Зміни збережено.'
  ) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await task();
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'articles'] }),
        client.invalidateQueries({ queryKey: ['admin', 'content'] }),
        client.invalidateQueries({ queryKey: ['articles'] }),
        client.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      done?.();
      setMessage(success);
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
      const article = { ...input, media: input.media ?? [] };
      setSavedArticle(article);
      setForm(article);
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
    setSavedArticle(undefined);
    setMedia(emptyMedia);
    setSavedMedia(undefined);
  }
  function closeEditor() {
    reset();
    setMessage('');
  }
  function openMedia(item?: SiteMedia) {
    setMedia(item ?? emptyMedia);
    setSavedMedia(item);
    setMessage('');
  }
  async function uploadMedia(file: File | undefined, cover: boolean) {
    if (!file || busy) return;
    const video = !cover && media.type === 'video';
    setBusy(true);
    setFailed(false);
    try {
      if (file.size > (video ? 25 : 5) * 1024 * 1024) {
        throw new Error(
          video ? 'Відео: максимум 25 МБ.' : 'Фото: максимум 5 МБ.'
        );
      }
      const url = await (video ? uploadVideo(file) : uploadPhoto(file));
      setMedia(current =>
        cover
          ? { ...current, cover: url }
          : {
              ...current,
              url,
              cover: current.type === 'photo' ? url : current.cover,
            }
      );
      setMessage('Файл завантажено. Збережіть матеріал.');
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error ? error.message : 'Не вдалося завантажити файл.'
      );
    } finally {
      setBusy(false);
    }
  }
  function toggleMedia() {
    if (!savedMedia?.id) return;
    const { id } = savedMedia;
    const isActive = !savedMedia.isActive;
    void perform(
      () => setMediaPublication(id, isActive),
      () => {
        setSavedMedia({ ...savedMedia, isActive });
        setMedia(current => ({ ...current, isActive }));
      },
      isActive ? 'Матеріал опубліковано.' : 'Матеріал знято з сайту.'
    );
  }
  function removeMedia() {
    if (
      busy ||
      !savedMedia?.id ||
      !window.confirm(`Видалити «${savedMedia.title}» з бази даних назавжди?`)
    )
      return;
    const { id } = savedMedia;
    void perform(
      () => deleteMedia(id),
      reset,
      'Матеріал видалено з Бази Даних.'
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const input = {
      ...form,
      slug: id ? form.slug : createSlug(form.title, 'stattya', 180),
      seoTitle: form.seoTitle.trim() || form.title.trim().slice(0, 160),
      seoDescription:
        form.seoDescription.trim() || form.excerpt.trim().slice(0, 320),
      status: savedArticle?.status ?? 'draft',
    };
    await perform(() => saveArticle(input, id), reset);
  }
  function togglePublication() {
    if (!id || !savedArticle) return;
    const status = savedArticle.status === 'published' ? 'draft' : 'published';
    void perform(
      () => setArticlePublication(id, status),
      () => {
        setSavedArticle({ ...savedArticle, status });
      },
      status === 'published' ? 'Статтю опубліковано.' : 'Статтю знято з сайту.'
    );
  }
  function remove() {
    if (
      !id ||
      !savedArticle ||
      busy ||
      !window.confirm(`Видалити «${savedArticle.title}» з бази даних назавжди?`)
    )
      return;
    void perform(
      () => deleteArticle(id),
      reset,
      'Публікацію видалено з Бази Даних.'
    );
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
          <h2>{articles ? 'Журнал' : 'Матеріали журналу'}</h2>
          {articles && isPending && <p role="status">Завантаження статей…</p>}
          {articles && error && (
            <p role="alert">
              {error.message}{' '}
              <button className={css.button} onClick={() => void refetch()}>
                Повторити
              </button>
            </p>
          )}
          {!articles && content.isPending && (
            <p role="status">Завантаження фото й відео…</p>
          )}
          {!articles && content.error && (
            <p role="alert">
              {content.error.message}{' '}
              <button
                type="button"
                className={css.button}
                onClick={() => void content.refetch()}
              >
                Повторити
              </button>
            </p>
          )}
          {(articles ? data?.length : content.data?.length) === 0 && (
            <p>{articles ? 'Поки немає статей.' : 'Поки немає матеріалів.'}</p>
          )}
          <ul className={css.list}>
            {articles
              ? data?.map(a => (
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
                    </div>
                  </li>
                ))
              : content.data?.map(item => (
                  <li className={css.row} key={`media-${item.id}`}>
                    <strong>{item.title}</strong>
                    <p>
                      {item.type === 'photo' ? 'Фото' : 'Відео'} ·{' '}
                      {item.isActive ? 'Опубліковано' : 'Не опубліковано'} ·
                      Порядок {item.sortOrder}
                    </p>
                    <button
                      type="button"
                      className={css.button}
                      disabled={busy}
                      onClick={() => openMedia(item)}
                    >
                      Редагувати
                    </button>
                  </li>
                ))}
          </ul>
        </section>
        {articles ? (
          <EditPanel
            title={id ? 'Редагувати публікацію' : 'Нова публікація'}
            editing={Boolean(id)}
            busy={busy}
            message={message}
            failed={failed}
            onDismiss={closeEditor}
          >
            <form className={css.form} onSubmit={submit}>
              <fieldset disabled={busy}>
                {(
                  [
                    { key: 'title', label: 'Заголовок', max: 240 },
                    { key: 'category', label: 'Категорія', max: 120 },
                    { key: 'author', label: 'Автор', max: 120 },
                  ] as const
                ).map(f => (
                  <label key={f.key}>
                    {f.label}
                    <input
                      required
                      maxLength={f.max}
                      minLength={f.key === 'title' ? 2 : 1}
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
                    onChange={e =>
                      setForm({ ...form, excerpt: e.target.value })
                    }
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
                <h3>Фото та відео цієї публікації</h3>
                <p className={css.muted}>
                  Один запис журналу може містити текст, кілька фото та відео.
                  Кожен файл додається окремо.
                </p>
                {form.media.map((item, i) => (
                  <div className={css.form} key={i}>
                    <strong>
                      {item.type === 'photo' ? 'Фото' : 'Відео'} №{i + 1}
                    </strong>
                    <label>
                      HTTPS-посилання
                      <input
                        type="url"
                        required
                        value={item.url}
                        onChange={e =>
                          setForm(current => ({
                            ...current,
                            media: current.media.map((v, n) =>
                              n === i ? { ...v, url: e.target.value } : v
                            ),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Завантажити{' '}
                      {item.type === 'photo'
                        ? 'фото (до 5 МБ)'
                        : 'відео (до 25 МБ)'}
                      <input
                        type="file"
                        accept={
                          item.type === 'photo'
                            ? 'image/jpeg,image/png,image/webp'
                            : 'video/mp4,video/webm'
                        }
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          e.target.value = '';
                          if (busy) return;
                          setBusy(true);
                          try {
                            if (
                              file.size >
                              (item.type === 'photo' ? 5 : 25) * 1024 * 1024
                            )
                              throw Error('Файл перевищує допустимий розмір.');
                            const url = await (item.type === 'photo'
                              ? uploadPhoto(file)
                              : uploadVideo(file));
                            setForm(current => ({
                              ...current,
                              media: current.media.map((v, n) =>
                                n === i ? { ...v, url } : v
                              ),
                            }));
                            setMessage(
                              'Файл завантажено. Збережіть публікацію.'
                            );
                          } catch (error) {
                            setFailed(true);
                            setMessage(
                              error instanceof Error
                                ? error.message
                                : 'Помилка завантаження.'
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                      />
                    </label>
                    <label>
                      Підпис
                      <input
                        maxLength={300}
                        value={item.caption}
                        onChange={e =>
                          setForm(current => ({
                            ...current,
                            media: current.media.map((v, n) =>
                              n === i ? { ...v, caption: e.target.value } : v
                            ),
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={css.button + ' ' + css.danger}
                      onClick={() =>
                        setForm(current => ({
                          ...current,
                          media: current.media.filter((_, n) => n !== i),
                        }))
                      }
                    >
                      Прибрати {item.type === 'photo' ? 'фото' : 'відео'}
                    </button>
                  </div>
                ))}
                <div className={css.actions}>
                  <button
                    type="button"
                    className={css.button}
                    disabled={form.media.length >= 20}
                    onClick={() =>
                      setForm(current => ({
                        ...current,
                        media: [
                          ...current.media,
                          { type: 'photo', url: '', caption: '' },
                        ],
                      }))
                    }
                  >
                    + Додати фото
                  </button>
                  <button
                    type="button"
                    className={css.button}
                    disabled={form.media.length >= 20}
                    onClick={() =>
                      setForm(current => ({
                        ...current,
                        media: [
                          ...current.media,
                          { type: 'video', url: '', caption: '' },
                        ],
                      }))
                    }
                  >
                    + Додати відео
                  </button>
                </div>
                <details
                  className={css.productExtras}
                  onInvalidCapture={event => {
                    event.currentTarget.open = true;
                  }}
                >
                  <summary>Додатково</summary>
                  <div className={css.productExtraFields}>
                    <label>
                      SEO-заголовок
                      <input
                        maxLength={160}
                        placeholder="Заголовок статті"
                        value={form.seoTitle}
                        onChange={e =>
                          setForm({ ...form, seoTitle: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      SEO-опис
                      <textarea
                        maxLength={320}
                        placeholder="Короткий опис статті"
                        value={form.seoDescription}
                        onChange={e =>
                          setForm({ ...form, seoDescription: e.target.value })
                        }
                      />
                    </label>
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
                                  n === i
                                    ? { ...s, accessedAt: e.target.value }
                                    : s
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
                  </div>
                </details>
                <div className={css.actions}>
                  <button className={css.button + ' ' + css.primary}>
                    {busy ? 'Збереження…' : 'Зберегти публікацію'}
                  </button>
                  {id && (
                    <button
                      type="button"
                      className={css.button}
                      onClick={closeEditor}
                    >
                      Нова стаття
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
            {id && savedArticle && (
              <>
                <details key={id} className={css.productExtras}>
                  <summary>Переглянути збережену статтю</summary>
                  <article className={css.productExtraFields}>
                    <h3>{savedArticle.title}</h3>
                    <p>{savedArticle.excerpt}</p>
                    {savedArticle.body
                      .split(/\n\s*\n/)
                      .map((block, index) =>
                        block.startsWith('## ') ? (
                          <h4 key={index}>{block.slice(3)}</h4>
                        ) : (
                          <p key={index}>{block}</p>
                        )
                      )}
                    {savedArticle.media.map((item, index) => (
                      <MediaPreview
                        key={index}
                        item={{
                          ...item,
                          id: String(index),
                          title: item.caption || savedArticle.title,
                          cover: '',
                        }}
                      />
                    ))}
                  </article>
                </details>
                <PublicationActions
                  published={savedArticle.status === 'published'}
                  busy={busy}
                  onToggle={togglePublication}
                  onRemove={remove}
                />
              </>
            )}
          </EditPanel>
        ) : (
          <EditPanel
            title={media.id ? 'Редагування матеріалу' : 'Новий матеріал'}
            editing={Boolean(media.id)}
            busy={busy}
            message={message}
            failed={failed}
            onDismiss={closeEditor}
          >
            <form
              className={css.form}
              onSubmit={event => {
                event.preventDefault();
                void perform(
                  () =>
                    saveContent('media', {
                      ...media,
                      isActive: savedMedia?.isActive ?? false,
                    }),
                  reset
                );
              }}
            >
              <fieldset disabled={busy}>
                <JournalMediaFields
                  media={media}
                  onChange={setMedia}
                  onUpload={(file, cover) => void uploadMedia(file, cover)}
                />
                <button className={css.button + ' ' + css.primary}>
                  Зберегти матеріал
                </button>
                {media.id && (
                  <button
                    type="button"
                    className={css.button}
                    onClick={closeEditor}
                  >
                    Новий матеріал
                  </button>
                )}
              </fieldset>
            </form>
            {savedMedia?.id && (
              <>
                <details key={savedMedia.id} className={css.productExtras}>
                  <summary>Переглянути збережений матеріал</summary>
                  <MediaPreview item={{ ...savedMedia, id: savedMedia.id }} />
                </details>
                <PublicationActions
                  published={savedMedia.isActive}
                  busy={busy}
                  onToggle={toggleMedia}
                  onRemove={removeMedia}
                />
              </>
            )}
          </EditPanel>
        )}
      </div>
    </>
  );
}
