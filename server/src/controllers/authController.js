import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { signAccessToken, generateRefreshTokenValue } from '../utils/tokens.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const REFRESH_COOKIE = 'studify_refresh';
const REFRESH_TTL_DAYS = 30;

const setRefreshCookie = (res, token) => {
    res.cookie(REFRESH_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
        path: '/api/auth',
    });
};

const issueTokens = async(userId) => {
    const accessToken = signAccessToken(userId);
    const refreshToken = generateRefreshTokenValue();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
    await prisma.refreshToken.create({ data: { token: refreshToken, userId, expiresAt } });
    return { accessToken, refreshToken };
};

export const publicUser = (u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    email: u.email,
    educationLevel: u.educationLevel,
    grade: u.grade,
    class: u.grade,
    board: u.board || 'Punjab',
    level: u.level || 1,
    xp: u.points || 0,
    points: u.points || 0,
    streak: u.streakCount || 0,
    streakCount: u.streakCount || 0,
    institution: u.institution,
    avatarUrl: u.avatarUrl,
    role: u.role,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
});

export const signup = asyncHandler(async(req, res) => {
    const { name, email, password, grade, class: classVal, board, institution, educationLevel, username } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingEmail) throw new ApiError(409, 'Email is already in use');

    const assignedGrade = String(grade || classVal || '9');
    let finalUsername = username ?.trim();
    if (!finalUsername) {
        const base = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'student';
        let candidate = base;
        let counter = 1;
        while (await prisma.user.findUnique({ where: { username: candidate } })) {
            candidate = `${base}${Math.floor(100 + Math.random() * 900)}`;
            counter++;
            if (counter > 5) {
                candidate = `${base}_${Date.now().toString().slice(-4)}`;
                break;
            }
        }
        finalUsername = candidate;
    } else {
        const existingUsername = await prisma.user.findUnique({ where: { username: finalUsername } });
        if (existingUsername) throw new ApiError(409, 'Username is already in use');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const edLevel = educationLevel || (['9', '10'].includes(assignedGrade) ? 'SCHOOL' : 'COLLEGE');

    const user = await prisma.user.create({
        data: {
            name: name.trim(),
            username: finalUsername,
            email: normalizedEmail,
            passwordHash,
            grade: assignedGrade,
            board: board ? board.trim() : 'Punjab',
            educationLevel: edLevel,
            institution: institution ? institution.trim() : null,
            level: 1,
            points: 0,
            streakCount: 0,
        },
    });

    const { accessToken, refreshToken } = await issueTokens(user.id);
    setRefreshCookie(res, refreshToken);
    ok(res, { user: publicUser(user), accessToken }, 201);
});

export const register = asyncHandler(async(req, res) => {
    const { name, username, email, password, educationLevel, grade, board, institution } = req.body;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findFirst({ where: { OR: [{ email: normalizedEmail }, { username }] } });
    if (existing) throw new ApiError(409, 'Email or username already in use');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: {
            name,
            username,
            email: normalizedEmail,
            passwordHash,
            educationLevel,
            grade: grade ? String(grade) : undefined,
            board: board || 'Punjab',
            institution,
            level: 1,
            points: 0,
            streakCount: 0,
        },
    });

    const { accessToken, refreshToken } = await issueTokens(user.id);
    setRefreshCookie(res, refreshToken);
    ok(res, { user: publicUser(user), accessToken }, 201);
});

export const login = asyncHandler(async(req, res) => {
    const { identifier, password } = req.body;
    const trimmed = identifier ? identifier.trim() : '';
    const user = await prisma.user.findFirst({
        where: {
            OR: [
                { email: trimmed.toLowerCase() },
                { username: trimmed },
            ],
        },
    });
    if (!user || !user.isActive) throw new ApiError(401, 'Invalid credentials');

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new ApiError(401, 'Invalid credentials');

    const { accessToken, refreshToken } = await issueTokens(user.id);
    setRefreshCookie(res, refreshToken);
    ok(res, { user: publicUser(user), accessToken });
});

export const refresh = asyncHandler(async(req, res) => {
    const token = req.cookies ?.[REFRESH_COOKIE];
    if (!token) throw new ApiError(401, 'No refresh token');

    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
        throw new ApiError(401, 'Refresh token invalid or expired');
    }

    await prisma.refreshToken.update({ where: { token }, data: { revoked: true } });
    const { accessToken, refreshToken } = await issueTokens(stored.userId);
    setRefreshCookie(res, refreshToken);
    ok(res, { accessToken });
});

export const logout = asyncHandler(async(req, res) => {
    const token = req.cookies ?.[REFRESH_COOKIE];
    if (token) {
        await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    ok(res, { loggedOut: true });
});

export const me = asyncHandler(async(req, res) => {
    ok(res, { user: publicUser(req.user) });
});