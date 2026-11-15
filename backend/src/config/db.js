import pg from 'pg';
const poolKey=Symbol.for('omee.postgres.pools');
const pools=globalThis[poolKey]??=new Map();
export function secureConnectionString(connectionString){
 const url=new URL(connectionString);
 if(url.searchParams.get('uselibpqcompat')!=='true'&&['prefer','require','verify-ca'].includes(url.searchParams.get('sslmode'))){
  url.searchParams.set('sslmode','verify-full');
 }
 return url.toString();
}
export function getPool(connectionString=process.env.DATABASE_URL) {
 if(!connectionString) throw new Error('DATABASE_URL is not configured');
 if(!pools.has(connectionString)){
  const pool=new pg.Pool({connectionString:secureConnectionString(connectionString),max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
  pool.on('error',error=>console.error('PostgreSQL idle connection error:',error.code||'UNKNOWN'));
  pools.set(connectionString,pool);
 }
 return pools.get(connectionString);
}
export async function closePool(){const active=[...pools.values()];pools.clear();await Promise.all(active.map(pool=>pool.end()));}
