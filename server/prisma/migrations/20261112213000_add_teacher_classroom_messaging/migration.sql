-- Additive, backward-compatible migration for Teacher Portal, Classrooms,
-- Quiz Assignments, Notifications, and Real-Time Messaging Extensions.
-- Safe against prior db-push drift (uses IF NOT EXISTS / guarded enum alters).

-- 1. Role & Enum extensions
DO $$ BEGIN
  ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEACHER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TeacherVerificationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClassroomMembershipStatus" AS ENUM ('ACTIVE', 'REMOVED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "QuizAssignmentStatus" AS ENUM ('DRAFT', 'REVIEWED', 'PUBLISHED', 'ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubmissionStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'TIMED_OUT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ChatRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. User extensions (all nullable or safely defaulted)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "teacherStatus" "TeacherVerificationStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "themePreference" TEXT DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "showOnlineStatus" BOOLEAN NOT NULL DEFAULT true;

-- 3. Quiz extensions (existing quizzes default to PUBLISHED)
ALTER TABLE "Quiz"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "QuizAssignmentStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "isTeacherQuiz" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 4. Notification extensions
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "link" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "Notification_userId_dedupeKey_idx" ON "Notification"("userId", "dedupeKey");

-- 5. GroupMessage extensions
ALTER TABLE "GroupMessage"
  ADD COLUMN IF NOT EXISTS "isUnsent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "unsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "messageType" TEXT NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "attachment" JSONB,
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedForEveryoneAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT,
  ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pinnedById" TEXT;

CREATE INDEX IF NOT EXISTS "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");
CREATE INDEX IF NOT EXISTS "GroupMessage_replyToId_idx" ON "GroupMessage"("replyToId");

DO $$ BEGIN
  ALTER TABLE "GroupMessage"
    ADD CONSTRAINT "GroupMessage_replyToId_fkey"
    FOREIGN KEY ("replyToId") REFERENCES "GroupMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. DirectChat & DirectMessage (guarded for prior db push) + extensions
