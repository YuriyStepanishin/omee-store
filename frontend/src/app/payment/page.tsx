import type { Metadata } from 'next';
import Link from 'next/link';
import OpenCartButton from '@/components/OpenCartButton/OpenCartButton';
import css from '@/components/shared/InfoPage.module.css';
export const metadata: Metadata = { title: 'Оплата' };
export default function Payment() {
  return (
    <main className={css.page}>
      <h1>Оплата замовлень</h1>
      <p>
        Після оформлення замовлення очікуйте підтвердження. Наявність товарів,
        остаточну суму та спосіб оплати узгодимо з вами перед оплатою.
      </p>
      <p>
        Онлайн-оплата на сайті поки не підключена. Натискання кнопки оформлення
        замовлення не списує кошти з вашого рахунку.
      </p>
      <OpenCartButton className={css.cartLink}>
        Оформити замовлення
      </OpenCartButton>
      <Link href="/#contacts">Уточнити деталі</Link>
    </main>
  );
}
