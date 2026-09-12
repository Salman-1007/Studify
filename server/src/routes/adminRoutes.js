import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);
router.get('/users', ctrl.listUsers);
router.patch('/users/:id/deactivate', ctrl.deactivateUser);
router.get('/groups', ctrl.listGroups);
router.get('/stats', ctrl.platformStats);
export default router;
