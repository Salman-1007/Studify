-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('ORIGINAL', 'IMPORTED', 'AI_GENERATED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "Board" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CurriculumSubject" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "classGrade" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "bookName" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumSubject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CurriculumChapter" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterNumber" INTEGER NOT NULL,
    "chapterName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CurriculumTopic" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "topicName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuestionBankItem" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "classGrade" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "topicId" TEXT,
    "questionText" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "optionC" TEXT NOT NULL,
    "optionD" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" "QuizDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "status" "QuestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "questionType" "QuestionType" NOT NULL DEFAULT 'MCQ',
    "sourceType" "SourceType" NOT NULL DEFAULT 'ORIGINAL',
    "sourceReference" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StandardTestAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "classGrade" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT 'MIXED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "unansweredCount" INTEGER NOT NULL DEFAULT 0,
    "timeTakenSecs" INTEGER NOT NULL DEFAULT 0,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StandardTestAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StandardQuestionAttempt" (
    "id" TEXT NOT NULL,
    "testAttemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "selectedOption" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StandardQuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Board_name_key" ON "Board"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Board_code_key" ON "Board"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumSubject_boardId_classGrade_subjectName_key" ON "CurriculumSubject"("boardId", "classGrade", "subjectName");
CREATE INDEX IF NOT EXISTS "CurriculumSubject_boardId_classGrade_idx" ON "CurriculumSubject"("boardId", "classGrade");
CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumChapter_subjectId_chapterNumber_key" ON "CurriculumChapter"("subjectId", "chapterNumber");
CREATE INDEX IF NOT EXISTS "CurriculumChapter_subjectId_idx" ON "CurriculumChapter"("subjectId");
CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumTopic_chapterId_topicName_key" ON "CurriculumTopic"("chapterId", "topicName");
CREATE INDEX IF NOT EXISTS "CurriculumTopic_chapterId_idx" ON "CurriculumTopic"("chapterId");
CREATE INDEX IF NOT EXISTS "QuestionBankItem_boardId_classGrade_subjectId_chapterId_status_idx" ON "QuestionBankItem"("boardId", "classGrade", "subjectId", "chapterId", "status");
CREATE INDEX IF NOT EXISTS "QuestionBankItem_status_idx" ON "QuestionBankItem"("status");
CREATE INDEX IF NOT EXISTS "QuestionBankItem_chapterId_normalizedText_idx" ON "QuestionBankItem"("chapterId", "normalizedText");
CREATE INDEX IF NOT EXISTS "StandardTestAttempt_userId_idx" ON "StandardTestAttempt"("userId");
CREATE INDEX IF NOT EXISTS "StandardTestAttempt_subjectId_idx" ON "StandardTestAttempt"("subjectId");
CREATE INDEX IF NOT EXISTS "StandardQuestionAttempt_testAttemptId_idx" ON "StandardQuestionAttempt"("testAttemptId");

