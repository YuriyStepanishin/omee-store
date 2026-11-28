import type { ReviewSummary } from '@/types/store';
import css from './Reviews.module.css';

export function Stars({ rating }: { rating: number }) {
  return (
    <span className={css.stars} aria-hidden="true">
      {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
    </span>
  );
}

export default function ReviewRating({ summary }: { summary?: ReviewSummary }) {
  const average = summary?.average;
  return (
    <span className={css.rating}>
      <Stars rating={average ?? 0} />
      {average == null ? 'Без оцінок' : `${average.toLocaleString('uk-UA')} / 5 (${summary?.count ?? 0})`}
    </span>
  );
}
