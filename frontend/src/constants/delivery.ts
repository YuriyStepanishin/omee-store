export const DELIVERY_CARRIERS = [
  { id: 'nova_poshta', name: 'Нова пошта', hint: 'Номер та адреса відділення' },
  {
    id: 'ukrposhta',
    name: 'Укрпошта',
    hint: 'Поштовий індекс та адреса відділення',
  },
  {
    id: 'meest',
    name: 'Meest Express',
    hint: 'Номер або адреса відділення Meest',
  },
] as const;
export type DeliveryCarrier = (typeof DELIVERY_CARRIERS)[number]['id'];
export type DeliveryType = 'branch' | 'courier' | 'locker';
export const PICKUP_POINT = {
  city: 'Хмельницький',
  address: 'Хмельницький, вул. Зарічанська, 13 (IQ центр), офіс 210',
} as const;
export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  branch: 'У відділенні',
  locker: 'У поштоматі',
  courier: 'Кур’єром',
};
