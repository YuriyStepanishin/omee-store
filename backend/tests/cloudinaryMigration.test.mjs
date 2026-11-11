import test from 'node:test';
import assert from 'node:assert/strict';
import {
  externalImage,
  transferProductImages,
} from '../src/services/transferProductImages.js';
const source = 'https://cotril.it/photo.png';
function fixture({ receipt, fail = false } = {}) {
  const calls = [];
  const client = {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.includes('pg_try_advisory')) return { rows: [{ locked: true }] };
      if (sql.startsWith('SELECT id,image_url'))
        return {
          rows: [
            { id: 'one', image_url: source },
            { id: 'two', image_url: source },
          ],
        };
      if (sql.startsWith('SELECT image_url,public_id'))
        return { rows: receipt ? [receipt] : [] };
      return { rows: [], rowCount: 2 };
    },
    release() {
      calls.push({ sql: 'RELEASE' });
    },
  };
  let uploads = 0;
  const cloudinary = {
    uploader: {
      async upload() {
        uploads++;
        if (fail) throw Object.assign(Error('bad image'), { http_code: 400 });
        return {
          secure_url: 'https://res.cloudinary.com/store/image/upload/test.png',
          public_id: 'test',
        };
      },
    },
  };
  return {
    pool: { connect: async () => client },
    client,
    cloudinary,
    calls,
    uploads: () => uploads,
  };
}
test('source validation skips migrated assets and rejects unsupported schemes and hosts', () => {
  assert.equal(externalImage(source), true);
  assert.equal(
    externalImage('https://res.cloudinary.com/store/test.png'),
    false
  );
  for (const value of [
    'http://cotril.it/photo',
    'https://localhost/image',
    'https://cotril.it.evil.example/image',
  ])
    assert.throws(() => externalImage(value));
});
test('all collected brand image hosts are supported without allowing lookalike hosts', () => {
  for (const host of ['image.lullaby.ua', 'cdn.shopify.com', 'www.redken.com', 'raywell.shop', 'e-c.storage.googleapis.com']) {
    assert.equal(externalImage(`https://${host}/photo.jpg`), true);
    assert.throws(() => externalImage(`https://${host}.evil.example/photo.jpg`));
  }
});
test('duplicate source is uploaded once; receipt precedes guarded replacement', async () => {
  const f = fixture();
  const result = await transferProductImages(f.pool, f.cloudinary, {
    log: () => {},
  });
  assert.equal(f.uploads(), 1);
  assert.equal(result.updated, 2);
  const receipt = f.calls.findIndex(c =>
    c.sql.startsWith('INSERT INTO cloudinary_imports')
  );
  const update = f.calls.findIndex(c =>
    c.sql.startsWith('UPDATE product_images')
  );
  assert.ok(receipt < update);
  assert.deepEqual(f.calls[update].args[1], ['one', 'two']);
  assert.equal(f.calls[update].args[2], source);
  assert.equal(f.calls.at(-1).sql, 'RELEASE');
});
test('saved receipt avoids uploading again after interruption', async () => {
  const f = fixture({
    receipt: {
      image_url: 'https://res.cloudinary.com/store/saved.png',
      public_id: 'saved',
    },
  });
  const r = await transferProductImages(f.pool, f.cloudinary, {
    log: () => {},
  });
  assert.equal(f.uploads(), 0);
  assert.equal(r.reused, 1);
  assert.equal(r.updated, 2);
});
test('upload workers use pool queries while the dedicated client keeps its lock', async () => {
  const f = fixture();
  let workerQueries = 0;
  f.pool.query = async (...args) => { workerQueries++; return f.client.query(...args); };
  await transferProductImages(f.pool, f.cloudinary, { log: () => {} });
  assert.equal(workerQueries, 3);
  assert.ok(f.calls.some(c => c.sql.includes('pg_advisory_unlock')));
  assert.equal(f.calls.at(-1).sql, 'RELEASE');
});
test('failed upload leaves original database URLs untouched; preview never uploads', async () => {
  const f = fixture({ fail: true });
  const r = await transferProductImages(f.pool, f.cloudinary, {
    log: () => {},
  });
  assert.equal(r.failed, 2);
  assert.ok(!f.calls.some(c => c.sql.startsWith('UPDATE product_images')));
  const p = fixture();
  await transferProductImages(p.pool, p.cloudinary, {
    preview: true,
    log: () => {},
  });
  assert.equal(p.uploads(), 0);
  assert.ok(
    !p.calls.some(c => c.sql.startsWith('INSERT') || c.sql.startsWith('UPDATE'))
  );
});
function parallelFixture({ failAuth = false } = {}) {
  let active = 0, peak = 0, uploads = 0;
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes('pg_try_advisory')) return { rows: [{ locked: true }] };
      if (sql.startsWith('SELECT id,image_url')) return { rows: Array.from({ length: 5 }, (_, i) => ({ id: String(i), image_url: `https://cotril.it/${i}.png` })) };
      return { rows: [], rowCount: 1 };
    }, release() { calls.push('RELEASE'); },
  };
  return { calls, pool: { connect: async () => client }, uploads: () => uploads, peak: () => peak,
    cloudinary: { uploader: { async upload() {
      const index = ++uploads; active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5)); active--;
      if (failAuth) throw Object.assign(Error('Unauthorized'), { http_code: 401 });
      return { secure_url: `https://res.cloudinary.com/store/${index}.png`, public_id: String(index) };
    } } },
  };
}
test('parallel migration bounds uploads, reports remaining work and saves each receipt', async () => {
  const f = parallelFixture();
  const result = await transferProductImages(f.pool, f.cloudinary, { concurrency: 2, limit: 3, log: () => {} });
  assert.equal(f.uploads(), 3); assert.equal(f.peak(), 2); assert.equal(result.pending, 2);
  assert.equal(f.calls.filter(sql => sql.startsWith('INSERT INTO cloudinary_imports')).length, 3);
  assert.equal(f.calls.at(-1), 'RELEASE');
});
test('authentication failure stops parallel workers before scheduling more images', async () => {
  const f = parallelFixture({ failAuth: true });
  await assert.rejects(transferProductImages(f.pool, f.cloudinary, { concurrency: 2, log: () => {} }));
  assert.ok(f.uploads() <= 2); assert.equal(f.calls.at(-1), 'RELEASE');
  assert.ok(!f.calls.some(sql => sql.startsWith('UPDATE product_images')));
});
