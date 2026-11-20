import { getPool, closePool } from '../config/db.js';

const key = process.env.NOVA_POSHTA_API_KEY;
if (!key || !process.env.DATABASE_URL) {
  console.error('NOVA_POSHTA_API_KEY and DATABASE_URL must be configured');
  process.exit(1);
}
const pool = getPool();
const endpoint = 'https://api.novaposhta.ua/v2.0/json/';
const PAGE_SIZE = 500;
const request = async (calledMethod, methodProperties) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, modelName: 'Address', calledMethod, methodProperties }),
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error('Nova Poshta HTTP ' + response.status);
      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error('Nova Poshta API rejected ' + calledMethod + ': ' + (result.errors || []).join('; '));
      }
      return result.data;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1500));
    }
  }
};
const batches = async (rows, sql, map) => {
  for (const row of rows) await pool.query(sql, map(row));
};
let runId;
let citiesCount = 0;
let pointsCount = 0;
try {
  const started = await pool.query("INSERT INTO nova_poshta_sync_runs(status) VALUES ('running') RETURNING id");
  runId = started.rows[0].id;
  for (let page = 1; page <= 1000; page++) {
    const cities = await request('getCities', { Page: String(page), Limit: String(PAGE_SIZE) });
    if (!cities.length) break;
    await batches(cities.filter(city => city.Ref && city.Description),
      `INSERT INTO nova_poshta_cities(ref,description,area_description,settlement_type,updated_at)
       VALUES($1,$2,$3,$4,now()) ON CONFLICT(ref) DO UPDATE SET
       description=EXCLUDED.description,area_description=EXCLUDED.area_description,
       settlement_type=EXCLUDED.settlement_type,updated_at=now()`,
      city => [city.Ref, city.Description, city.AreaDescription || null, city.SettlementTypeDescription || null]);
    citiesCount += cities.length;
    if (cities.length < PAGE_SIZE) break;
    if (page === 1000) throw new Error('Cities pagination exceeded safety limit');
  }
  // Warehouses API supports global pagination. Ref is stable; never delete rows on partial failure.
  for (let page = 1; page <= 1000; page++) {
    const points = await request('getWarehouses', { Page: String(page), Limit: String(PAGE_SIZE) });
    if (!points.length) break;
    const valid = points.filter(point => point.Ref && point.CityRef && point.Description);
    await batches(valid,
      `INSERT INTO nova_poshta_points(ref,city_ref,description,number,category,address,status,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(ref) DO UPDATE SET
       city_ref=EXCLUDED.city_ref,description=EXCLUDED.description,number=EXCLUDED.number,
       category=EXCLUDED.category,address=EXCLUDED.address,status=EXCLUDED.status,updated_at=now()`,
      point => [point.Ref,point.CityRef,point.Description,point.Number || null,
        point.CategoryOfWarehouse === 'Postomat' || /поштомат/i.test(point.Description) ? 'locker' : 'branch',
        point.ShortAddress || null,point.WarehouseStatus || null]);
    pointsCount += valid.length;
    if (points.length < PAGE_SIZE) break;
    if (page === 1000) throw new Error('Points pagination exceeded safety limit');
  }
  if (!citiesCount || !pointsCount) throw new Error('Empty directory response; refusing to mark sync successful');
  await pool.query("UPDATE nova_poshta_sync_runs SET finished_at=now(),status='success',cities_count=$2,points_count=$3 WHERE id=$1",
    [runId,citiesCount,pointsCount]);
  console.log(JSON.stringify({status:'success',citiesCount,pointsCount}));
} catch (error) {
  if (runId) await pool.query("UPDATE nova_poshta_sync_runs SET finished_at=now(),status='failed',cities_count=$2,points_count=$3,error_message=$4 WHERE id=$1",
    [runId,citiesCount,pointsCount,String(error.message).slice(0,500)]).catch(() => {});
  console.error('Nova Poshta directory sync failed:', error.message);
  process.exitCode = 1;
} finally {
  await closePool();
}
