import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getPool } from '../config/db.js';
import { validate, validateId } from '../validators/catalog.js';
import {
  orderListSchema,
  orderUpdateSchema,
  articleSchema,
} from '../validators/admin.js';
import { adminOrders } from '../models/adminOrders.js';
import { adminArticles } from '../models/adminArticles.js';
export function adminRoutes(config) {
  const router = Router();
  router.use(
    ['/admin/orders', '/admin/articles', '/admin/content/banners'],
    requireRole(config, 'ADMIN')
  );
  router.use(
    ['/admin/orders', '/admin/articles', '/admin/content/banners'],
    (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      if (config.mode !== 'postgres')
        return res
          .status(503)
          .json({ message: 'Керування потребує підключення до PostgreSQL.' });
      next();
    }
  );
  const orders = () => adminOrders(getPool(config.databaseUrl));
  const articles = () => adminArticles(getPool(config.databaseUrl));
  router.get('/admin/orders', async (req, res) =>
    res.json(await orders().list(validate(orderListSchema, req.query)))
  );
  router.get('/admin/orders/:id', async (req, res) =>
    res.json(await orders().detail(validateId(req.params.id)))
  );
  router.put('/admin/orders/:id', async (req, res) => {
    await orders().update(
      validateId(req.params.id),
      validate(orderUpdateSchema, req.body)
    );
    res.status(204).end();
  });
  router.get('/admin/articles', async (req, res) =>
    res.json(await articles().list())
  );
  router.get('/admin/articles/:id', async (req, res) =>
    res.json(await articles().detail(validateId(req.params.id)))
  );
  router.post('/admin/articles', async (req, res) =>
    res
      .status(201)
      .json(await articles().save(validate(articleSchema, req.body)))
  );
  router.put('/admin/articles/:id', async (req, res) =>
    res.json(
      await articles().save(
        validate(articleSchema, req.body),
        validateId(req.params.id)
      )
    )
  );
  router.delete('/admin/articles/:id', async (req, res) => {
    await articles().remove(validateId(req.params.id));
    res.status(204).end();
  });
  router.delete('/admin/content/banners/:id', async (req, res) => {
    const { rowCount } = await getPool(config.databaseUrl).query(
      'DELETE FROM banners WHERE id=$1',
      [validateId(req.params.id)]
    );
    if (!rowCount)
      return res.status(404).json({ message: 'Банер не знайдено.' });
    res.status(204).end();
  });
  return router;
}
