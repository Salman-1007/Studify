import { Router } from 'express';
import * as ctrl from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);
router.get('/', ctrl.listNotifications);
router.patch('/:id/read', ctrl.markRead);
router.post('/push-token', ctrl.registerPushToken);
export default router;
