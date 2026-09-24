import { Router } from 'express';
import * as ctrl from '../controllers/directChatController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.listDirectChats);
router.get('/search-users', ctrl.searchUsersForChat);
router.post('/request', ctrl.requestDirectChat);
router.put('/:chatId/status', ctrl.updateChatStatus);
router.get('/:chatId/messages', ctrl.getDirectMessages);
router.post('/:chatId/messages', ctrl.sendDirectMessage);
router.delete('/messages/:messageId', ctrl.unsendDirectMessage);

export default router;

