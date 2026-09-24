import { Router } from 'express';
import * as ctrl from '../controllers/flashcardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/decks', ctrl.listDecks);
router.post('/decks', ctrl.createDeck);
router.post('/from-question-bank', ctrl.createDeckFromQuestionBank);
router.post('/generate-ai', ctrl.createDeckFromAI);
router.get('/decks/:id', ctrl.getDeck);
router.post('/decks/:id/cards', ctrl.createManualCard);
router.post('/cards/:cardId/review', ctrl.reviewCard);
router.get('/due', ctrl.dueCards);

export default router;