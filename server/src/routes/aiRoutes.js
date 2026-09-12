import { Router } from 'express';
import * as ctrl from '../controllers/aiController.js';
import { requireAuth } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.use(requireAuth, aiLimiter);
router.post('/chat', ctrl.chat);
router.post('/summarize', ctrl.summarize);
router.post('/generate-quiz', ctrl.generateQuiz);
router.post('/generate-flashcards', ctrl.generateFlashcards);
router.post('/study-plan', ctrl.studyPlan);
export default router;
