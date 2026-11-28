import test from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { adminOrders } from '../src/models/adminOrders.js';
import { adminArticles } from '../src/models/adminArticles.js';
import { contentRepository } from '../src/models/content.js';

test('journal publication controls update status without replacing saved content', async () => {
  const calls = [];
  const pool = { async query(sql, params) {
    calls.push({ sql, params });
    return { rows: params[0] === 'missing' ? [] : [{ id: params[0] }] };
  } };
  const articles = adminArticles(pool);
  const content = contentRepository(pool);
  await articles.setPublication('article', 'published');
  await content.setMediaPublication('video', false);
  await content.removeMedia('video');
  assert.match(calls[0].sql, /SET status=\$2, updated_at=now\(\)/);
  assert.match(calls[0].sql, /COALESCE\(published_at,now\(\)\)/);
  assert.deepEqual(calls[0].params, ['article', 'published']);
  assert.match(calls[1].sql, /SET is_active=\$2 WHERE id=\$1/);
  assert.deepEqual(calls[1].params, ['video', false]);
  assert.match(calls[2].sql, /DELETE FROM site_media WHERE id=\$1/);
  await assert.rejects(articles.setPublication('missing', 'draft'), { status: 404 });
  await assert.rejects(content.removeMedia('missing'), { status: 404 });
});
import { orderUpdateSchema, articleSchema } from '../src/validators/admin.js';
import { createApp } from '../src/app.js';
import { getPool, closePool } from '../src/config/db.js';
import { signSession } from '../src/services/tokens.js';
const id = '11111111-1111-4111-8111-111111111111';
const update = {
  status: 'CANCELED',
  expectedStatus: 'NEW',
  comment: '',
  city: 'Хмельницький',
  address: 'Відділення №1',
};
function stockDatabase(status = 'NEW', fail = false, fields = {}) {
  const calls = [];
  let returned = 0;
  let released = false;
  const client = {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT status')) return { rows: status ? [{ status, ...fields }] : [] };
      if (sql.startsWith('UPDATE products')) {
        returned++;
        if (fail) throw Error('stock failure');
      }
      if (sql.startsWith('UPDATE orders')) status = args[1];
      if (sql.startsWith('DELETE FROM orders')) status = null;
      return { rows: [] };
    },
    release() {
      released = true;
    },
  };
  return {
    pool: { connect: async () => client },
    calls,
    returned: () => returned,
    released: () => released,
  };
}
test('cancel returns inventory transactionally once and a stale retry cannot return it twice', async () => {
  const db = stockDatabase();
  const repo = adminOrders(db.pool);
  await repo.update(id, update);
  assert.equal(db.returned(), 1);
  assert.equal(db.calls.at(-1).sql, 'COMMIT');
  assert.ok(db.released());
  assert.ok(db.calls.some(c => c.sql.includes('ORDER BY id FOR UPDATE')));
  await assert.rejects(() => repo.update(id, update), { status: 409 });
  assert.equal(db.returned(), 1);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
});
test('deleting an unpaid order returns inventory once and never returns it for an already canceled order', async () => {
  for (const status of ['NEW', 'CANCELED']) {
    const db = stockDatabase(status, false, { payment_status: 'UNCONFIRMED', updatedAt: 'current' });
    const orders = adminOrders(db.pool);
    await orders.remove(id, 'current');
    assert.equal(db.returned(), status === 'NEW' ? 1 : 0);
    assert.match(db.calls.at(-2).sql, /^DELETE FROM orders/);
    assert.equal(db.calls.at(-1).sql, 'COMMIT');
    await assert.rejects(orders.remove(id, 'current'), { status: 404 });
    assert.equal(db.returned(), status === 'NEW' ? 1 : 0);
  }
});
test('deleting paid, dispatched, tracked or stale orders rolls back without touching inventory', async () => {
  for (const [status, fields, version] of [
    ['NEW', { payment_status: 'PAID' }, 'current'],
    ['SHIPPED', {}, 'current'],
    ['DELIVERED', {}, 'current'],
    ['NEW', { tracking_number: '20450000000000' }, 'current'],
    ['NEW', {}, 'stale'],
  ]) {
    const db = stockDatabase(status, false, { payment_status: 'UNCONFIRMED', updatedAt: 'current', ...fields });
    await assert.rejects(adminOrders(db.pool).remove(id, version), { status: 409 });
    assert.equal(db.returned(), 0);
    assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
    assert.ok(!db.calls.some(call => call.sql.startsWith('DELETE FROM orders')));
  }
  const db = stockDatabase('NEW', true, { payment_status: 'UNCONFIRMED', updatedAt: 'current' });
  await assert.rejects(adminOrders(db.pool).remove(id, 'current'), /stock failure/);
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
  assert.ok(!db.calls.some(call => call.sql.startsWith('DELETE FROM orders')));
});
test('invalid transitions, terminal orders and stock errors roll back', async () => {
  for (const [status, data] of [
    ['NEW', { ...update, status: 'DELIVERED' }],
    ['CANCELED', { ...update, expectedStatus: 'CANCELED' }],
    ['PAID', { ...update, expectedStatus: 'PAID' }],
  ]) {
    const db = stockDatabase(status);
    await assert.rejects(() => adminOrders(db.pool).update(id, data), {
      status: 409,
    });
    assert.equal(db.returned(), 0);
    assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
  }
  const db = stockDatabase('NEW', true);
  await assert.rejects(
    () => adminOrders(db.pool).update(id, update),
    /stock failure/
  );
  assert.equal(db.calls.at(-1).sql, 'ROLLBACK');
  assert.ok(db.released());
});
test('shipping and payment can be recorded independently, including after receipt', async () => {
  const fields = {
    delivery_method: 'nova_poshta:branch',
    tracking_number: '20450000000000',
    city: update.city,
    address: update.address,
    comment: update.comment,
    updatedAt: 'version',
  };
  const packed = stockDatabase('PACKED', false, fields);
  await adminOrders(packed.pool).update(id, {
    ...update, expectedStatus: 'PACKED', status: 'SHIPPED',
    expectedUpdatedAt: 'version', paymentStatus: 'UNCONFIRMED',
    trackingNumber: fields.tracking_number,
  });
  const dispatch = packed.calls.find(call => call.sql.startsWith('UPDATE orders'));
  assert.equal(dispatch.args[1], 'SHIPPED');
  assert.equal(dispatch.args[5], 'UNCONFIRMED');
  assert.equal(dispatch.args[8], fields.tracking_number);

  const delivered = stockDatabase('DELIVERED', false, fields);
  const payment = { ...update, expectedStatus: 'DELIVERED', status: 'DELIVERED', paymentStatus: 'PAID' };
  await adminOrders(delivered.pool).update(id, payment);
  assert.equal(delivered.calls.find(call => call.sql.startsWith('UPDATE orders')).args[5], 'PAID');
  await assert.rejects(() => adminOrders(delivered.pool).update(id, { ...payment, address: 'Інша адреса' }), { status: 409 });
  await assert.rejects(() => adminOrders(delivered.pool).update(id, { ...payment, expectedUpdatedAt: 'stale' }), { status: 409 });
});

