'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchStoreInfo } from '@/services/storeApi';
import { BRAND } from '@/constants/brand';
import { STORE_SOCIALS } from '@/constants/socials';
import Container from '../Container/Container';
import BrandLogo from '../BrandLogo/BrandLogo';
import css from './Footer.module.css';

const telegramUrl = STORE_SOCIALS.find(social => social.id === 'telegram')!.url;
const mapUrl = 'https://maps.app.goo.gl/BkEfP8fim9A5QqoS7';

function SocialIcon({ name }: { name: (typeof STORE_SOCIALS)[number]['id'] }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'instagram' ? (
        <>
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none" />
        </>
      ) : name === 'telegram' ? (
        <path d="m21 4-3.5 16-5.3-4.3-3.4 3 .7-5.3L21 4 3 11l6.5 2.4" />
      ) : (
        <path d="M14 3v12.5a4.5 4.5 0 1 1-4-4.5v3a1.5 1.5 0 1 0 1 1.5V3h3c.5 3 2 4.5 5 5v3c-2-.3-3.5-1.2-5-2.5" />
      )}
    </svg>
  );
}

function FooterLinks({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <nav className={css.links} aria-label={title}>
      <h2>
        <span className={css.desktopTitle}>{title}</span>
        <button
          type="button"
          className={css.mobileToggle}
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(value => !value)}
        >
          {title}
          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
      </h2>
      <ul id={id} className={expanded ? css.expanded : css.collapsed}>
        {children}
      </ul>
    </nav>
  );
}

export default function Footer() {
  const { data } = useQuery({
    queryKey: ['catalog', 'info'],
    queryFn: fetchStoreInfo,
  });
  const info = data?.info;
  const phone = `Телефон: ${info?.phone?.trim() || '096 758 02 06'}`;

  return (
    <footer className={css.footer} id="contacts">
      <Container>
        <div className={css.top}>
          <div className={css.intro}>
            <h2>Допоможемо обрати ваш догляд</h2>
            <p>Поради майстра для вашого волосся</p>
          </div>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={css.consult}
          >
            Запитати майстра
          </a>
        </div>

        <div className={css.columns}>
          <div className={css.brand}>
            <Link href="/" className={css.logo}>
              <BrandLogo />
            </Link>
            <p>
              Професійний догляд
              <br />
              за волоссям.
            </p>
            <ul className={css.socials} aria-label="Соціальні мережі">
              {STORE_SOCIALS.map(social => (
                <li key={social.id}>
                  <a
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${BRAND.name} у ${social.name}: ${social.handle}`}
                    title={social.name}
                  >
                    <SocialIcon name={social.id} />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <FooterLinks id="footer-customers" title="Покупцям">
            <li>
              <Link href="/delivery">Доставка</Link>
            </li>
            <li>
              <Link href="/payment">Оплата</Link>
            </li>
          </FooterLinks>

          <FooterLinks id="footer-about" title="Про omee">
            <li>
              <Link href="/#about">Про магазин</Link>
            </li>
            <li>
              <Link href="/blog">Увесь Журнал</Link>
            </li>
            <li>
              <a href="#footer-studio">Контакти</a>
            </li>
          </FooterLinks>

          <section
            className={css.contacts}
            id="footer-studio"
            aria-labelledby="footer-visit"
          >
            <h2 id="footer-visit">Завітайте до студії</h2>
            <p className={css.studio}>KATYA MUSIYCHUK STUDIO</p>
            <address>
              <span>
                {info?.address ||
                  'Хмельницький, вул. Зарічанська, 13 (IQ центр), офіс 210'}
              </span>
              <a
                className={css.phone}
                href={'tel:' + phone.replace(/[^+\d]/g, '')}
              >
                {phone}
              </a>
              <a
                className={css.messageLink}
                href={telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Написати в Telegram
              </a>
              {info?.email && <a href={'mailto:' + info.email}>{info.email}</a>}
            </address>
          </section>
          <aside className={css.mapBanner} aria-label="Ми на Google Maps">
            <iframe
              className={css.mapFrame}
              title="Розташування KATYA MUSIYCHUK STUDIO на Google Maps"
              src="https://maps.google.com/maps?q=KATYA%20MUSIYCHUK%20STUDIO%4049.435079%2C26.9881472&z=15&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <a
              className={css.mapLink}
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Maps
            </a>
          </aside>
        </div>

        <div className={css.bottom}>
          <p>
            © {new Date().getFullYear()} {BRAND.name}
          </p>
          <span className={css.signature}>
            Догляд, що починається з любові до себе
          </span>
          <a
            href="#top"
            onClick={event => {
              event.preventDefault();
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'instant'
                  : 'smooth',
              });
            }}
          >
            Нагору <span aria-hidden="true">↑</span>
          </a>
        </div>
      </Container>
    </footer>
  );
}
