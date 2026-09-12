import { Router } from 'express';
import { myAttempts } from '../controllers/quizController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.get('/', requireAuth, myAttempts);
export default router;
