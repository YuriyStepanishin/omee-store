import { DELIVERY_CARRIERS } from './delivery';

export const statusLabels = {
  NEW: 'Нове',
  PROCESSING: 'В обробці',
  PAID: 'В обробці (старий статус)',
  PACKED: 'Зібрано',
  SHIPPED: 'Передано перевізнику',
  READY_FOR_PICKUP: 'Готове до самовивозу',
  DELIVERED: 'Отримано',
  CANCELED: 'Скасовано',
} as const;
export type OrderStatus = keyof typeof statusLabels;

export const paymentStatusLabels = {
  UNCONFIRMED: 'Не підтверджено',
  PAID: 'Оплачено',
} as const;
export type PaymentStatus = keyof typeof paymentStatusLabels;

export const paymentMethodLabels = {
  on_confirmation: 'Уточнюється після оформлення',
  on_receipt: 'При отриманні',
  bank_transfer: 'Переказ за реквізитами',
} as const;
export type PaymentMethod = keyof typeof paymentMethodLabels;

export function paymentMethodLabel(method: string) {
  return paymentMethodLabels[method as PaymentMethod] ?? 'Уточнюється';
}

export function orderStatusLabel(status: OrderStatus, deliveryMethod: string) {
  if (status === 'PAID') return statusLabels.PROCESSING;
  return status === 'DELIVERED' && deliveryMethod === 'pickup' ? 'Видано' : statusLabels[status];
}

export function deliveryLabel(method: string) {
  if (method === 'pickup') return 'Самовивіз';
  const [carrier, kind] = method.split(':');
  const name = DELIVERY_CARRIERS.find(option => option.id === carrier)?.name;
  const kinds: Record<string, string> = { branch: 'відділення', locker: 'поштомат', courier: 'кур’єр' };
  return name ? [name, kinds[kind]].filter(Boolean).join(' · ') : 'Уточнюється';
}

export function trackingPage(method: string) {
  const links: Record<string, string> = {
    nova_poshta: 'https://tracking.novaposhta.ua/',
    ukrposhta: 'https://track.ukrposhta.ua/',
    meest: 'https://ua.meest.com/parcel-track',
  };
  return links[method.split(':')[0]];
}
