import { prisma } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listDecks = asyncHandler(async (req, res) => {
  const decks = await prisma.flashcardDeck.findMany({
    where: { userId: req.user.id },
    include: { _count: { select: { cards: true } } },
    orderBy: { createdAt: 'desc' },
  });
  ok(res, { decks });
});

export const getDeck = asyncHandler(async (req, res) => {
  const deck = await prisma.flashcardDeck.findUnique({ where: { id: req.params.id }, include: { cards: true } });
  if (!deck || deck.userId !== req.user.id) throw new ApiError(404, 'Deck not found');
  ok(res, { deck });
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
