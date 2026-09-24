import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const listDirectChats = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;

  const chats = await prisma.directChat.findMany({
    where: {
      OR: [{ user1Id: currentUserId }, { user2Id: currentUserId }],
    },
    include: {
      user1: {
        select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true, points: true },
      },
      user2: {
        select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true, points: true },
      },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const formattedChats = chats.map((chat) => {
    const isUser1 = chat.user1Id === currentUserId;
    const partner = isUser1 ? chat.user2 : chat.user1;
    const lastMessage = chat.messages[0] || null;

    return {
      id: chat.id,
      status: chat.status,
      initiatorId: chat.initiatorId,
      isInitiator: chat.initiatorId === currentUserId,
      partner,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.isUnsent ? 'This message was unsent' : lastMessage.content,
            isUnsent: lastMessage.isUnsent,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
          }
        : null,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  });

  ok(res, { chats: formattedChats });
});

export const searchUsersForChat = asyncHandler(async (req, res) => {
  const query = (req.query.q || '').trim();
  const currentUserId = req.user.id;

  if (!query || query.length < 2) {
    return ok(res, { users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      isActive: true,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { username: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      grade: true,
      board: true,
      points: true,
    },
    take: 15,
  });

  // Attach existing chat status if any
  const userIds = users.map((u) => u.id);
  const existingChats = await prisma.directChat.findMany({
    where: {
      OR: [
        { user1Id: currentUserId, user2Id: { in: userIds } },
        { user2Id: currentUserId, user1Id: { in: userIds } },
      ],
    },
  });

  const chatMap = new Map();
  existingChats.forEach((c) => {
    const otherId = c.user1Id === currentUserId ? c.user2Id : c.user1Id;
    chatMap.set(otherId, c);
  });

  const results = users.map((u) => ({
    ...u,
    chat: chatMap.get(u.id) || null,
  }));

  ok(res, { users: results });
});

export const requestDirectChat = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const { recipientId, recipientEmail } = req.body;

  let targetUserId = recipientId;
  if (!targetUserId && recipientEmail) {
    const targetUser = await prisma.user.findUnique({
      where: { email: recipientEmail.trim().toLowerCase() },
    });
    if (!targetUser) throw new ApiError(404, 'User not found with this email');
    targetUserId = targetUser.id;
  }

  if (!targetUserId) {
    throw new ApiError(400, 'recipientId or recipientEmail is required');
  }

  if (targetUserId === currentUserId) {
    throw new ApiError(400, 'Cannot start a direct chat with yourself');
  }

  // Ensure deterministic user ordering to enforce @@unique([user1Id, user2Id])
  const [user1Id, user2Id] = currentUserId < targetUserId
    ? [currentUserId, targetUserId]
    : [targetUserId, currentUserId];

  let chat = await prisma.directChat.findUnique({
    where: {
      user1Id_user2Id: { user1Id, user2Id },
    },
    include: {
      user1: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
      user2: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
    },
  });

  if (chat) {
    // If chat already exists and is pending, and current user is recipient, automatically accept it!
    if (chat.status === 'PENDING' && chat.initiatorId !== currentUserId) {
      chat = await prisma.directChat.update({
        where: { id: chat.id },
        data: { status: 'ACCEPTED' },
        include: {
          user1: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
          user2: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
        },
      });
    }
    return ok(res, { chat });
  }

  chat = await prisma.directChat.create({
    data: {
      user1Id,
      user2Id,
      status: 'PENDING',
      initiatorId: currentUserId,
    },
    include: {
      user1: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
      user2: { select: { id: true, name: true, email: true, avatarUrl: true, grade: true, board: true } },
    },
  });

  ok(res, { chat }, 201);
});

export const updateChatStatus = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { status } = req.body;
  const currentUserId = req.user.id;

  if (!['ACCEPTED', 'REJECTED'].includes(status)) {
    throw new ApiError(400, 'Status must be ACCEPTED or REJECTED');
  }

  const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
  if (!chat) throw new ApiError(404, 'Direct chat not found');

  if (chat.user1Id !== currentUserId && chat.user2Id !== currentUserId) {
    throw new ApiError(403, 'Unauthorized');
  }

  const updatedChat = await prisma.directChat.update({
    where: { id: chatId },
    data: { status },
  });

  ok(res, { chat: updatedChat });
});

export const getDirectMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const currentUserId = req.user.id;

  const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
  if (!chat) throw new ApiError(404, 'Direct chat not found');
  if (chat.user1Id !== currentUserId && chat.user2Id !== currentUserId && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'Unauthorized');
  }

  const messages = await prisma.directMessage.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
    take: 100,
    include: {
      sender: {
        select: { id: true, name: true, email: true, avatarUrl: true },
      },
    },
  });

  const sanitizedMessages = messages.map((m) => ({
    id: m.id,
    chatId: m.chatId,
    senderId: m.senderId,
    sender: m.sender,
    content: m.isUnsent ? 'This message was unsent' : m.content,
    isUnsent: m.isUnsent,
    unsentAt: m.unsentAt,
    createdAt: m.createdAt,
  }));

  ok(res, { messages: sanitizedMessages, chat });
});

export const sendDirectMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;
  const currentUserId = req.user.id;

  if (!content || !content.trim()) {
    throw new ApiError(400, 'Content cannot be empty');
  }

  const chat = await prisma.directChat.findUnique({ where: { id: chatId } });
  if (!chat) throw new ApiError(404, 'Direct chat not found');
  if (chat.user1Id !== currentUserId && chat.user2Id !== currentUserId) {
    throw new ApiError(403, 'Unauthorized');
  }

  const message = await prisma.directMessage.create({
    data: {
      chatId,
      senderId: currentUserId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  // Update chat updatedAt timestamp
  await prisma.directChat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  ok(res, { message }, 201);
});

export const unsendDirectMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const currentUserId = req.user.id;

  const msg = await prisma.directMessage.findUnique({ where: { id: messageId } });
  if (!msg) throw new ApiError(404, 'Message not found');

  if (msg.senderId !== currentUserId && req.user.role !== 'ADMIN') {
    throw new ApiError(403, 'You can only unsend your own messages');
  }

  const updated = await prisma.directMessage.update({
    where: { id: messageId },
    data: {
      isUnsent: true,
      unsentAt: new Date(),
      content: 'This message was unsent',
    },
    include: {
      sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  ok(res, { message: updated });
});

