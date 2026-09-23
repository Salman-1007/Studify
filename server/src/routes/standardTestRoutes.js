import { Router } from 'express';
import * as ctrl from '../controllers/standardTestController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/', ctrl.generateTest);
router.get('/history', ctrl.getTestHistory);
router.get('/:attemptId', ctrl.getTestAttempt);
router.post('/:attemptId/submit', ctrl.submitTest);

export default router;