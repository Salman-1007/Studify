import { Router } from 'express';
import * as ctrl from '../controllers/curriculumController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Student-accessible curriculum hierarchy endpoints
router.get('/boards', requireAuth, ctrl.getBoards);
router.get('/classes', requireAuth, ctrl.getClasses);
router.get('/subjects', requireAuth, ctrl.getSubjects);
router.get('/chapters', requireAuth, ctrl.getChapters);
router.get('/topics', requireAuth, ctrl.getTopics);

export default router;