import { setTimeout as delay } from 'node:timers/promises';

// Only address directories: these requests do not create shipments.
const fail = (message, status = 503) =>
  Object.assign(new Error(message), { status });
const list = value => (Array.isArray(value) ? value : value ? [value] : []);
const ua = value => (typeof value === 'string' ? value : value?.ua || '');
export function createDeliveryService({
  env = process.env,
  fetcher = fetch,
} = {}) {
  const cache = new Map();
  const novaPoshtaWarehouses = new Map();
  const pendingNovaPoshtaWarehouses = new Map();
  const novaPoshtaKey = env.NOVA_POSHTA_API_KEY?.trim();
  const configured = carrier =>
    carrier === 'meest' || Boolean(carrier === 'nova_poshta' ? novaPoshtaKey : env.UKRPOSHTA_BEARER);
  async function request(url, options = {}) {
    try {
      const response = await fetcher(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(10000),
      });
      if (response.status === 429) throw fail('Довідник тимчасово обмежив запити.', 429);
      if (!response.ok) throw new Error('upstream');
      return await response.json();
    } catch (error) {
      if (error.status === 429) throw error;
      throw fail(
        'Довідник перевізника тимчасово недоступний. Введіть адресу вручну.'
      );
    }
  }
  async function np(method, properties, signal) {
    const data = await request('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: novaPoshtaKey,
        modelName: 'Address',
        calledMethod: method,
        methodProperties: properties,
      }),
    });
    if (!data.success || !Array.isArray(data.data)) {
      if (list(data.errors).some(error => /too? many requests/i.test(String(error)))) {
        throw fail('Довідник Нової пошти тимчасово обмежив запити.', 429);
      }
      const codes = list(data.errorCodes).filter(code => /^\d{4,10}$/.test(String(code)));
      console.warn('Nova Poshta directory request failed:', method, properties.Page, codes.join(', ') || 'no error code');
      throw fail(
        'Довідник Нової пошти тимчасово недоступний. Введіть адресу вручну.'
      );
    }
    return { rows: data.data, total: Number(data.info?.totalCount) };
  }
  async function retryNovaPoshta(method, properties, signal) {
    for (const wait of [0, 700, 1500, 2600]) {
      if (wait) {
        try { await delay(wait, undefined, { signal }); }
        catch { break; }
      }
      try { return await np(method, properties, signal); }
      catch (error) { if (error.status !== 429) throw error; }
    }
    throw fail('Довідник Нової пошти тимчасово недоступний. Введіть адресу вручну.');
  }
  async function loadNovaPoshtaWarehouses(cityRef) {
    const signal = AbortSignal.timeout(10000);
    const points = new Map();
    const limit = 500;
    for (let page = 1; page <= 20; page++) {
      const { rows, total } = await retryNovaPoshta('getWarehouses', {
        CityRef: cityRef,
        FindByString: '',
        Limit: String(limit),
        Page: String(page),
        WarehouseStatus: 'Working',
      }, signal);
      for (const row of rows) {
        if (!row.Ref || !row.Description || row.WarehouseStatus === 'Closed') continue;
        points.set(row.Ref, {
          id: row.Ref,
          label: row.Description,
          number: String(row.Number ?? ''),
          locker: /postomat|locker/i.test(row.CategoryOfWarehouse ?? '') || /поштомат/i.test(row.Description),
        });
      }
      if (rows.length < limit || (total > 0 && page * limit >= total)) break;
    }
    const value = [...points.values()];
    if (novaPoshtaWarehouses.size >= 50) novaPoshtaWarehouses.delete(novaPoshtaWarehouses.keys().next().value);
    novaPoshtaWarehouses.set(cityRef, { until: Date.now() + 300000, points: value });
    return value;
  }
  function getNovaPoshtaWarehouses(cityRef) {
    const cached = novaPoshtaWarehouses.get(cityRef);
    if (cached?.until > Date.now()) return cached.points;
    if (!pendingNovaPoshtaWarehouses.has(cityRef)) {
      pendingNovaPoshtaWarehouses.set(cityRef, loadNovaPoshtaWarehouses(cityRef)
        .finally(() => pendingNovaPoshtaWarehouses.delete(cityRef)));
    }
    return pendingNovaPoshtaWarehouses.get(cityRef);
  }
  async function up(method, params) {
    const data = await request(
      'https://www.ukrposhta.ua/address-classifier-ws/' +
        method +
        '?' +
        new URLSearchParams(params),
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${env.UKRPOSHTA_BEARER}`,
        },
      }
    );
    if (!data.Entries || !Object.hasOwn(data.Entries, 'Entry'))
      throw fail('Укрпошта повернула некоректну відповідь довідника.');
    return list(data.Entries.Entry);
  }
  async function meest(city, type) {
    const data = await request(
      'https://publicapi.meest.com/branches?' +
        new URLSearchParams({
          city,
          lang: 'ua',
          viewdata: 'full',
          ...(type
            ? {
                type:
                  type === 'locker'
                    ? 'poshtomat'
                    : 'minibranch,mainbranch,cargobranch,internationalcargobranch',
              }
            : {}),
        })
    );
    if (Number(data.status) !== 1 || !Array.isArray(data.result))
      throw fail('Meest не надав довідник. Введіть адресу вручну.');
    return data.result;
  }
  return {
    status: () =>
      Object.fromEntries(
        ['nova_poshta', 'ukrposhta', 'meest'].map(carrier => [
          carrier,
          { configured: configured(carrier) },
        ])
      ),
    async lookup({
      carrier,
      kind,
      q = '',
      cityRef = '',
      regionRef = '',
      type = 'branch',
    }) {
      if (
        !['nova_poshta', 'ukrposhta', 'meest'].includes(carrier) ||
        !['cities', 'points'].includes(kind) ||
        !['branch', 'locker'].includes(type) ||
        (carrier === 'ukrposhta' && type === 'locker')
      )
        throw fail('Некоректні параметри доставки.', 400);
      for (const v of [q, cityRef, regionRef])
        if (typeof v !== 'string' || v.length > 120)
          throw fail('Некоректний пошуковий запит.', 400);
      if (!configured(carrier))
        throw fail(
          'Довідник цього перевізника ще не налаштований. Введіть адресу вручну.'
        );
      if (kind === 'cities' && q.trim().length < 2) return [];
      if (kind === 'points' && !cityRef)
        throw fail('Спочатку оберіть населений пункт.', 400);
      const key = JSON.stringify([carrier, kind, q, cityRef, regionRef, type]);
      const hit = cache.get(key);
      if (hit && hit.until > Date.now()) return hit.value;
      let value;
      if (carrier === 'nova_poshta') {
        const signal = AbortSignal.timeout(10000);
        if (kind === 'cities')
          value = (
            await retryNovaPoshta('getCities', { FindByString: q, Limit: '30', Page: '1' }, signal)
          ).rows.filter(r => r.Ref && r.Description).map(r => ({
            id: r.Ref,
            label: [
              r.Description,
              r.AreaDescription,
              r.SettlementTypeDescription,
            ]
              .filter(Boolean)
              .join(', '),
          }));
        else {
          const points = await getNovaPoshtaWarehouses(cityRef);
          const term = q.trim().toLocaleLowerCase('uk');
          const number = /^(?:№\s*)?(\d+)$/.exec(term)?.[1];
          value = points.filter(point => point.locker === (type === 'locker') && (
            !term || (number && point.number ? point.number === number : point.label.toLocaleLowerCase('uk').includes(term))
          )).map(({ id, label }) => ({ id, label }));
        }
      } else if (carrier === 'ukrposhta') {
        if (kind === 'cities')
          value = (
            await up('get_city_by_region_id_and_district_id_and_city_ua', {
              city_ua: q,
            })
          ).map(r => ({
            id: r.CITY_ID,
            regionRef: r.REGION_ID,
            label: [r.CITY_UA, r.REGION_UA, r.DISTRICT_UA]
              .filter(Boolean)
              .join(', '),
          }));
        else {
          if (!regionRef) throw fail('Повторно оберіть населений пункт.', 400);
          value = (
            await up('get_postoffices_by_city_id', {
              city_id: cityRef,
              region_id: regionRef,
            })
          )
            .filter(
              r => String(r.LOCK_CODE) === '0' && String(r.IS_SECURITY) !== '1'
            )
            .map(r => ({
              id: r.ID,
              label: [r.POSTINDEX, r.PO_SHORT, r.ADDRESS]
                .filter(Boolean)
                .join(', '),
            }));
        }
      } else {
        const rows = await meest(
          kind === 'cities' ? q : cityRef,
          kind === 'points' ? type : undefined
        );
        value =
          kind === 'cities'
            ? [
                ...new Map(
                  rows.map(r => [
                    r.city_id,
                    {
                      id: r.city_id,
                      label: [ua(r.city), ua(r.region), ua(r.district)]
                        .filter(Boolean)
                        .join(', '),
                    },
                  ])
                ).values(),
              ]
            : rows.map(r => {
                const number = r.num_showcase || r.num;
                const place = type === 'locker' ? 'Поштомат' : 'Відділення';
                return {
                  id: r.br_id || r.num,
                  label: [number ? `${place} №${number}` : place, ua(r.street), r.street_number]
                    .filter(Boolean)
                    .join(', '),
                };
              });
      }
      value = value
        .filter(r => r.id && r.label)
        .filter(
          r =>
            kind === 'cities' || carrier === 'nova_poshta' ||
            !q ||
            r.label.toLocaleLowerCase('uk').includes(q.toLocaleLowerCase('uk'))
        )
        .slice(0, 100)
        .map(r => ({ ...r, id: String(r.id) }));
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { until: Date.now() + 300000, value });
      return value;
    },
  };
}
