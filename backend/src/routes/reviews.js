import {Router} from 'express';
import {z} from 'zod';
import {getPool} from '../config/db.js';
import {requireRole} from '../middleware/auth.js';
import {reviewRepository} from '../models/reviews.js';
import {validate,validateId} from '../validators/catalog.js';

const pageSchema = z.coerce.number().int().min(1).max(100000).default(1);
const inputSchema = z.object({
  expectedUserId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).default(''),
}).strict();
const productId = req => req.params.target === 'store' ? null : validateId(req.params.target);

export function reviewRoutes(config) {
  const router = Router();
  const repo = () => reviewRepository(getPool(config.databaseUrl));
  const authenticated = requireRole(config);

  router.use((_req,res,next) => {
    res.set('Cache-Control','no-store');
    next();
  });
  router.get('/:target', async (req,res) => {
    const id = productId(req);
    const page = validate(pageSchema,req.query.page);
    if (config.mode === 'demo') return res.json({summary:{average:null,count:0},items:[],hasNext:false});
    res.json(await repo().list(id,page));
  });
  router.use('/:target/mine', (_req,res,next) => {
    if (config.mode === 'demo') return res.status(503).json({message:'Відгуки потребують підключення до бази даних.'});
    next();
  }, authenticated);
  router.get('/:target/mine', async (req,res) => {
    res.json(await repo().mine(productId(req),req.user.id));
  });
  router.put('/:target/mine', async (req,res) => {
    const id = productId(req);
    const input = validate(inputSchema,req.body);
    if (input.expectedUserId !== req.user.id) {
      return res.status(409).json({message:'Акаунт змінився. Оновіть сторінку.'});
    }
    res.json(await repo().save(id,req.user.id,input));
  });
  return router;
}
