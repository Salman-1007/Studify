import { Router } from 'express';
import * as ctrl from '../controllers/notificationController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.listNotifications);
router.patch('/read-all', ctrl.markAllRead);
router.post('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);

// Mobile Push Tokens
router.post('/push-token', ctrl.registerToken);
router.delete('/push-token/:token', ctrl.deleteToken);
router.delete('/push-token', ctrl.deleteToken);
router.post('/push-token/delete', ctrl.deleteToken);

// App Notifications for deep linking & mobile drawer
router.get('/app', ctrl.listAppNotifications);
router.patch('/app/:id/read', ctrl.markAppNotificationRead);
router.post('/app/read-all', ctrl.markAllAppNotificationsRead);

// Live Push Testing Endpoint
router.post('/test-push', ctrl.testPushNotification);

export default router;
