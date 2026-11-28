'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import CartIcon from '@/components/CartIcon/CartIcon';
import DeliveryFields, {
  initialDeliverySelection,
} from '@/components/DeliveryFields/DeliveryFields';
import ProductPhoto from '@/components/ProductPhoto/ProductPhoto';
import { packagingLabel, withPackaging } from '@/components/ProductCard/productPackaging';
import { canAddProduct } from '@/components/ProductCard/ProductCard';
import { useCart } from '@/hooks/useCart';
import { checkoutOrder, fetchCatalog, fetchCartProducts } from '@/services/storeApi';
import {
  DELIVERY_CARRIERS,
  DELIVERY_TYPE_LABELS,
  PICKUP_POINT,
} from '@/constants/delivery';
import type { PaymentPayload, Product } from '@/types/store';
import css from './CartModal.module.css';

type Step = 'cart' | 'details' | 'confirm' | 'done';
type Mode = 'delivery' | 'pickup';

const defaults: PaymentPayload = {
  fullName: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  method: 'on_confirmation',
  deliveryCarrier: 'nova_poshta',
  deliveryType: 'branch',
};

const contactFields = [
  { key: 'fullName', label: 'Ім’я та прізвище', type: 'text', auto: 'name' },
  { key: 'phone', label: 'Телефон', type: 'tel', auto: 'tel' },
  { key: 'email', label: 'Email', type: 'email', auto: 'email' },
] as const;

const stepTitles: Record<Step, string> = {
  cart: 'Кошик',
  details: 'Дані та отримання',
  confirm: 'Підтвердження',
  done: 'Замовлення прийнято',
};

const money = (value: number) =>
  new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH' }).format(
    value
  );
const maxQty = (product: Product) => Math.min(99, product.stock || 99);

