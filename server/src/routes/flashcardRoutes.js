import { Router } from 'express';
import * as ctrl from '../controllers/flashcardController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/decks', ctrl.listDecks);
router.get('/decks/:id', ctrl.getDeck);
router.post('/decks/:id/cards', ctrl.createManualCard);
router.post('/cards/:cardId/review', ctrl.reviewCard);
router.get('/due', ctrl.dueCards);
export default router;
