import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { createFakePrisma } from './fakePrisma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../src/config/db.js');

// Builds a fresh Express app wired to a fresh in-memory fake Prisma instance.
export const buildTestApp = async () => {
  const prisma = createFakePrisma();
  jest.unstable_mockModule(dbPath, () => ({ prisma }));
  const { createApp } = await import('../src/app.js');
  return { app: createApp(), prisma };
};
