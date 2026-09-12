import { Router } from 'express';
import * as ctrl from '../controllers/quizController.js';
import { validate } from '../middleware/validate.js';
import { submitAttemptSchema } from '../validators/quizValidators.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/', ctrl.listQuizzes);
router.get('/:id', ctrl.getQuiz);
router.post('/:id/attempt', validate(submitAttemptSchema), ctrl.submitAttempt);
export default router;
