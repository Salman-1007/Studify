import { Router } from 'express';
import * as ctrl from '../controllers/aiController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/', ctrl.listConversations);
router.get('/:id', ctrl.getConversation);
router.put('/:id', ctrl.renameConversation);
router.delete('/:id', ctrl.deleteConversation);
export default router;
