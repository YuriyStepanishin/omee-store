import type { Metadata } from 'next';
import Link from 'next/link';
import OpenCartButton from '@/components/OpenCartButton/OpenCartButton';
import css from '@/components/shared/InfoPage.module.css';
import { DELIVERY_CARRIERS } from '@/constants/delivery';

export const metadata: Metadata = { title: 'Доставка' };

const carrierBadges = { nova_poshta: 'НП', ukrposhta: 'УП', meest: 'ME' };

export default function Delivery() {
  return (
    <main className={css.page}>
      <h1>Доставка та самовивіз</h1>
      <p>Під час оформлення замовлення оберіть перевізника й спосіб отримання.</p>

      <div className={css.carriers}>
        {DELIVERY_CARRIERS.map(carrier => (
          <section className={css.carrier} key={carrier.id}>
            <span className={css.carrierBadge} data-carrier={carrier.id} aria-hidden="true">
              {carrierBadges[carrier.id]}
            </span>
            <h2>{carrier.name}</h2>
            <p>{carrier.id === 'ukrposhta' ? 'Відділення або кур’єр' : 'Відділення, поштомат або кур’єр'}</p>
          </section>
        ))}
      </div>

      <p>Оберіть населений пункт і пункт отримання з довідника або введіть адресу вручну. Для кур’єра вкажіть вулицю, будинок і, за наявності, квартиру. Вартість і термін доставки уточнимо під час підтвердження замовлення.</p>

      <section className={css.pickup}>
        <h2>Самовивіз</h2>
        <p>Замовлення можна забрати у студії. Адресу побачите під час оформлення, а час отримання узгодимо після підтвердження.</p>
      </section>

      <div className={css.deliveryActions}>
        <OpenCartButton className={css.cartLink}>Відкрити кошик</OpenCartButton>
        <Link href="#contacts">Зв’язатися з нами</Link>
      </div>
    </main>
  );
}
