import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/materialController.js';
import { requireAuth } from '../middleware/auth.js';

const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } });
const router = Router();
router.use(requireAuth);
router.get('/', ctrl.listMaterials);
router.post('/', upload.single('file'), ctrl.createMaterial);
router.get('/:id', ctrl.getMaterial);
router.delete('/:id', ctrl.deleteMaterial);
export default router;