CREATE TABLE IF NOT EXISTS "DirectChat" (
  "id" TEXT NOT NULL,
  "user1Id" TEXT NOT NULL,
  "user2Id" TEXT NOT NULL,
  "status" "ChatRequestStatus" NOT NULL DEFAULT 'PENDING',
  "initiatorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectChat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DirectChat_user1Id_user2Id_key" ON "DirectChat"("user1Id", "user2Id");
CREATE INDEX IF NOT EXISTS "DirectChat_user1Id_idx" ON "DirectChat"("user1Id");
CREATE INDEX IF NOT EXISTS "DirectChat_user2Id_idx" ON "DirectChat"("user2Id");

DO $$ BEGIN
  ALTER TABLE "DirectChat" ADD CONSTRAINT "DirectChat_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DirectChat" ADD CONSTRAINT "DirectChat_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DirectMessage" (
  "id" TEXT NOT NULL,
  "chatId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isUnsent" BOOLEAN NOT NULL DEFAULT false,
  "unsentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DirectMessage"
  ADD COLUMN IF NOT EXISTS "messageType" TEXT NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "attachment" JSONB,
  ADD COLUMN IF NOT EXISTS "replyToId" TEXT,
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedForEveryoneAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT,
  ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pinnedById" TEXT;

CREATE INDEX IF NOT EXISTS "DirectMessage_chatId_createdAt_idx" ON "DirectMessage"("chatId", "createdAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_senderId_idx" ON "DirectMessage"("senderId");
CREATE INDEX IF NOT EXISTS "DirectMessage_replyToId_idx" ON "DirectMessage"("replyToId");

DO $$ BEGIN
  ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "DirectChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "DirectMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "QuestionPack" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "classGrade" TEXT NOT NULL,
  "subjectName" TEXT NOT NULL,
  "boardName" TEXT NOT NULL DEFAULT 'Punjab',
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT true,
  "downloads" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionPack_pkey" PRIMARY KEY ("id")
);

-- 7. TeacherInviteCode
CREATE TABLE IF NOT EXISTS "TeacherInviteCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "email" TEXT,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "isRevoked" BOOLEAN NOT NULL DEFAULT false,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherInviteCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherInviteCode_code_key" ON "TeacherInviteCode"("code");
CREATE INDEX IF NOT EXISTS "TeacherInviteCode_code_idx" ON "TeacherInviteCode"("code");
DO $$ BEGIN
  ALTER TABLE "TeacherInviteCode" ADD CONSTRAINT "TeacherInviteCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Classrooms & Related Tables
CREATE TABLE IF NOT EXISTS "Classroom" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT,
  "description" TEXT,
  "classGrade" TEXT,
  "board" TEXT,
  "joinCode" TEXT NOT NULL,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "teacherId" TEXT NOT NULL,
  "groupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_joinCode_key" ON "Classroom"("joinCode");
CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_groupId_key" ON "Classroom"("groupId");
CREATE INDEX IF NOT EXISTS "Classroom_teacherId_isArchived_idx" ON "Classroom"("teacherId", "isArchived");
DO $$ BEGIN
  ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClassroomMembership" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "ClassroomMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "ClassroomMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassroomMembership_classroomId_userId_key" ON "ClassroomMembership"("classroomId", "userId");
CREATE INDEX IF NOT EXISTS "ClassroomMembership_userId_status_idx" ON "ClassroomMembership"("userId", "status");
CREATE INDEX IF NOT EXISTS "ClassroomMembership_classroomId_status_idx" ON "ClassroomMembership"("classroomId", "status");
DO $$ BEGIN
  ALTER TABLE "ClassroomMembership" ADD CONSTRAINT "ClassroomMembership_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClassroomMembership" ADD CONSTRAINT "ClassroomMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClassroomInvitation" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "email" TEXT,
  "createdById" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "maxUses" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "isRevoked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassroomInvitation_token_key" ON "ClassroomInvitation"("token");
CREATE INDEX IF NOT EXISTS "ClassroomInvitation_classroomId_isRevoked_idx" ON "ClassroomInvitation"("classroomId", "isRevoked");
DO $$ BEGIN
  ALTER TABLE "ClassroomInvitation" ADD CONSTRAINT "ClassroomInvitation_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClassroomInvitation" ADD CONSTRAINT "ClassroomInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClassroomAnnouncement" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "title" TEXT,
  "content" TEXT NOT NULL,
  "isPinned" BOOLEAN NOT NULL DEFAULT false,
  "pinnedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomAnnouncement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClassroomAnnouncement_classroomId_isPinned_createdAt_idx" ON "ClassroomAnnouncement"("classroomId", "isPinned", "createdAt");
DO $$ BEGIN
  ALTER TABLE "ClassroomAnnouncement" ADD CONSTRAINT "ClassroomAnnouncement_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClassroomAnnouncement" ADD CONSTRAINT "ClassroomAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClassroomQuizAssignment" (
  "id" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT,
  "instructions" TEXT,
  "status" "QuizAssignmentStatus" NOT NULL DEFAULT 'DRAFT',
  "quizVersion" INTEGER NOT NULL DEFAULT 1,
  "questionSnapshot" JSONB,
  "startsAt" TIMESTAMP(3),
  "deadline" TIMESTAMP(3),
  "durationSecs" INTEGER,
  "maxAttempts" INTEGER NOT NULL DEFAULT 1,
  "randomizeQuestions" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomQuizAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ClassroomQuizAssignment_classroomId_status_idx" ON "ClassroomQuizAssignment"("classroomId", "status");
CREATE INDEX IF NOT EXISTS "ClassroomQuizAssignment_quizId_idx" ON "ClassroomQuizAssignment"("quizId");
CREATE INDEX IF NOT EXISTS "ClassroomQuizAssignment_createdById_idx" ON "ClassroomQuizAssignment"("createdById");
DO $$ BEGIN
  ALTER TABLE "ClassroomQuizAssignment" ADD CONSTRAINT "ClassroomQuizAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClassroomQuizAssignment" ADD CONSTRAINT "ClassroomQuizAssignment_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClassroomQuizAssignment" ADD CONSTRAINT "ClassroomQuizAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "QuizSubmission" (
  "id" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "quizId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "questionOrder" JSONB,
  "answersSnapshot" JSONB,
  "score" INTEGER NOT NULL DEFAULT 0,
  "totalQuestions" INTEGER NOT NULL,
  "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "timeTakenSecs" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuizSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "QuizSubmission_assignmentId_userId_attemptNumber_key" ON "QuizSubmission"("assignmentId", "userId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "QuizSubmission_assignmentId_status_score_idx" ON "QuizSubmission"("assignmentId", "status", "score");
CREATE INDEX IF NOT EXISTS "QuizSubmission_userId_idx" ON "QuizSubmission"("userId");
DO $$ BEGIN
  ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ClassroomQuizAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "QuizSubmission" ADD CONSTRAINT "QuizSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. Messaging Reactions, Deletions, Receipts, Preferences
CREATE TABLE IF NOT EXISTS "GroupMessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMessageReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMessageReaction_messageId_userId_emoji_key" ON "GroupMessageReaction"("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "GroupMessageReaction_messageId_idx" ON "GroupMessageReaction"("messageId");
DO $$ BEGIN
  ALTER TABLE "GroupMessageReaction" ADD CONSTRAINT "GroupMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GroupMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "GroupMessageReaction" ADD CONSTRAINT "GroupMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GroupMessageDeletion" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GroupMessageDeletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMessageDeletion_messageId_userId_key" ON "GroupMessageDeletion"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "GroupMessageDeletion_userId_idx" ON "GroupMessageDeletion"("userId");
DO $$ BEGIN
  ALTER TABLE "GroupMessageDeletion" ADD CONSTRAINT "GroupMessageDeletion_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GroupMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "GroupMessageDeletion" ADD CONSTRAINT "GroupMessageDeletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GroupMessageReceipt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seenAt" TIMESTAMP(3),
  CONSTRAINT "GroupMessageReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GroupMessageReceipt_messageId_userId_key" ON "GroupMessageReceipt"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "GroupMessageReceipt_userId_idx" ON "GroupMessageReceipt"("userId");
DO $$ BEGIN
  ALTER TABLE "GroupMessageReceipt" ADD CONSTRAINT "GroupMessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "GroupMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "GroupMessageReceipt" ADD CONSTRAINT "GroupMessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DirectMessageReaction" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "emoji" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessageReaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DirectMessageReaction_messageId_userId_emoji_key" ON "DirectMessageReaction"("messageId", "userId", "emoji");
CREATE INDEX IF NOT EXISTS "DirectMessageReaction_messageId_idx" ON "DirectMessageReaction"("messageId");
DO $$ BEGIN
  ALTER TABLE "DirectMessageReaction" ADD CONSTRAINT "DirectMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DirectMessageReaction" ADD CONSTRAINT "DirectMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DirectMessageDeletion" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectMessageDeletion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DirectMessageDeletion_messageId_userId_key" ON "DirectMessageDeletion"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "DirectMessageDeletion_userId_idx" ON "DirectMessageDeletion"("userId");
DO $$ BEGIN
  ALTER TABLE "DirectMessageDeletion" ADD CONSTRAINT "DirectMessageDeletion_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DirectMessageDeletion" ADD CONSTRAINT "DirectMessageDeletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DirectMessageReceipt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seenAt" TIMESTAMP(3),
  CONSTRAINT "DirectMessageReceipt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DirectMessageReceipt_messageId_userId_key" ON "DirectMessageReceipt"("messageId", "userId");
CREATE INDEX IF NOT EXISTS "DirectMessageReceipt_userId_idx" ON "DirectMessageReceipt"("userId");
DO $$ BEGIN
  ALTER TABLE "DirectMessageReceipt" ADD CONSTRAINT "DirectMessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "DirectMessageReceipt" ADD CONSTRAINT "DirectMessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ConversationPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "clearedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "lastReadAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConversationPreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationPreference_userId_targetType_targetId_key" ON "ConversationPreference"("userId", "targetType", "targetId");
CREATE INDEX IF NOT EXISTS "ConversationPreference_userId_targetType_idx" ON "ConversationPreference"("userId", "targetType");
DO $$ BEGIN
  ALTER TABLE "ConversationPreference" ADD CONSTRAINT "ConversationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
