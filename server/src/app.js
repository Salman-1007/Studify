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
import { notFound, errorHandler } from './middleware/errorHandler.js';
import { registerGroupChat } from './sockets/groupChat.js';

export const createApp = () => {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',');
  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(path.resolve('uploads')));

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/materials', materialRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/quiz-attempts', quizAttemptRoutes);
  app.use('/api/flashcards', flashcardRoutes);
  app.use('/api/groups', groupRoutes);
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
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',');
  const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });
  registerGroupChat(io);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Studify server listening on port ${PORT}`);
  });
}

export default createApp;
