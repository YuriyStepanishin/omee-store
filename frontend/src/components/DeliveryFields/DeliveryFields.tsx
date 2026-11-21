import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DELIVERY_CARRIERS,
  DELIVERY_TYPE_LABELS,
  type DeliveryCarrier,
  type DeliveryType,
} from '@/constants/delivery';
import { http } from '@/services/http';
import type { PaymentPayload } from '@/types/store';
import css from './DeliveryFields.module.css';

type Option = { id: string; label: string; regionRef?: string };

export type DeliverySelection = {
  city: Option | null;
  manual: boolean;
  pointSearch: string;
};

export const initialDeliverySelection: DeliverySelection = {
  city: null,
  manual: false,
  pointSearch: '',
};

function useDebounced(value: string) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), 350);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

export default function DeliveryFields({
  form,
  onChange,
  selection,
  onSelectionChange,
  disabled,
}: {
  form: PaymentPayload;
  onChange: (value: PaymentPayload) => void;
  selection: DeliverySelection;
  onSelectionChange: (value: DeliverySelection) => void;
  disabled: boolean;
}) {
  const carrier = form.deliveryCarrier ?? 'nova_poshta';
  const type = form.deliveryType ?? 'branch';
  const { city, manual, pointSearch } = selection;
  const cityText = form.city.trim();
  const pointText = pointSearch.trim();
  const cityQuery = useDebounced(cityText);
  const pointQuery = useDebounced(pointText);
  const courier = type === 'courier';
  const pointLabel = type === 'locker' ? 'Поштомат' : 'Відділення';
  const carrierInfo = DELIVERY_CARRIERS.find(option => option.id === carrier);
  const status = useQuery({
    queryKey: ['delivery-status'],
    queryFn: async ({ signal }) =>
      (await http.get<Record<DeliveryCarrier, { configured: boolean }>>('/delivery/status', { signal })).data,
    retry: false,
    staleTime: 60_000,
  });
  const configured = status.data?.[carrier]?.configured === true;
  const lookup = configured && !manual && !courier;
  const searchCities = lookup && !city && cityText.length >= 2;
  const cities = useQuery({
    queryKey: ['delivery-cities', carrier, cityQuery],
    queryFn: async ({ signal }) =>
      (await http.get<Option[]>('/delivery/cities', { signal, params: { carrier, q: cityQuery } })).data,
    enabled: searchCities && cityText === cityQuery,
    retry: false,
    staleTime: 300_000,
  });
  const points = useQuery({
    queryKey: ['delivery-points', carrier, type, city?.id, city?.regionRef, pointQuery],
    queryFn: async ({ signal }) =>
      (await http.get<Option[]>('/delivery/points', {
        signal,
        params: { carrier, type, cityRef: city?.id, regionRef: city?.regionRef, q: pointQuery },
      })).data,
    enabled: lookup && Boolean(city) && pointText === pointQuery,
    retry: false,
    staleTime: 300_000,
  });

  const cityOptions = cityText === cityQuery ? cities.data ?? [] : [];
  const pointOptions = pointText === pointQuery ? points.data ?? [] : [];
  const selectedCityOption = city ? [city] : cityOptions;
  const showSavedPoint = form.address && !pointOptions.some(option => option.label.slice(0, 300) === form.address);

  let searchStatus = '';
  if (!courier && !manual) {
    if (status.isPending) {
      searchStatus = 'Перевіряємо доступність довідника…';
    } else if (!configured) {
      searchStatus = status.isError
        ? 'Не вдалося перевірити довідник. Вкажіть адресу вручну.'
        : 'Для цього перевізника доступне ручне введення адреси.';
    } else if (city) {
      if (pointText !== pointQuery || points.isFetching) {
        searchStatus = 'Шукаємо пункти отримання…';
      } else if (points.isError) {
        searchStatus = 'Не вдалося завантажити пункти отримання. Можна ввести адресу вручну.';
      } else if (points.isSuccess && !pointOptions.length) {
        searchStatus = 'Пунктів отримання не знайдено. Змініть пошук або введіть адресу вручну.';
      }
    } else if (searchCities) {
      if (cityText !== cityQuery || cities.isFetching) {
        searchStatus = 'Шукаємо населені пункти…';
      } else if (cities.isError) {
        searchStatus = 'Не вдалося завантажити населені пункти. Можна ввести адресу вручну.';
      } else if (cities.isSuccess && !cityOptions.length) {
        searchStatus = 'Населений пункт не знайдено. Уточніть назву або введіть адресу вручну.';
      }
    }
  }

  return (
    <fieldset className={css.fields} disabled={disabled}>
      <legend>Доставка</legend>

      <div className={css.row}>
        <label>
          Перевізник
          <select value={carrier} onChange={event => {
            const next = event.target.value as DeliveryCarrier;
            onSelectionChange(initialDeliverySelection);
            onChange({
              ...form,
              deliveryCarrier: next,
              deliveryType: next === 'ukrposhta' && type === 'locker' ? 'branch' : type,
              city: city ? city.label.split(',')[0] : form.city,
              address: '',
            });
          }}>
            {DELIVERY_CARRIERS.map(option => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </label>
        <label>
          Як отримати
          <select value={type} onChange={event => {
            onSelectionChange({ ...selection, pointSearch: '' });
            onChange({ ...form, deliveryType: event.target.value as DeliveryType, address: '' });
          }}>
            {Object.entries(DELIVERY_TYPE_LABELS)
              .filter(([key]) => carrier !== 'ukrposhta' || key !== 'locker')
              .map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </div>

      <label>
        Населений пункт
        <input
          value={form.city}
          required
          maxLength={120}
          autoComplete="address-level2"
          placeholder={lookup ? 'Введіть щонайменше 2 літери' : 'Місто або село'}
          onChange={event => {
            onSelectionChange({ ...selection, city: null, pointSearch: '' });
            onChange({ ...form, city: event.target.value, address: lookup ? '' : form.address });
          }}
        />
      </label>

      {lookup ? (
        <>
          <label>
            Населений пункт у довіднику
            <select required value={city?.id ?? ''} onChange={event => {
              const option = cityOptions.find(item => item.id === event.target.value);
              if (!option) return;
              onSelectionChange({ ...selection, city: option, pointSearch: '' });
              onChange({ ...form, city: option.label.slice(0, 120), address: '' });
            }}>
              <option value="" disabled>Оберіть населений пункт та область</option>
              {selectedCityOption.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>

          {city && (
            <div className={css.row}>
              <label>
                Пошук пункту отримання
                <input
                  value={pointSearch}
                  maxLength={120}
                  placeholder="Номер або вулиця"
                  onChange={event => {
                    onSelectionChange({ ...selection, pointSearch: event.target.value });
                    onChange({ ...form, address: '' });
                  }}
                />
              </label>
              <label>
                {pointLabel}
                <select required value={form.address} onChange={event => {
                  onChange({ ...form, address: event.target.value });
                }}>
                  <option value="">Оберіть зі списку</option>
                  {showSavedPoint && <option value={form.address}>{form.address}</option>}
                  {pointOptions.map(option => (
                    <option key={option.id} value={option.label.slice(0, 300)}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </>
      ) : (
        <label>
          {courier ? 'Адреса для кур’єра' : pointLabel}
          <input
            required
            maxLength={300}
            value={form.address}
            autoComplete={courier ? 'street-address' : 'off'}
            placeholder={courier ? 'Вулиця, будинок, квартира (за наявності)' : type === 'locker' ? 'Номер та адреса поштомата' : carrierInfo?.hint}
            onChange={event => {
              if (!courier && !configured && !manual) {
                onSelectionChange({ ...selection, manual: true });
              }
              onChange({ ...form, address: event.target.value });
            }}
          />
        </label>
      )}

      <div className={css.help}>
        <p role="status">{searchStatus || 'Вартість доставки уточнимо під час підтвердження замовлення.'}</p>
        {configured && !courier && (
          <button type="button" className={css.toggle} onClick={() => {
            onSelectionChange({ ...selection, manual: !manual, pointSearch: '' });
            if (manual) onChange({ ...form, address: '' });
          }}>
            {manual ? 'Обрати з довідника' : 'Ввести адресу вручну'}
          </button>
        )}
      </div>
    </fieldset>
  );
}
