import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import materialRoutes from './routes/materialRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import quizRoutes from './routes/quizRoutes.js';
import quizAttemptRoutes from './routes/quizAttemptRoutes.js';
import flashcardRoutes from './routes/flashcardRoutes.js';
import groupRoutes from './routes/groupRoutes.js';
import leaderboardRoutes from './routes/leaderboardRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import curriculumRoutes from './routes/curriculumRoutes.js';
import standardTestRoutes from './routes/standardTestRoutes.js';
import directChatRoutes from './routes/directChatRoutes.js';
import questionPackRoutes from './routes/questionPackRoutes.js';
import { memoryCache } from './utils/cache.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { registerGroupChat } from './sockets/groupChat.js';

export const isAllowedOrigin = (origin) => {
    if (!origin) return true; // allow curl, mobile apps, server-side requests
    const normalized = origin.trim().replace(/\/$/, '');

    const envOrigins = (process.env.CLIENT_URL || '')
        .split(',')
        .map((o) => o.trim().replace(/\/$/, ''))
        .filter(Boolean);

    if (envOrigins.includes(normalized)) return true;

    const defaultOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:5173',
        'https://studify-ochre.vercel.app',
    ];
    if (defaultOrigins.includes(normalized)) return true;

    // Allow all vercel deployment preview URLs
    if (/^https:\/\/.*\.vercel\.app$/.test(normalized)) return true;
    if (/^http:\/\/localhost(:\d+)?$/.test(normalized)) return true;
    if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(normalized)) return true;

    return false;
};

export const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Set-Cookie'],
};

export const createApp = () => {
    const app = express();

    app.set('trust proxy', 1);

    // Apply CORS before helmet & routes
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            crossOriginEmbedderPolicy: false,
        })
    );

    app.use(express.json({ limit: '2mb' }));
    app.use(cookieParser());
    app.use('/uploads', express.static(path.resolve('uploads')));

    app.use('/api/health', healthRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/materials', materialRoutes);
    app.use('/api/ai', aiRoutes);
    app.use('/api/conversations', conversationRoutes);
    app.use('/api/curriculum', memoryCache.middleware('curriculum', 600), curriculumRoutes);
    app.use('/api/tests', standardTestRoutes);
    app.use('/api/quizzes', quizRoutes);
    app.use('/api/quiz-attempts', quizAttemptRoutes);
    app.use('/api/flashcards', flashcardRoutes);
    app.use('/api/groups', groupRoutes);
    app.use('/api/direct-chats', directChatRoutes);
    app.use('/api/question-packs', questionPackRoutes);
    app.use('/api/leaderboard', leaderboardRoutes);
    app.use('/api/progress', progressRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/admin', adminRoutes);

    app.use(notFound);
    app.use(errorHandler);
    return app;
};

if (process.env.NODE_ENV !== 'test') {
    const app = createApp();
    const server = http.createServer(app);
    const io = new Server(server, { cors: corsOptions });
    registerGroupChat(io);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
        console.log(`Studify server listening on port ${PORT}`);
    });
}

export default createApp;