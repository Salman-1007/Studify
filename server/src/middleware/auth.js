import { verifyAccessToken } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';
import { prisma } from '../config/db.js';

export const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new ApiError(401, 'Not authenticated');
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new ApiError(401, 'Not authenticated');
    req.user = user;
    next();
  } catch (err) {
    next(new ApiError(401, 'Not authenticated'));
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') return next(new ApiError(403, 'Forbidden'));
  next();
};
