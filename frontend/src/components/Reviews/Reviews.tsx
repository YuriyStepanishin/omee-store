'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { http } from '@/services/http';
import type { ReviewSummary } from '@/types/store';
import ReviewRating, { Stars } from './ReviewRating';
import css from './Reviews.module.css';

type Review = { rating: number; comment: string };
type ReviewPage = {
  summary: ReviewSummary;
  items: Array<Review & { id: string; author: string; createdAt: string }>;
  hasNext: boolean;
};
const dateFormat = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeZone: 'Europe/Kyiv' });
const emptyReview = { rating: 0, comment: '' };

function ReviewForm({ target, userId, onSave }: {
  target: string;
  userId: string;
  onSave: () => void;
}) {
  const inputName = useId();
  const client = useQueryClient();
  const key = ['my-review', target, userId];
  const endpoint = `/reviews/${target}/mine`;
  const [draft, setDraft] = useState<Review | null>(null);
  const mine = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => (await http.get<Review | null>(endpoint, { signal })).data,
    retry: false,
  });
  const review = draft ?? mine.data ?? emptyReview;
  const save = useMutation({
    mutationFn: async (input: Review) => (await http.put<Review>(endpoint, {
      ...input, expectedUserId: userId,
    })).data,
    onSuccess: saved => {
      client.setQueryData(key, saved);
      setDraft(null);
      onSave();
      void client.invalidateQueries({ queryKey: ['reviews', target] });
      if (target !== 'store') {
        void client.invalidateQueries({ queryKey: ['catalog', 'page'] });
        void client.invalidateQueries({ queryKey: ['catalog', 'product', target] });
        void client.invalidateQueries({ queryKey: ['favorites', userId, 'page'] });
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (review.rating && !save.isPending) save.mutate(review);
  }

  if (mine.isPending) return <p role="status">Завантажуємо вашу оцінку…</p>;
  if (mine.isError) return <p role="alert">Не вдалося завантажити вашу оцінку. <button type="button" onClick={() => void mine.refetch()}>Повторити</button></p>;
  return (
    <form className={css.form} onSubmit={submit}>
      <fieldset disabled={save.isPending}>
        <legend>{mine.data ? 'Ваша оцінка' : 'Поставте оцінку'}</legend>
        <div className={css.ratingInput}>
          {[1, 2, 3, 4, 5].map(value => (
            <label className={css.choice} key={value}>
              <input
                type="radio"
                name={inputName}
                value={value}
                aria-label={`${value} з 5`}
                checked={review.rating === value}
                onChange={() => { save.reset(); setDraft({ ...review, rating: value }); }}
                required
              />
              <span aria-hidden="true">{value <= review.rating ? '★' : '☆'}</span>
            </label>
          ))}
        </div>
        <label className={css.comment}>
          Відгук (необов’язково)
          <textarea
            rows={3}
            maxLength={2000}
            value={review.comment}
            onChange={event => { save.reset(); setDraft({ ...review, comment: event.target.value }); }}
          />
        </label>
        <button className={css.submit} disabled={!review.rating || save.isPending}>
          {mine.data ? 'Зберегти зміни' : 'Опублікувати'}
        </button>
      </fieldset>
      {save.isError && <p role="alert">{save.error.message}</p>}
      {save.isSuccess && <p role="status">Оцінку збережено.</p>}
    </form>
  );
}

export default function Reviews({ productId, id }: { productId?: string; id?: string }) {
  const target = productId ?? 'store';
  const titleId = useId();
  const userId = useAuthStore(state => state.user?.id);
  const loaded = useAuthStore(state => state.loaded);
  const [page, setPage] = useState(1);
  const reviews = useQuery({
    queryKey: ['reviews', target, page],
    queryFn: async ({ signal }) => (await http.get<ReviewPage>(`/reviews/${target}`, {
      params: { page }, signal,
    })).data,
    retry: false,
  });

  return (
    <section className={css.section} id={id} aria-labelledby={titleId}>
      <h3 id={titleId}>{productId ? 'Відгуки про товар' : 'Відгуки про магазин'}</h3>
      {reviews.isPending && <p role="status">Завантажуємо відгуки…</p>}
      {reviews.isError && <p role="alert">Не вдалося завантажити відгуки. <button type="button" onClick={() => void reviews.refetch()}>Повторити</button></p>}
      {reviews.data && <ReviewRating summary={reviews.data.summary} />}
      {userId ? (
        <ReviewForm key={`${target}:${userId}`} target={target} userId={userId} onSave={() => setPage(1)} />
      ) : loaded && (
        <p><Link href="/login">Увійдіть</Link> або <Link href="/register">зареєструйтеся</Link>, щоб залишити оцінку та відгук.</p>
      )}
      {reviews.data && (
        <>
          {reviews.data.items.length > 0 && (
            <ul className={css.list}>
              {reviews.data.items.map(item => (
                <li key={item.id}>
                  <div className={css.reviewMeta}>
                    <strong>{item.author}</strong>
                    <span className={css.rating} aria-label={`Оцінка: ${item.rating} з 5`}>
                      <Stars rating={item.rating} />
                      <span>{item.rating} / 5</span>
                    </span>
                    <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
                  </div>
                  {item.comment && <p className={css.reviewText}>{item.comment}</p>}
                </li>
              ))}
            </ul>
          )}
          {(page > 1 || reviews.data.hasNext) && (
            <nav className={css.pagination} aria-label="Сторінки відгуків">
              <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</button>
              <span>Сторінка {page}</span>
              <button type="button" disabled={!reviews.data.hasNext} onClick={() => setPage(page + 1)}>Далі</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
