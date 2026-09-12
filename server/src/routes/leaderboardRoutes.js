import { Router } from 'express';
import { globalLeaderboard } from '../controllers/leaderboardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.get('/', requireAuth, globalLeaderboard);
export default router;
