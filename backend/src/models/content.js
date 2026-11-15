const infoDefault = {
  heading: 'omee store',
  description:
    'інтернет-магазин професійної косметики для волосся, де якісний догляд стає частиною вашого щоденного життя.\n\nМи віримо, що красиве волосся починається з правильно підібраного догляду. Саме тому пропонуємо засоби для очищення, зволоження, живлення, відновлення та захисту волосся, допомагаючи знайти рішення для різних типів і потреб.\n\nНаша мета — зробити професійний догляд доступним і зрозумілим, щоб ви могли насолоджуватися відчуттям доглянутого, здорового на вигляд волосся щодня.\n\nomee store — турбота про ваше волосся. Впевненість у кожному дотику.',
  points: [],
  phone: '',
  email: '',
  instagram: '',
  address: '',
  announcement: '',
};
const siteInfo = value => {
  const info = value || infoDefault;
  return ['Kateryna Studio', 'Kateryna Studio Store'].includes(info.heading)
    ? { ...info, heading: infoDefault.heading }
    : info;
};
const missing = () =>
  Object.assign(new Error('Запис не знайдено.'), { status: 404 });
export function contentRepository(pool) {
  return {
    async publicInfo() {
      try {
        const result=await pool.query("SELECT value FROM site_settings WHERE key='info'");
        return siteInfo(result.rows[0]?.value);
      } catch(error) {
        if(error.code==='42P01')return infoDefault;
        throw error;
      }
    },
    async publicContent() {
      try {
        const [settings, media, banners] = await Promise.all([
          pool.query("SELECT value FROM site_settings WHERE key='info'"),
          pool.query(
            "SELECT id,title,type,url,cover,to_jsonb(site_media)->'source' AS source FROM site_media WHERE is_active ORDER BY sort_order,created_at"
          ),
          pool.query(
            'SELECT id,title,image_url AS "imageUrl",link FROM banners WHERE is_active ORDER BY id'
          ),
        ]);
        return {
          info: siteInfo(settings.rows[0]?.value),
          media: media.rows,
          banners: banners.rows,
        };
      } catch (error) {
        if (error.code === '42P01')
          return { info: infoDefault, media: [], banners: [] };
        throw error;
      }
    },
    async adminContent() {
      const [settings, media, banners, promos] = await Promise.all([
        pool.query("SELECT value FROM site_settings WHERE key='info'"),
        pool.query(
          'SELECT id,title,type,url,cover,is_active AS "isActive",sort_order AS "sortOrder" FROM site_media ORDER BY sort_order,created_at'
        ),
        pool.query(
          'SELECT id,title,image_url AS "imageUrl",link,is_active AS "isActive" FROM banners ORDER BY id'
        ),
        pool.query(
          'SELECT id,code,discount,is_active AS "isActive",expires_at AS "expiresAt" FROM promo_codes ORDER BY code'
        ),
      ]);
      return {
        info: siteInfo(settings.rows[0]?.value),
        media: media.rows,
        banners: banners.rows,
        promos: promos.rows.map(p => ({ ...p, discount: Number(p.discount) })),
      };
    },
    async saveInfo(data) {
      await pool.query(
        "INSERT INTO site_settings(key,value) VALUES('info',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
        [JSON.stringify(data)]
      );
    },
    async saveMedia(data, id) {
      const values = [
        data.title,
        data.type,
        data.url,
        data.cover,
        data.isActive,
        data.sortOrder,
      ];
      if (id) values.push(id);
      const { rows } = await pool.query(
        id
          ? 'UPDATE site_media SET title=$1,type=$2,url=$3,cover=$4,is_active=$5,sort_order=$6 WHERE id=$7 RETURNING id'
          : 'INSERT INTO site_media(title,type,url,cover,is_active,sort_order) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
        values
      );
      if (!rows[0]) throw missing();
      return rows[0];
    },
    async saveBanner(data, id) {
      const values = [data.title, data.imageUrl, data.link, data.isActive];
      if (id) values.push(id);
      const { rows } = await pool.query(
        id
          ? 'UPDATE banners SET title=$1,image_url=$2,link=$3,is_active=$4 WHERE id=$5 RETURNING id'
          : 'INSERT INTO banners(title,image_url,link,is_active) VALUES($1,$2,$3,$4) RETURNING id',
        values
      );
      if (!rows[0]) throw missing();
      return rows[0];
    },
    async savePromo(data, id) {
      const values = [data.code, data.discount, data.isActive, data.expiresAt];
      if (id) values.push(id);
      const { rows } = await pool.query(
        id
          ? 'UPDATE promo_codes SET code=$1,discount=$2,is_active=$3,expires_at=$4 WHERE id=$5 RETURNING id'
          : 'INSERT INTO promo_codes(code,discount,is_active,expires_at) VALUES($1,$2,$3,$4) RETURNING id',
        values
      );
      if (!rows[0]) throw missing();
      return rows[0];
    },
  };
}