export default function CartModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const queryClient = useQueryClient();
  const { items, isOpen, closeCart, changeQty, removeFromCart, clearCart, syncing } =
    useCart();
  const {
    data: catalog,
    error: catalogError,
    refetch,
  } = useQuery({
    queryKey: ['catalog', 'public'],
    queryFn: fetchCatalog,
    enabled: isOpen,
  });
  const cartIds=items.map(item=>item.productId).sort();
  const cartProducts=useQuery({queryKey:['cart-products',cartIds],queryFn:()=>fetchCartProducts(cartIds),enabled:isOpen&&cartIds.length>0,staleTime:30_000});
  const [step, setStep] = useState<Step>('cart');
  const [mode, setMode] = useState<Mode>('delivery');
  const [form, setForm] = useState(defaults);
  const [deliverySelection, setDeliverySelection] = useState(initialDeliverySelection);
  const [busyState, setBusy] = useState(false);
  const busy=busyState||syncing;
  const [error, setError] = useState('');
  const [result, setResult] = useState('');

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (!isOpen) {
      if (element.open) element.close();
      return;
    }
    if (!element.open) element.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setStep('cart');
      setError('');
    }
  }, [isOpen]);

  const lines = items.map(item => ({
    ...item,
    product: (() => {
      const base = cartProducts.data?.products.find(p => p.id === item.productId || p.variants?.some(v => v.sourceProductId === item.productId));
      if (!base) return undefined;
      const variant = base.variants?.find(v => v.sourceProductId === item.productId);
      if (!variant) return base.variants?.length ? undefined : base;
      const chosen = withPackaging(base, variant);
      return {...chosen, title: variant.volume == null ? chosen.title : `${chosen.title} · ${packagingLabel(variant)}`};
    })(),
  }));
  const ready = Boolean(catalog) && (items.length===0 || Boolean(cartProducts.data));
  const orderable = lines.flatMap(line =>
    line.product &&
    canAddProduct(line.product) &&
    line.qty <= maxQty(line.product)
      ? [{ ...line, product: line.product }]
      : []
  );
  const canOrder =
    ready && lines.length > 0 && orderable.length === lines.length;
  const total = orderable.reduce(
    (sum, line) => sum + line.product.price * line.qty,
    0
  );
  const pickupAddress = catalog?.info.address || PICKUP_POINT.address;
  const carrier = DELIVERY_CARRIERS.find(c => c.id === form.deliveryCarrier);

  const receipt =
    mode === 'pickup'
      ? `Самовивіз: ${pickupAddress}`
      : `${carrier?.name ?? ''} · ${DELIVERY_TYPE_LABELS[form.deliveryType ?? 'branch']} · ${form.city}, ${form.address}`;

  function goToDetails() {
    if (canOrder) setStep('details');
  }

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canOrder) return;
    if (mode === 'delivery' && (!form.city.trim() || !form.address.trim())) {
      setError('Вкажіть населений пункт і адресу отримання.');
      return;
    }
    setError('');
    setStep('confirm');
  }

  async function confirmOrder() {
    if (lock.current || !canOrder) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const { city, point, manual } = deliverySelection;
      const directoryRefs =
        form.deliveryCarrier === 'nova_poshta' && !manual && city && point
          ? { deliveryCityRef: city.id, deliveryPointRef: point.id }
          : {};
      const payment =
        mode === 'pickup'
          ? {
              ...form,
              city: PICKUP_POINT.city,
              address: pickupAddress,
              deliveryCarrier: 'pickup' as const,
              deliveryType: 'pickup' as const,
            }
          : { ...form, ...directoryRefs };
      const order = await checkoutOrder({
        items: orderable.map(({ productId, qty }) => ({ productId, qty })),
        payment,
      });
      setResult(
        `${order.message} Номер: ${order.orderId}. Сума: ${money(order.amount)}`
      );
      clearCart();
      setStep('done');
      await queryClient.invalidateQueries({ queryKey: ['catalog'] });
      await queryClient.invalidateQueries({ queryKey: ['cart-products'] });
      await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Не вдалося надіслати замовлення.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className={css.dialog}
      aria-labelledby="cart-modal-title"
      onClose={closeCart}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          closeCart();
      }}
    >
      <button
        type="button"
        className={css.close}
        aria-label="Закрити кошик"
        onClick={closeCart}
      >
        <svg
          className={css.closeIcon}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m6 6 12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {isOpen && (
        <div className={css.body}>
          <h2 id="cart-modal-title" className={css.title}>
            <CartIcon className={css.titleIcon} />
            {stepTitles[step]}
          </h2>

          {(catalogError || cartProducts.error) && (
            <div role="alert" className={css.notice}>
              {(catalogError || cartProducts.error)?.message}{' '}
              <button
                type="button"
                className={css.link}
                onClick={() => {void refetch();void cartProducts.refetch();}}
              >
                Спробувати ще раз
              </button>
            </div>
          )}
          {!ready && !catalogError && !cartProducts.error && items.length > 0 && (
            <p role="status">Завантаження кошика…</p>
          )}

          {step === 'cart' && (
            <>
              {syncing&&<p role="status">Завантажуємо кошик акаунта…</p>}
              {!items.length && !syncing && (
                <p className={css.empty}>
                  Кошик порожній. Оберіть товари в каталозі.
                </p>
              )}
              <ul className={css.list}>
                {lines.map(line => {
                  const { product } = line;
                  const unavailable =
                    ready && (!product || !canAddProduct(product));
                  return (
                    <li key={line.productId} className={css.item}>
                      {product ? (
                        <ProductPhoto
                          className={css.photo}
                          image={product.image}
                          images={product.images}
                          alt={product.title}
                        />
                      ) : (
                        <div className={css.photo} aria-hidden="true" />
                      )}
                      <div className={css.info}>
                        <p className={css.meta}>
                          {product
                            ? [product.brand, product.category]
                                .filter(Boolean)
                                .join(' · ')
                            : ''}
                        </p>
                        <h3>{product?.title ?? 'Товар більше недоступний'}</h3>
                        {product && (
                          <p className={css.meta}>Артикул: {product.sku}</p>
                        )}
                        {product && !unavailable && (
                          <p>{money(product.price)} / шт.</p>
                        )}
                        {unavailable && (
                          <p className={css.warning} role="alert">
                            Недоступний для замовлення — видаліть його з кошика.
                          </p>
                        )}
                      </div>
                      <div className={css.side}>
                        {product && !unavailable && (
                          <div className={css.qty}>
                            <button
                              type="button"
                              aria-label={`Зменшити кількість: ${product.title}`}
                              disabled={busy || line.qty <= 1}
                              onClick={() =>
                                changeQty(line.productId, line.qty - 1)
                              }
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={maxQty(product)}
                              step={1}
                              value={line.qty}
                              disabled={busy}
                              aria-label={`Кількість: ${product.title}`}
                              onChange={event =>
                                changeQty(
                                  line.productId,
                                  Math.min(
                                    Number(event.target.value),
                                    maxQty(product)
                                  )
                                )
                              }
                            />
                            <button
                              type="button"
                              aria-label={`Збільшити кількість: ${product.title}`}
                              disabled={busy || line.qty >= maxQty(product)}
                              onClick={() =>
                                changeQty(line.productId, line.qty + 1)
                              }
                            >
                              +
                            </button>
                          </div>
                        )}
                        {product && !unavailable && (
                          <strong>{money(product.price * line.qty)}</strong>
                        )}
                        <button
                          type="button"
                          className={css.link}
                          disabled={busy}
                          onClick={() => removeFromCart(line.productId)}
                        >
                          Видалити
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {items.length > 0 && (
                <div className={css.footer}>
                  <p className={css.total}>Разом: {money(total)}</p>
                  <button
                    type="button"
                    className={css.primary}
                    disabled={!canOrder}
                    onClick={goToDetails}
                  >
                    Оформити замовлення
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'details' && (
            <form className={css.form} onSubmit={review}>
              <fieldset className={css.modes}>
                <legend>Спосіб отримання</legend>
                <label>
                  <input
                    type="radio"
                    name="receipt-mode"
                    checked={mode === 'delivery'}
                    onChange={() => setMode('delivery')}
                  />
                  Доставка
                </label>
                <label>
                  <input
                    type="radio"
                    name="receipt-mode"
                    checked={mode === 'pickup'}
                    onChange={() => setMode('pickup')}
                  />
                  Самовивіз
                </label>
              </fieldset>
              {mode === 'delivery' ? (
                <DeliveryFields
                  form={form}
                  onChange={setForm}
                  selection={deliverySelection}
                  onSelectionChange={setDeliverySelection}
                  disabled={busy}
                />
              ) : (
                <div className={css.pickup}>
                  <strong>KATYA MUSIYCHUK STUDIO</strong>
                  <p>{pickupAddress}</p>
                  <p>
                    Після підтвердження замовлення ми повідомимо, коли його
                    можна забрати.
                  </p>
                </div>
              )}
              {contactFields.map(field => (
                <label key={field.key} className={css.field}>
                  {field.label}
                  <input
                    type={field.type}
                    autoComplete={field.auto}
                    value={form[field.key]}
                    maxLength={120}
                    required
                    onChange={event =>
                      setForm({ ...form, [field.key]: event.target.value })
                    }
                  />
                </label>
              ))}
              {error && <p className={css.warning} role="alert">{error}</p>}
              <div className={css.actions}>
                <button
                  type="button"
                  className={css.secondary}
                  onClick={() => setStep('cart')}
                >
                  ← До кошика
                </button>
                <button type="submit" className={css.primary} disabled={busy || !canOrder}>
                  Перевірити замовлення
                </button>
              </div>
            </form>
          )}

          {step === 'confirm' && (
            <>
              <ul className={css.summary}>
                {orderable.map(line => (
                  <li key={line.productId}>
                    <span>
                      {line.product.title} × {line.qty}
                    </span>
                    <strong>{money(line.product.price * line.qty)}</strong>
                  </li>
                ))}
              </ul>
              <dl className={css.review}>
                <dt>Отримання</dt>
                <dd>{receipt}</dd>
                <dt>Отримувач</dt>
                <dd>
                  {form.fullName}, {form.phone}, {form.email}
                </dd>
                <dt>Оплата</dt>
                <dd>
                  Після підтвердження замовлення. Онлайн-оплата ще не
                  підключена.
                </dd>
              </dl>
              <p className={css.total}>Разом: {money(total)}</p>
              {error && (
                <p role="alert" className={css.warning}>
                  {error}
                </p>
              )}
              <div className={css.actions}>
                <button
                  type="button"
                  className={css.secondary}
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    setStep('details');
                  }}
                >
                  ← Змінити дані
                </button>
                <button
                  type="button"
                  className={css.primary}
                  disabled={busy || !canOrder}
                  onClick={() => void confirmOrder()}
                >
                  {busy
                    ? 'Надсилання…'
                    : `Підтвердити замовлення на ${money(total)}`}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <>
              <p role="status" aria-live="polite" className={css.done}>
                {result}
              </p>
              <div className={css.actions}>
                <button
                  type="button"
                  className={css.primary}
                  onClick={closeCart}
                >
                  Закрити
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
