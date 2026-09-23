import { Router } from 'express';
import * as ctrl from '../controllers/adminController.js';
import * as qCtrl from '../controllers/adminQuestionController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Platform & User Management
router.get('/users', ctrl.listUsers);
router.patch('/users/:id/deactivate', ctrl.deactivateUser);
router.get('/groups', ctrl.listGroups);
router.get('/stats', ctrl.platformStats);

// Canonical Question Bank Management
router.get('/questions', qCtrl.listQuestions);
router.get('/questions/:id', qCtrl.getQuestion);
router.post('/questions', qCtrl.createQuestion);
router.patch('/questions/:id', qCtrl.updateQuestion);
router.patch('/questions/:id/status', qCtrl.updateQuestion);
router.delete('/questions/:id', qCtrl.deleteQuestion);
router.post('/questions/import', qCtrl.importQuestions);
router.post('/questions/import-json', qCtrl.importQuestions);

export default router;