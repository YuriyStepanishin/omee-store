'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getOrders,
  getOrder,
  updateOrder,
  deleteOrder,
  orderTransitions,
  type OrderDetail,
} from '@/services/admin';
import {
  statusLabels, deliveryLabel, orderStatusLabel, trackingPage,
  paymentMethodLabel, paymentMethodLabels, paymentStatusLabels,
  type OrderStatus, type PaymentMethod, type PaymentStatus,
} from '@/constants/order';
import css from '../Admin.module.css';
import EditPanel from '../EditPanel';
const money = (n: string | number) =>
  Number(n).toLocaleString('uk-UA', { style: 'currency', currency: 'UAH' });
const deletableStatuses: ReadonlySet<OrderStatus> = new Set(['NEW', 'PROCESSING', 'PACKED', 'CANCELED']);
export default function Orders() {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [status, setStatus] = useState<OrderStatus>('NEW');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('UNCONFIRMED');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [tracking, setTracking] = useState('');
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
    setPaymentStatus(order.paymentStatus ?? 'UNCONFIRMED');
    setPaymentMethod(Object.hasOwn(paymentMethodLabels, order.paymentMethod) ? order.paymentMethod as PaymentMethod : '');
    setTracking(order.trackingNumber ?? '');
    setComment(order.comment);
    setCity(order.city);
    setAddress(order.address);
  }
  async function open(id: string) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setFailed(false);
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
  async function refreshOrders() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['admin', 'orders'] }),
      client.invalidateQueries({ queryKey: ['admin', 'overview'] }),
      client.invalidateQueries({ queryKey: ['admin', 'customers'] }),
      client.invalidateQueries({ queryKey: ['my-orders'] }),
      client.invalidateQueries({ queryKey: ['loyalty'] }),
      client.invalidateQueries({ queryKey: ['admin', 'products'] }),
      client.invalidateQueries({ queryKey: ['catalog'] }),
      client.invalidateQueries({ queryKey: ['cart-products'] }),
    ]);
  }

  const canDelete = selected && deletableStatuses.has(selected.status) &&
    selected.paymentStatus === 'UNCONFIRMED' && !selected.trackingNumber;

  async function remove() {
    if (!selected || !canDelete || busy) return;
    const inventoryNotice = selected.status === 'CANCELED' ? '' : ' Товари повернуться в залишки.';
    if (!window.confirm(`Видалити замовлення №${selected.id.slice(0, 8)} з бази даних назавжди?${inventoryNotice}`)) return;
    setBusy(true);
    setFailed(false);
    setMessage('');
    try {
      await deleteOrder(selected.id, selected.updatedAt);
      setSelected(null);
      if (page > 1 && data?.items.length === 1 && data.items[0].id === selected.id) setPage(page - 1);
      await refreshOrders();
      setMessage('Замовлення видалено з Бази Даних.');
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : 'Не вдалося видалити замовлення.');
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
        expectedUpdatedAt: selected.updatedAt,
        paymentStatus,
        paymentMethod: paymentMethod || undefined,
        trackingNumber: trackingPage(selected.deliveryMethod) ? tracking.trim() || null : undefined,
        comment,
        city,
        address,
      });
      await refreshOrders();
      fill(await getOrder(selected.id));
      setMessage('Замовлення оновлено.');
    } catch (e) {
      setFailed(true);
      setMessage(e instanceof Error ? e.message : 'Не вдалося зберегти.');
    } finally {
      setBusy(false);
    }
  }
  const delivered = selected?.status === 'DELIVERED';
  const canceled = selected?.status === 'CANCELED';
  const fulfillmentLocked = delivered || canceled;
  const trackable = selected && trackingPage(selected.deliveryMethod);
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
              {Object.entries(statusLabels).filter(([key]) => key !== 'PAID').map(([key, label]) => (
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
                  · {orderStatusLabel(o.status, o.deliveryMethod)} · Оплата: {paymentStatusLabels[o.paymentStatus]}
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
        <EditPanel
          title={selected ? 'Замовлення №' + selected.id.slice(0, 8) : 'Картка замовлення'}
          editing={Boolean(selected)}
          busy={busy}
          message={message}
          failed={failed}
          onDismiss={() => { setSelected(null); setMessage(''); }}
        >
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
                <fieldset className={css.orderSection} disabled={busy || fulfillmentLocked}>
                  <legend>Замовлення та отримання</legend>
                  <label>
                    Статус
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as OrderStatus)}
                    >
                      {[selected.status, ...orderTransitions(selected.status, selected.deliveryMethod)].map(
                        s => (
                          <option key={s} value={s}>
                            {orderStatusLabel(s, selected.deliveryMethod)}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                  {trackable && (
                    <label>
                      Номер відправлення (ТТН)
                      <input
                        maxLength={40}
                        pattern="[A-Za-z0-9][A-Za-z0-9\-]{5,39}"
                        required={status === 'SHIPPED' && selected.status !== 'SHIPPED'}
                        value={tracking}
                        onChange={e => setTracking(e.target.value)}
                      />
                    </label>
                  )}
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
                    Примітка адміністратора
                    <textarea
                      maxLength={2000}
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </label>
                </fieldset>
                <fieldset className={css.orderSection} disabled={busy || canceled}>
                  <legend>Оплата</legend>
                  {delivered ? (
                    <p>Спосіб оплати — {paymentMethodLabel(selected.paymentMethod)}</p>
                  ) : (
                    <label>
                      Спосіб оплати
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod | '')}>
                        {!paymentMethod && <option value="">Уточнюється</option>}
                        {Object.entries(paymentMethodLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label>
                    Стан оплати
                    <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatus)}>
                      {Object.entries(paymentStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <p className={css.muted}>Позначайте оплату після перевірки надходження коштів.</p>
                </fieldset>
                {!canceled && (
                  <button className={css.button + ' ' + css.primary} disabled={busy}>
                    {busy ? 'Збереження…' : 'Зберегти замовлення'}
                  </button>
                )}
              </form>
              <div className={css.actions}>
                <button type="button" className={css.button} disabled={busy} onClick={() => void open(selected.id)}>
                  Оновити картку
                </button>
                {canDelete && (
                  <button type="button" className={`${css.button} ${css.danger}`} disabled={busy} onClick={() => void remove()}>
                    Видалити з Бази Даних
                  </button>
                )}
              </div>
            </>
          )}
        </EditPanel>
      </div>
    </>
  );
}
