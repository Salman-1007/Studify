import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as aiService from '../services/aiService.js';
import { findRelevantChunks } from '../services/retrievalService.js';
import { getWeakTopics } from '../services/adaptiveLearningService.js';

export const chat = asyncHandler(async (req, res) => {
  const { conversationId, message, materialId, topic } = req.body;
  if (!message) throw new ApiError(400, 'message is required');

  let conversation;
  if (conversationId) {
    conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || conversation.userId !== req.user.id) throw new ApiError(404, 'Conversation not found');
  } else {
    conversation = await prisma.conversation.create({
      data: { userId: req.user.id, materialId, title: message.slice(0, 60) },
    });
  }

  let materialContext = null;
  if (materialId || conversation.materialId) {
    const chunks = await prisma.materialChunk.findMany({ where: { materialId: materialId || conversation.materialId } });
    if (chunks.length) materialContext = findRelevantChunks(chunks, message).join('\n---\n');
  }

  const history = await prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' } });

  await prisma.message.create({ data: { conversationId: conversation.id, role: 'user', content: message } });

  const reply = await aiService.generateChatResponse({ history, message, materialContext, topic });

  const saved = await prisma.message.create({ data: { conversationId: conversation.id, role: 'assistant', content: reply } });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  ok(res, { conversationId: conversation.id, message: saved });
});

export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await prisma.conversation.findMany({
    where: { userId: req.user.id },
    orderBy: { updatedAt: 'desc' },
  });
  ok(res, { conversations });
});

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: req.params.id },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!conversation || conversation.userId !== req.user.id) throw new ApiError(404, 'Conversation not found');
  ok(res, { conversation });
});

export const renameConversation = asyncHandler(async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation || conversation.userId !== req.user.id) throw new ApiError(404, 'Conversation not found');
  const updated = await prisma.conversation.update({ where: { id: req.params.id }, data: { title: req.body.title } });
  ok(res, { conversation: updated });
});

export const deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!conversation || conversation.userId !== req.user.id) throw new ApiError(404, 'Conversation not found');
  await prisma.conversation.delete({ where: { id: req.params.id } });
  ok(res, { deleted: true });
});

export const summarize = asyncHandler(async (req, res) => {
  const { materialId, text } = req.body;
  let content = text;
  let title;
  if (materialId) {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material || material.userId !== req.user.id) throw new ApiError(404, 'Material not found');
    content = material.extractedText || '';
    title = material.title;
  }
  if (!content) throw new ApiError(400, 'No material text available to summarize');
  const summary = await aiService.generateSummary({ text: content, title });
  ok(res, { summary });
});

export const generateQuiz = asyncHandler(async (req, res) => {
  const { topic, subject, difficulty, numQuestions, materialId } = req.body;
  let materialText;
  if (materialId) {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (material && material.userId === req.user.id) materialText = material.extractedText;
  }

  const data = await aiService.generateQuiz({ topic, subject, difficulty, numQuestions, materialText });

  const quiz = await prisma.quiz.create({
    data: {
      title: data.title || `${topic} Quiz`,
      topic, subject, difficulty, creatorId: req.user.id, materialId,
      questions: {
        create: data.questions.map((q, i) => ({
          question: q.question,
          type: q.type === 'true_false' ? 'TRUE_FALSE' : q.type === 'fill_blank' ? 'FILL_BLANK' : 'MCQ',
          options: q.options ?? undefined,
          correctAnswer: String(q.correctAnswer),
          explanation: q.explanation,
          order: i,
        })),
      },
    },
    include: { questions: true },
  });

  ok(res, { quiz }, 201);
});

export const generateFlashcards = asyncHandler(async (req, res) => {
  const { topic, numCards, materialId } = req.body;
  let materialText;
  if (materialId) {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (material && material.userId === req.user.id) materialText = material.extractedText;
  }
  const data = await aiService.generateFlashcards({ topic, numCards, materialText });

  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: req.user.id, title: topic, topic,
      cards: { create: data.cards.map((c) => ({ front: c.front, back: c.back })) },
    },
    include: { cards: true },
  });

  ok(res, { deck }, 201);
});

export const studyPlan = asyncHandler(async (req, res) => {
  const { subjects = [], availableHoursPerWeek = 5 } = req.body;
  const weak = await getWeakTopics(req.user.id);
  const plan = await aiService.generateStudyPlan({
    weakTopics: weak.map((w) => w.topic), subjects, availableHoursPerWeek,
  });
  ok(res, { plan });
});
