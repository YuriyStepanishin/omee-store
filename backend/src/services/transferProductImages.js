import { createHash } from 'node:crypto';
import { uploadImportedImage } from './importImageFallback.js';

export function externalImage(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password)
    throw Error('Потрібне HTTPS-посилання без облікових даних.');
  if (parsed.hostname === 'res.cloudinary.com') return false;
  if (
    ![
      'cotril.it',
      'www.cotril.it',
      'full-force.com.ua',
      'www.full-force.com.ua',
      'cdn.shopify.com',
      'braeusa.myshopify.com',
      'braehaircare.vteximg.com.br',
      'www.davroe.com',
      'e-c.storage.googleapis.com',
      'image.lullaby.ua',
      'celineprofessional.com',
      'www.redken.com',
      'beaver-professional.com.ua',
      'elgoncosmetic.com',
      'static.wixstatic.com',
      'nevitaly.com.ua',
      'organethic.com.ua',
      'lipss.care',
      'emmebi.com.ua',
      'hadat.com',
      'www.glynt.com',
      'yprjqvdneogmkieasyvo.supabase.co',
      'raywell.shop',
      'drsorbie.co.il',
      'raywell.com.ua',
    ].includes(parsed.hostname)
  )
    throw Error('Непідтримуваний сайт-джерело.');
  return true;
}

export async function transferProductImages(
  pool,
  cloudinary,
  { preview = false, log = console.log, concurrency = 1, limit = Infinity } = {}
) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 6)
    throw Error('Invalid image upload concurrency');
  if (!(limit === Infinity || (Number.isInteger(limit) && limit > 0)))
    throw Error('Invalid image upload limit');
  const client = await pool.connect();
  const summary = {
    uploaded: 0,
    reused: 0,
    updated: 0,
    failed: 0,
    skipped: 0,
    failedSources: [],
  };
  let locked = false;
  try {
    const lock = await client.query(
      'SELECT pg_try_advisory_lock(72619202) AS locked'
    );
    if (!lock.rows[0].locked)
      throw Error('Перенесення фото вже запущено в іншому терміналі.');
    locked = true;
    const { rows } = await client.query(
      'SELECT id,image_url FROM product_images ORDER BY product_id,sort_order,id'
    );
    const groups = new Map();
    for (const row of rows) {
      try {
        if (!externalImage(row.image_url)) {
          summary.skipped++;
          continue;
        }
        const ids = groups.get(row.image_url) || [];
        ids.push(row.id);
        groups.set(row.image_url, ids);
      } catch {
        summary.failed++;
        log('Пропущено непідтримуване посилання фото: ' + row.id);
      }
    }
    log(
      `Зовнішніх фото: ${[...groups.values()].reduce((n, ids) => n + ids.length, 0)}; унікальних файлів: ${groups.size}.`
    );
    if (preview) return { ...summary, pending: groups.size };
    // Require the receipt table before performing any uploads.
    await client.query('SELECT source_url FROM cloudinary_imports LIMIT 0');
    const jobs = [...groups].slice(0, limit);
    let next = 0, stopped;
    async function worker() {
     while (!stopped && next < jobs.length) {
      const index = ++next;
      const [source, ids] = jobs[index - 1];
      try {
        const receipt = await client.query(
          'SELECT image_url,public_id FROM cloudinary_imports WHERE source_url=$1',
          [source]
        );
        let target = receipt.rows[0];
        if (target) {
          summary.reused++;
        } else {
          const publicId =
            'omee/products/import-' +
            createHash('sha256').update(source).digest('hex');
          const result = await uploadImportedImage(cloudinary, source, {
            resource_type: 'image',
            asset_folder: 'omee/images',
            public_id: publicId,
            overwrite: false,
            unique_filename: false,
            timeout: 60000,
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
          });
          if (
            !result.secure_url?.startsWith('https://res.cloudinary.com/') ||
            !result.public_id
          )
            throw Error('Некоректна відповідь Cloudinary.');
          target = {
            image_url: result.secure_url,
            public_id: result.public_id,
          };
          await client.query(
            'INSERT INTO cloudinary_imports(source_url,image_url,public_id,asset_folder) VALUES($1,$2,$3,$4) ON CONFLICT(source_url) DO NOTHING',
            [
              source,
              target.image_url,
              target.public_id,
              result.asset_folder || null,
            ]
          );
          summary.uploaded++;
        }
        // Compare old URL to avoid replacing a photo edited while this job was running.
        const updated = await client.query(
          'UPDATE product_images SET image_url=$1 WHERE id=ANY($2::uuid[]) AND image_url=$3',
          [target.image_url, ids, source]
        );
        summary.updated += updated.rowCount;
        log(
          `[${index}/${groups.size}] Фото перенесено; оновлено посилань: ${updated.rowCount}.`
        );
      } catch (error) {
        summary.failed += ids.length;
        summary.failedSources.push(source);
        log(
          `[${index}/${groups.size}] Фото не перенесено; старе посилання збережене. Код: ${error.error?.code || error.code || error.http_code || 'TRANSFER_ERROR'}`
        );
        // Stop on network/auth/database failure instead of repeating it for every image.
        if (
          [
            'ENOTFOUND',
            'EAI_AGAIN',
            'ECONNREFUSED',
            'ETIMEDOUT',
            '28P01',
            '42P01',
            401,
            402,
            403,
            429,
          ].includes(error.error?.code || error.code || error.http_code)
        )
          stopped = error;
      }
     }
    }
    await Promise.all(Array.from({ length: concurrency }, worker));
    if (stopped) throw stopped;
    summary.pending = Math.max(0, groups.size - jobs.length);
    return summary;
  } finally {
    try {
      if (locked) await client.query('SELECT pg_advisory_unlock(72619202)');
    } finally {
      client.release();
    }
  }
}
