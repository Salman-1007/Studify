import { Router } from 'express';
import * as ctrl from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/', ctrl.listNotifications);
router.patch('/read-all', ctrl.markAllRead);
router.post('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
export default router;
