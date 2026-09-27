import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const signAccessToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });

export const verifyAccessToken = (token) => jwt.verify(token, process.env.JWT_ACCESS_SECRET);

export const generateRefreshTokenValue = () => crypto.randomBytes(40).toString('hex');
