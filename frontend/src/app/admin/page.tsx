import Link from 'next/link';
import css from './Admin.module.css';
const sections = [
  [
    '/admin/hero',
    'Банери hero',
    'Додавайте банери, змінюйте фото й посилання та керуйте показом на головній.',
  ],
  [
    '/admin/products',
    'Товари',
    'Додавайте й редагуйте товари, ціни, фото та залишки. Публікуйте або прибирайте з продажу.',
  ],
  [
    '/admin/articles',
    'Журнал',
    'Створюйте статті, зберігайте чернетки та публікуйте матеріали.',
  ],
  [
    '/admin/orders',
    'Замовлення',
    'Переглядайте склад замовлень, уточнюйте доставку та змінюйте статуси.',
  ],
];
export default function Admin() {
  return (
    <>
      <div className={css.dashboard}>
        {sections.map(([href, title, text]) => (
          <Link className={css.dashboardCard} href={href} key={href}>
            <h2>{title} →</h2>
            <p>{text}</p>
          </Link>
        ))}
      </div>
      <div className={css.actions}>
        <Link href="/admin/categories">Категорії товарів</Link>
        <Link href="/admin/content">Контакти, медіа та промокоди</Link>
      </div>
    </>
  );
}
