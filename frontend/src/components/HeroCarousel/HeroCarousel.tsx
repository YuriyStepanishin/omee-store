'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import css from './HeroCarousel.module.css';

export type HeroBanner = {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
};

const INTERVAL_MS = 6000;

function optimized(url: string, width: number) {
  return url.includes('res.cloudinary.com') && url.includes('/upload/')
    ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`)
    : url;
}

export default function HeroCarousel({ banners }: { banners: HeroBanner[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = banners.length;
  const go = useCallback(
    (next: number) => setIndex((next + count) % count),
    [count]
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const timer = window.setTimeout(() => go(index + 1), INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, count, paused, reduceMotion, go]);

  if (!count) return null;

  return (
    <section
      id="hero"
      className={css.hero}
      aria-roledescription="carousel"
      aria-label="Банери omee store"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft') go(index - 1);
        if (event.key === 'ArrowRight') go(index + 1);
      }}
      onTouchStart={event => {
        touchX.current = event.touches[0].clientX;
      }}
      onTouchEnd={event => {
        if (touchX.current === null) return;
        const delta = event.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(delta) > 40) go(index + (delta < 0 ? 1 : -1));
      }}
    >
      <h1 className={css.srOnly}>
        omee store — професійний догляд для краси вашого волосся
      </h1>
      <div className={css.viewport}>
        <ul
          className={css.track}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {banners.map((slide, i) => (
            <li
              key={slide.id}
              className={css.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} з ${count}`}
              aria-hidden={i !== index}
              inert={i !== index}
            >
              <a href={slide.link || '#catalog'} className={css.link}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={optimized(slide.imageUrl, 960)}
                  srcSet={slide.imageUrl.includes('res.cloudinary.com') && slide.imageUrl.includes('/upload/') ? [480, 768, 960, 1440, 1942].map(w => `${optimized(slide.imageUrl, w)} ${w}w`).join(', ') : undefined}
                  sizes="100vw"
                  alt={slide.title}
                  width={1942}
                  height={809}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  decoding="async"
                  className={css.image}
                />
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className={`${css.arrow} ${css.prev}`}
          aria-label="Попередній банер"
          onClick={() => go(index - 1)}
        >
          ‹
        </button>
        <button
          type="button"
          className={`${css.arrow} ${css.next}`}
          aria-label="Наступний банер"
          onClick={() => go(index + 1)}
        >
          ›
        </button>
      </div>
      <div className={css.dots}>
        {banners.map((slide, i) => (
          <button
            key={slide.id}
            type="button"
            className={css.dot}
            aria-label={`Банер ${i + 1}`}
            aria-current={i === index}
            onClick={() => go(i)}
          />
        ))}
      </div>
      <p className={css.srOnly} aria-live="polite">
        {`Банер ${index + 1} з ${count}`}
      </p>
    </section>
  );
}
