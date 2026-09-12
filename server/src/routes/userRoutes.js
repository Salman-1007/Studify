import { Router } from 'express';
import multer from 'multer';
import * as ctrl from '../controllers/userController.js';
import { requireAuth } from '../middleware/auth.js';

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();
router.use(requireAuth);
router.get('/profile', ctrl.getProfile);
router.put('/profile', ctrl.updateProfile);
router.put('/profile/password', ctrl.changePassword);
router.post('/profile/avatar', upload.single('avatar'), ctrl.uploadAvatar);
export default router;