test('pickup has its own ready status and does not accept tracking numbers', async () => {
  const db = stockDatabase('PACKED', false, { delivery_method: 'pickup' });
  const packed = { ...update, expectedStatus: 'PACKED', status: 'READY_FOR_PICKUP' };
  await assert.rejects(() => adminOrders(db.pool).update(id, { ...packed, trackingNumber: '20450000000000' }), { status: 400 });
  await assert.rejects(() => adminOrders(db.pool).update(id, { ...packed, status: 'SHIPPED' }), { status: 409 });
  await adminOrders(db.pool).update(id, packed);
  assert.equal(db.calls.at(-1).sql, 'COMMIT');
});
test('the API requires a tracking number to hand an order to a carrier and cannot create legacy PAID status', async () => {
  const db = stockDatabase('PROCESSING', false, { delivery_method: 'meest:branch' });
  const payload = { ...update, expectedStatus: 'PROCESSING' };
  await assert.rejects(adminOrders(db.pool).update(id, { ...payload, status: 'SHIPPED' }), { status: 400 });
  await assert.rejects(adminOrders(db.pool).update(id, { ...payload, status: 'PAID' }), { status: 409 });
});

test('updates validate status, lengths and article source URLs', () => {
  assert.ok(orderUpdateSchema.safeParse(update).success);
  assert.ok(
    !orderUpdateSchema.safeParse({ ...update, status: 'arbitrary' }).success
  );
  assert.ok(
    !orderUpdateSchema.safeParse({ ...update, comment: 'x'.repeat(2001) })
      .success
  );
  const a = {
    slug: 'test',
    title: 'Тест',
    excerpt: 'Опис',
    body: 'Текст',
    category: 'Догляд',
    author: 'omee',
    seoTitle: 'Тест',
    seoDescription: 'Опис',
    sources: [],
    status: 'draft',
  };
  assert.ok(articleSchema.safeParse(a).success);
  assert.ok(
    !articleSchema.safeParse({
      ...a,
      sources: [
        { title: 'test', url: 'javascript:alert(1)', accessedAt: '2026-11-02' },
      ],
    }).success
  );
});
test('article writes preserve sources, derive hash and use parameterized data', async () => {
  const calls = [];
  const repo = adminArticles({
    query: async (sql, args) => {
      calls.push({ sql, args });
      return { rows: [{ id }] };
    },
  });
  const data = {
    slug: 'test',
    title: "Тест ' SQL",
    excerpt: 'Опис',
    body: 'Текст',
    category: 'Догляд',
    author: 'omee',
    seoTitle: 'Тест',
    seoDescription: 'Опис',
    sources: [],
    status: 'draft',
  };
  await repo.save(data);
  await repo.save({ ...data, status: 'published' }, id);
  assert.equal(calls[0].args[10].length, 64);
  assert.ok(!calls[0].sql.includes(data.title));
  assert.equal(calls[1].args.at(-1), id);
  assert.ok(calls[1].sql.includes('COALESCE(published_at,now())'));
  await repo.remove(id);
  assert.deepEqual(calls[2].args, [id]);
});
function request(app, url, cookie, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const req = new IncomingMessage(new Socket());
    req.method = method;
    req.url = url;
    req.headers = {
      ...(cookie ? { cookie } : {}),
      ...(body
        ? {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(JSON.stringify(body)),
          }
        : {}),
    };
    if (body) req.push(JSON.stringify(body));
    req.push(null);
    const res = new ServerResponse(req);
    res.end = function (data) {
      this.finished = true;
      this.emit('finish');
      resolve({
        status: this.statusCode,
        cacheControl: this.getHeader('Cache-Control'),
        body: data ? JSON.parse(data.toString()) : null,
      });
      return this;
    };
    app.handle(req, res, reject);
  });
}
test('every new admin operation rejects guests and customers; ADMIN reads DB and invalid input never writes', async () => {
  const config = {
    mode: 'postgres',
    databaseUrl: 'postgres://localhost/admin-test',
    origins: [],
    accessSecret: 'a'.repeat(48),
    refreshSecret: 'b'.repeat(48),
  };
  const pool = getPool(config.databaseUrl);
  let role = 'CUSTOMER';
  const writes = [];
  pool.query = async (sql, args) => {
    if (sql.includes('FROM users')) return { rows: [{ id, role }] };
    if (sql.startsWith('SELECT count')) return { rows: [{ count: '1' }] };
    if (sql.startsWith('DELETE')) {
      writes.push({ sql, args });
      return { rowCount: 1, rows: [{ id }] };
    }
    return { rows: [{ id, status: 'NEW' }] };
  };
  try {
    const app = createApp(config);
    const cookie = 'kss_access=' + signSession({ id }, config).access;
    const operations = [
      ['/admin/overview', 'GET'],
      ['/admin/customers', 'GET'],
      ['/admin/settings', 'GET'],
      ['/admin/orders', 'GET'],
      ['/admin/orders/' + id, 'GET'],
      ['/admin/orders/' + id, 'PUT'],
      ['/admin/orders/' + id, 'DELETE'],
      ['/admin/articles', 'GET'],
      ['/admin/articles', 'POST'],
      ['/admin/articles/' + id, 'GET'],
      ['/admin/articles/' + id, 'PUT'],
      ['/admin/articles/' + id, 'DELETE'],
      ['/admin/content/banners/' + id, 'DELETE'],
    ];
    for (const [path, method] of operations) {
      assert.equal(
        (await request(app, '/api' + path, undefined, method)).status,
        401
      );
      assert.equal(
        (await request(app, '/api' + path, cookie, method)).status,
        403
      );
      role = 'MANAGER';
      assert.equal((await request(app, '/api' + path, cookie, method)).status, 403);
      role = 'CUSTOMER';
    }
    role = 'ADMIN';
    const privateCatalog = await request(app, '/api/admin/catalog');
    assert.equal(privateCatalog.status, 401);
    assert.equal(privateCatalog.cacheControl, 'no-store');
    const storeInfo = await request(app, '/api/store-info');
    assert.equal(storeInfo.status, 200);
    assert.equal(storeInfo.cacheControl, 'no-store');
    const delivery = await request(app, '/api/delivery/status');
    assert.match(delivery.cacheControl, /s-maxage=3600/);
    const orders = await request(app, '/api/admin/orders', cookie);
    assert.equal(orders.status, 200);
    assert.equal(orders.body.total, 1);
    assert.equal(
      (await request(app, '/api/admin/articles', cookie)).status,
      200
    );
    assert.equal(
      (await request(app, '/api/admin/orders/' + id, cookie, 'PUT', {})).status,
      400
    );
    assert.equal((await request(app, '/api/admin/orders/' + id, cookie, 'DELETE')).status, 400);
    const orderDb = stockDatabase('NEW', false, { payment_status: 'UNCONFIRMED', updatedAt: 'current' });
    pool.connect = orderDb.pool.connect;
    assert.equal((await request(app, '/api/admin/orders/' + id + '?expectedUpdatedAt=current', cookie, 'DELETE')).status, 204);
    assert.equal(orderDb.returned(), 1);
    assert.equal(
      (await request(app, '/api/admin/articles', cookie, 'POST', {})).status,
      400
    );
    assert.equal(writes.length, 0);
    assert.equal(
      (await request(app, '/api/admin/content/banners/' + id, cookie, 'DELETE'))
        .status,
      204
    );
    assert.deepEqual(writes[0].args, [id]);
  } finally {
    await closePool();
  }
});
