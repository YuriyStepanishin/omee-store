'use client';

import Image from 'next/image';
import { useId, useState } from 'react';
import css from '@/components/shared/InfoPage.module.css';
import { DELIVERY_CARRIERS } from '@/constants/delivery';

const carrierLogos = {
  nova_poshta: '/Nova_Poshta_logo.svg',
  ukrposhta: '/Ukrposhta_logo.svg',
  meest: '/Meest_logo.svg',
};

export default function DeliveryInfo({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const Heading = embedded ? 'h3' : 'h1';
  const pickupDetailsId = useId();
  const [pickupOpen, setPickupOpen] = useState(false);
  const [hoverDismissed, setHoverDismissed] = useState(false);

  return (
    <section
      className={css.delivery}
      id="delivery"
      aria-labelledby="delivery-heading"
    >
      <Heading className={css.deliveryTitle} id="delivery-heading">
        Доставка та самовивіз
      </Heading>
      <p>
        Під час оформлення замовлення оберіть перевізника й спосіб отримання.
      </p>

      <div
        className={css.deliveryChoices}
        onKeyDown={event => {
          if (event.key === 'Escape') {
            setPickupOpen(false);
            setHoverDismissed(true);
          }
        }}
      >
        <ul className={css.deliveryOptions} aria-label="Варіанти отримання">
          {DELIVERY_CARRIERS.map(carrier => (
            <li className={css.carrier} key={carrier.id}>
              <div className={css.carrierLogoPanel}>
                <Image
                  className={css.carrierLogo}
                  src={carrierLogos[carrier.id]}
                  alt={carrier.name}
                  width={176}
                  height={50}
                  unoptimized
                />
              </div>
              <p>
                {carrier.id === 'ukrposhta'
                  ? 'Відділення або кур’єр'
                  : 'Відділення, поштомат або кур’єр'}
              </p>
            </li>
          ))}
          <li
            className={`${css.carrier} ${css.pickup}`}
            onPointerLeave={() => setHoverDismissed(false)}
          >
            <div className={css.carrierLogoPanel}>
              <Image
                className={css.carrierLogo}
                src="/KM-Studio.svg"
                alt="Katya Musiychuk Hair Studio"
                width={105}
                height={70}
                unoptimized
              />
            </div>
            <p>
              <button
                type="button"
                className={css.pickupButton}
                aria-expanded={pickupOpen}
                aria-controls={pickupDetailsId}
                onClick={() => {
                  setPickupOpen(!pickupOpen);
                  setHoverDismissed(pickupOpen);
                }}
              >
                Самовивіз
              </button>
            </p>
          </li>
        </ul>
        <p
          className={css.pickupDetails}
          id={pickupDetailsId}
          data-open={pickupOpen}
          data-hover-dismissed={hoverDismissed}
        >
          Замовлення можна забрати у студії. Адресу побачите під час оформлення,
          а час отримання узгодимо після підтвердження.
        </p>
      </div>

      <p>
        Оберіть населений пункт і пункт отримання з довідника, якщо він
        доступний, або введіть адресу вручну. Для кур’єра вкажіть вулицю,
        будинок і, за наявності, квартиру. Вартість і термін доставки уточнимо
        під час підтвердження замовлення.
      </p>
    </section>
  );
}
