import { Router } from 'express';
import { prisma } from '../config/db.js';

const router = Router();
router.get('/', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }
  res.json({ success: true, status: 'ok', database: dbStatus });
});
export default router;
