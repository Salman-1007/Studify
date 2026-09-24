import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as aiService from '../services/aiService.js';

export const listDecks = asyncHandler(async(req, res) => {
    const decks = await prisma.flashcardDeck.findMany({
        where: { userId: req.user.id },
        include: { _count: { select: { cards: true } } },
        orderBy: { createdAt: 'desc' },
    });
    ok(res, { decks });
});

export const getDeck = asyncHandler(async(req, res) => {
    const deck = await prisma.flashcardDeck.findUnique({
        where: { id: req.params.id },
        include: { cards: true },
    });
    if (!deck || deck.userId !== req.user.id) throw new ApiError(404, 'Deck not found');
    ok(res, { deck });
});

export const createDeck = asyncHandler(async(req, res) => {
    const { title, topic, cards = [] } = req.body;
    if (!title) throw new ApiError(400, 'Title is required');

    const deck = await prisma.flashcardDeck.create({
        data: {
            userId: req.user.id,
            title,
            topic: topic || 'General',
            cards: {
                create: cards.map((c) => ({
                    front: c.front,
                    back: c.back,
                })),
            },
        },
        include: { cards: true },
    });

    ok(res, { deck }, 201);
});

export const createDeckFromQuestionBank = asyncHandler(async(req, res) => {
            const { chapterId, subjectId, topicId, count = 10, title } = req.body;

            const where = { status: 'APPROVED' };
            if (chapterId) where.chapterId = chapterId;
            if (topicId) where.topicId = topicId;
            if (subjectId) where.subjectId = subjectId;

            const bankQuestions = await prisma.questionBankItem.findMany({
                where,
                include: { chapter: true, subject: true },
            });

            if (bankQuestions.length === 0) {
                throw new ApiError(404, 'No approved questions available for this chapter');
            }

            const shuffled = bankQuestions.sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, Math.min(Number(count) || 10, shuffled.length));

            const firstQ = selected[0];
            const deckTitle =
                title ||
                `${firstQ.subject?.bookName || firstQ.subject?.subjectName || 'PTB'} - ${firstQ.chapter?.chapterName || 'Key Concepts'} Flashcards`;

            const deck = await prisma.flashcardDeck.create({
                        data: {
                            userId: req.user.id,
                            title: deckTitle,
                            topic: firstQ.chapter ?.chapterName || 'Punjab Board Curriculum',
                            cards: {
                                create: selected.map((q) => {
                                            const optLetter = q.correctAnswer ? q.correctAnswer.trim().toUpperCase() : 'A';
                                            const optText = q[`option${optLetter}`] || '';
                                            return {
                                                front: q.questionText,
                                                back: `Correct Answer: [${optLetter}] ${optText}${q.explanation ? `\n\nExplanation: ${q.explanation}` : ''}`,
          };
        }),
      },
    },
    include: { cards: true },
  });

  ok(res, { deck }, 201);
});

export const createDeckFromAI = asyncHandler(async (req, res) => {
  const { topic, numCards = 8, materialId } = req.body;
  if (!topic && !materialId) throw new ApiError(400, 'topic or materialId is required');

  let materialText;
  if (materialId) {
    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (material && material.userId === req.user.id) materialText = material.extractedText;
  }

  const data = await aiService.generateFlashcards({
    topic: topic || 'Study Deck',
    numCards: Number(numCards) || 8,
    materialText,
  });

  const deck = await prisma.flashcardDeck.create({
    data: {
      userId: req.user.id,
      title: topic || 'AI Generated Deck',
      topic: topic || 'General',
      cards: { create: data.cards.map((c) => ({ front: c.front, back: c.back })) },
    },
    include: { cards: true },
  });

  ok(res, { deck }, 201);
});

export const createManualCard = asyncHandler(async (req, res) => {
  const { front, back } = req.body;
  if (!front || !back) throw new ApiError(400, 'front and back are required');
  const card = await prisma.flashcard.create({ data: { deckId: req.params.id, front, back } });
  ok(res, { card }, 201);
});

export const reviewCard = asyncHandler(async (req, res) => {
  const { rating } = req.body; // easy|medium|hard
  const card = await prisma.flashcard.findUnique({ where: { id: req.params.cardId } });
  if (!card) throw new ApiError(404, 'Card not found');
  const intervalMap = { hard: 1, medium: 3, easy: 6 };
  const days = intervalMap[rating] || 1;
  const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await prisma.flashcardReview.create({ data: { flashcardId: card.id, rating } });
  const updated = await prisma.flashcard.update({ where: { id: card.id }, data: { dueAt, interval: days } });
  ok(res, { card: updated });
});

export const dueCards = asyncHandler(async (req, res) => {
  const cards = await prisma.flashcard.findMany({
    where: { deck: { userId: req.user.id }, dueAt: { lte: new Date() } },
    include: { deck: { select: { title: true } } },
  });
  ok(res, { cards });
});