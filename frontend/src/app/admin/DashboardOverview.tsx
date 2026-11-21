'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { http } from '@/services/http';
import { getOrders, statusLabels } from '@/services/admin';
import AdminIcon, { type AdminIconName } from './AdminIcon';
import css from './Admin.module.css';

type Summary = {
 products: number; orders: number; new_orders: number; customers: number;
 published_products: number; draft_products: number; hidden_by_category: number; in_stock: number;
};
const money = (value: number | string) => Number(value).toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' });
const metrics: ReadonlyArray<readonly [keyof Summary, string, AdminIconName, string]> = [
 ['products', 'Товари', 'products', '/admin/products'],
 ['orders', 'Замовлення', 'orders', '/admin/orders'],
 ['customers', 'Клієнти', 'customers', '/admin/customers'],
 ['new_orders', 'Нові замовлення', 'overview', '/admin/orders'],
];
export default function DashboardOverview() {
 const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: async () => (await http.get<Summary>('/admin/overview')).data });
 const orders = useQuery({ queryKey: ['admin', 'orders', 1, ''], queryFn: () => getOrders(1, '') });
 const items = orders.data?.items ?? [];
 const summary = overview.data;
 return <>
  <div className={css.metrics} aria-label="Показники магазину">
   {metrics.map(([key, label, icon, href]) => <Link href={href} className={css.metricCard} key={key}><span className={css.metricIcon}><AdminIcon name={icon}/></span><span className={css.metricLabel}>{label}</span><strong>{overview.data ? overview.data[key].toLocaleString('uk-UA') : '—'}</strong><span className={css.muted}>{overview.isPending ? 'Завантаження…' : overview.isError ? 'Дані недоступні' : 'Переглянути розділ →'}</span></Link>)}
  </div>
  {overview.isError && <p className={css.status} role="alert">Не вдалося завантажити показники. <button type="button" className={css.button} onClick={() => void overview.refetch()}>Повторити</button></p>}
  <div className={css.overviewGrid}>
   <section className={css.panel}><div className={css.panelHeading}><div><h2>Стан замовлень</h2><p className={css.muted}>Останні {items.length} замовлень</p></div><AdminIcon name="orders"/></div>
    {orders.isPending ? <p role="status">Завантаження…</p> : orders.isError ? <p role="alert">Не вдалося завантажити замовлення. <button className={css.button} onClick={() => void orders.refetch()}>Повторити</button></p> : items.length === 0 ? <p className={css.emptyState}>Нові замовлення з’являться тут.</p> : <div className={css.stockList}>{Object.entries(statusLabels).map(([status, label]) => { const count = items.filter(item => item.status === status).length; return <div className={css.progressRow} key={status}><span>{label}</span><strong>{count}</strong><progress aria-label={label} max={items.length} value={count}/></div>; })}</div>}
   </section>
   <section className={css.panel}><div className={css.panelHeading}><div><h2>Огляд товарів</h2><p className={css.muted}>Наявність у каталозі</p></div><AdminIcon name="products"/></div>
    {summary && <>
     <div className={css.inventoryTotal}><strong>{summary.products.toLocaleString('uk-UA')}</strong><span>карток товарів у каталозі</span></div>
     <div className={css.stockList}>
      {[
        ['На вітрині', summary.published_products],
        ['Чернетки', summary.draft_products],
        ['Приховано категорією', summary.hidden_by_category],
        ['У наявності', summary.in_stock],
        ['Немає в наявності', summary.products - summary.in_stock],
      ].map(([label, count]) => <div className={css.inventoryRow} key={label}><span>{label}</span><strong>{count}</strong></div>)}
     </div>
    </>}
    <Link className={css.panelLink} href="/admin/products">Керувати товарами →</Link>
   </section>
  </div>
  <section className={css.panel}><div className={css.panelHeading}><h2>Останні замовлення</h2><Link className={css.panelLink} href="/admin/orders">Усі замовлення →</Link></div>
   {orders.isPending ? <p role="status">Завантаження…</p> : orders.isError ? <p role="alert">Замовлення тимчасово недоступні.</p> : items.length === 0 ? <p className={css.emptyState}>Поки немає замовлень.</p> : <div className={css.tableScroll}><table className={css.recentTable}><thead><tr><th scope="col">Замовлення</th><th scope="col">Клієнт</th><th scope="col">Дата</th><th scope="col">Сума</th><th scope="col">Статус</th></tr></thead><tbody>{items.slice(0, 5).map(order => <tr key={order.id}><td><Link href="/admin/orders">#{order.id}</Link></td><td>{order.customerName}</td><td><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' })}</time></td><td>{money(order.total)}</td><td><span className={css.orderBadge}>{statusLabels[order.status]}</span></td></tr>)}</tbody></table></div>}
  </section>
 </>;
}
