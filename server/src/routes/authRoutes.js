import { Router } from 'express';
import * as ctrl from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema } from '../validators/authValidators.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = Router();
router.post('/register', authLimiter, validate(registerSchema), ctrl.register);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', ctrl.logout);
router.get('/me', requireAuth, ctrl.me);
export default router;
