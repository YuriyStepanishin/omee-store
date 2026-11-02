import test from 'node:test';
import assert from 'node:assert/strict';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { adminOrders } from '../src/models/adminOrders.js';
import { adminArticles } from '../src/models/adminArticles.js';
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
function stockDatabase(status = 'NEW', fail = false) {
  const calls = [];
  let returned = 0;
  let released = false;
  const client = {
    async query(sql, args) {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT status')) return { rows: [{ status }] };
      if (sql.startsWith('UPDATE products')) {
        returned++;
        if (fail) throw Error('stock failure');
      }
      if (sql.startsWith('UPDATE orders')) status = args[1];
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
  assert.equal(calls[0].args[9].length, 64);
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
      ['/admin/orders', 'GET'],
      ['/admin/orders/' + id, 'GET'],
      ['/admin/orders/' + id, 'PUT'],
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
    }
    role = 'ADMIN';
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
