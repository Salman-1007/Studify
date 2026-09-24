import { Router } from 'express';
import * as ctrl from '../controllers/questionPackController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Downloading and listing packs can be authenticated
router.use(requireAuth);
router.get('/', ctrl.listQuestionPacks);
router.get('/:id/download', ctrl.downloadQuestionPack);
router.post('/', requireAdmin, ctrl.createQuestionPack);

export default router;

