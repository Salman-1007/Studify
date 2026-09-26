import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getDailyStatus,
  generateDailyChallenge,
  submitDailyChallenge,
  getDailyLeaderboard,
} from '../controllers/dailyArenaController.js';

const router = Router();

router.use(requireAuth);

router.get('/status', getDailyStatus);
router.post('/generate', generateDailyChallenge);
router.post('/submit', submitDailyChallenge);
router.get('/leaderboard', getDailyLeaderboard);

export default router;
