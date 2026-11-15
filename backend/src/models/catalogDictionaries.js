const legacyBrand = "(slug LIKE 'import-%' OR slug LIKE 'brand-%')";
const notFound = () => Object.assign(new Error('Запис довідника не знайдено.'), { status: 404 });
function tableFor(kind) { if (kind === 'brands') return 'brands'; if (kind === 'categories') return 'categories'; throw new Error('Unknown dictionary'); }
export function catalogDictionaries(pool) {
 return {
  async list(kind, admin = true) {
   const table = tableFor(kind);
   const conditions = kind === 'categories' ? ['NOT ' + legacyBrand] : [];
   if (!admin) conditions.unshift('is_active');
   return (await pool.query('SELECT id,name,slug,image,is_active AS "isActive" FROM ' + table + (conditions.length ? ' WHERE ' + conditions.join(' AND ') : '') + ' ORDER BY name')).rows;
  },
  async save(kind, data, id) {
   const table = tableFor(kind);
   if (kind === 'categories' && /^(import|brand)-/.test(data.slug)) throw Object.assign(new Error('Цей префікс зарезервовано для архівних записів брендів.'), {status:400});
   const values = [data.name, data.slug, data.image || null, data.isActive];
   const scope = kind === 'categories' ? ' AND NOT ' + legacyBrand : '';
   const sql = id ? 'UPDATE ' + table + ' SET name=$1,slug=$2,image=$3,is_active=$4 WHERE id=$5' + scope + ' RETURNING id' : 'INSERT INTO ' + table + '(name,slug,image,is_active) VALUES($1,$2,$3,$4) RETURNING id';
   if (id) values.push(id);
   const {rows} = await pool.query(sql, values);
   if (!rows[0]) throw notFound();
   return rows[0];
  },
  async archive(kind, id) {
   const table = tableFor(kind);
   const scope = kind === 'categories' ? ' AND NOT ' + legacyBrand : '';
   const result = await pool.query('UPDATE ' + table + ' SET is_active=false WHERE id=$1' + scope + ' RETURNING id', [id]);
   if (!result.rowCount) throw notFound();
  },
 };
}
