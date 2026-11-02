'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrders,
  getOrder,
  updateOrder,
  statusLabels,
  transitions,
  type OrderStatus,
  type OrderDetail,
} from '@/services/admin';
import css from '../Admin.module.css';
const deliveryLabel = (method: string) => {
  const [carrier, kind] = method.split(':');
  const carriers: Record<string, string> = {
    nova_poshta: 'Нова пошта',
    ukrposhta: 'Укрпошта',
    meest: 'Meest',
    pickup: 'Самовивіз',
    to_be_confirmed: 'Уточнюється',
  };
  const kinds: Record<string, string> = {
    branch: 'відділення',
    locker: 'поштомат',
    courier: 'кур’єр',
  };
  return (
    (carriers[carrier] || carrier) + (kind ? ' · ' + (kinds[kind] || kind) : '')
  );
};
const money = (n: string | number) =>
  Number(n).toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' });
export default function Orders() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState<OrderStatus>('NEW');
  const [comment, setComment] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', page, filter],
    queryFn: () => getOrders(page, filter),
  });
  function fill(order: OrderDetail) {
    setSelected(order);
    setStatus(order.status);
    setComment(order.comment);
    setCity(order.city);
    setAddress(order.address);
  }
  async function open(id: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      fill(await getOrder(id));
    } catch (e) {
      setFailed(true);
      setMessage(
        e instanceof Error ? e.message : 'Не вдалося відкрити замовлення.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected || busy) return;
    if (
      status === 'CANCELED' &&
      !window.confirm('Скасувати замовлення? Товари повернуться в залишки.')
    )
      return;
    setBusy(true);
    setMessage('');
    setFailed(false);
    try {
      await updateOrder(selected.id, {
        status,
        expectedStatus: selected.status,
        comment,
        city,
        address,
      });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'orders'] }),
        client.invalidateQueries({ queryKey: ['admin', 'products'] }),
        client.invalidateQueries({ queryKey: ['catalog'] }),
      ]);
      fill(await getOrder(selected.id));
      setMessage('Замовлення оновлено.');
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : 'Не вдалося зберегти.');
    } finally {
      setBusy(false);
    }
  }
  const terminal = selected && transitions[selected.status].length === 0;
  return (
    <>
      {message && (
        <p
          role={failed ? 'alert' : 'status'}
          className={css.status + (failed ? ' ' + css.error : '')}
        >
          {message}
        </p>
      )}
      <div className={css.grid}>
        <section className={css.panel}>
          <h2>Оформлення замовлень</h2>
          <div className={css.toolbar}>
            <select
              aria-label="Фільтр за статусом"
              value={filter}
              disabled={busy}
              onChange={e => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Усі статуси</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className={css.button}
              disabled={busy}
              onClick={() => void refetch()}
            >
              Оновити список
            </button>
          </div>
          {isPending && <p role="status">Завантаження замовлень…</p>}
          {error && (
            <p role="alert" className={css.error}>
              {error.message}
            </p>
          )}
          {data?.items.length === 0 && <p>Замовлень із цим статусом немає.</p>}
          <ul>
            {data?.items.map(o => (
              <li
                className={
                  css.row + (selected?.id === o.id ? ' ' + css.selected : '')
                }
                key={o.id}
              >
                <strong>
                  {o.customerName} · {money(o.total)}
                </strong>
                <p>
                  {new Date(o.createdAt).toLocaleString('uk-UA', {
                    timeZone: 'Europe/Kyiv',
                  })}{' '}
                  · {statusLabels[o.status]}
                </p>
                <p>
                  {o.customerPhone} · {o.city}
                </p>
                <button
                  className={css.button}
                  disabled={busy}
                  onClick={() => void open(o.id)}
                >
                  Відкрити замовлення
                </button>
              </li>
            ))}
          </ul>
          {data && data.total > 20 && (
            <div className={css.actions}>
              <button
                className={css.button}
                disabled={busy || page === 1}
                onClick={() => setPage(page - 1)}
              >
                Назад
              </button>
              <span>
                {page} / {Math.ceil(data.total / 20)}
              </span>
              <button
                className={css.button}
                disabled={busy || page * 20 >= data.total}
                onClick={() => setPage(page + 1)}
              >
                Далі
              </button>
            </div>
          )}
        </section>
        <section className={css.panel}>
          <h2>
            {selected
              ? 'Замовлення №' + selected.id.slice(0, 8)
              : 'Картка замовлення'}
          </h2>
          {!selected ? (
            <p className={css.muted}>Виберіть замовлення зі списку.</p>
          ) : (
            <>
              <p>{selected.customerName}</p>
              <p>
                <a href={'tel:' + selected.customerPhone}>
                  {selected.customerPhone}
                </a>{' '}
                ·{' '}
                <a href={'mailto:' + selected.customerEmail}>
                  {selected.customerEmail}
                </a>
              </p>
              <p className={css.muted}>
                Доставка: {deliveryLabel(selected.deliveryMethod)}
              </p>
              <table className={css.orderItems}>
                <caption>Товари замовлення</caption>
                <thead>
                  <tr>
                    <th>Товар</th>
                    <th>К-ть</th>
                    <th>Сума</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.items.map(i => (
                    <tr key={i.productId}>
                      <td>
                        {i.name}
                        <br />
                        <span className={css.muted}>{i.sku}</span>
                      </td>
                      <td>{i.quantity}</td>
                      <td>{money(Number(i.price) * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p>
                <strong>Разом: {money(selected.total)}</strong>
              </p>
              <form className={css.form} onSubmit={submit}>
                <fieldset disabled={busy || !!terminal}>
                  <label>
                    Статус
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as OrderStatus)}
                    >
                      {[selected.status, ...transitions[selected.status]].map(
                        s => (
                          <option key={s} value={s}>
                            {statusLabels[s]}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  <label>
                    Місто
                    <input
                      required
                      maxLength={120}
                      value={city}
                      onChange={e => setCity(e.target.value)}
                    />
                  </label>
                  <label>
                    Адреса / відділення
                    <input
                      required
                      maxLength={300}
                      value={address}
                      onChange={e => setAddress(e.target.value)}
                    />
                  </label>
                  <label>
                    Примітка адміністратора / номер накладної
                    <textarea
                      maxLength={2000}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </label>
                  <p className={css.muted}>
                    Статус «Оплачено» встановлюйте після перевірки надходження
                    коштів. Зміна статусу не проводить платіж.
                  </p>
                  <button className={css.button + ' ' + css.primary}>
                    {busy ? 'Збереження…' : 'Зберегти замовлення'}
                  </button>
                </fieldset>
              </form>
              {terminal && (
                <p className={css.muted}>
                  Замовлення завершено. Редагування закрито.
                </p>
              )}
              <button
                className={css.button}
                disabled={busy}
                onClick={() => void open(selected.id)}
              >
                Оновити картку
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
