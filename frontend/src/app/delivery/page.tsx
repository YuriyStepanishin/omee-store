import type { Metadata } from 'next';
import DeliveryInfo from '@/components/DeliveryInfo/DeliveryInfo';
import css from '@/components/shared/InfoPage.module.css';

export const metadata: Metadata = { title: 'Доставка' };

export default function Delivery() {
  return (
    <main className={css.page}>
      <DeliveryInfo />
    </main>
  );
}
