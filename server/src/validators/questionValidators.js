import { z } from 'zod';

export const normalizeQuestionText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // remove punctuation
        .replace(/\s+/g, ' ') // collapse whitespace
        .trim();
};

export const singleQuestionSchema = z.object({
    boardId: z.string().optional(),
    board: z.string().optional(),
    classGrade: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
    class: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
    subjectId: z.string().optional(),
    subject: z.string().optional(),
    book: z.string().optional(),
    chapterId: z.string().optional(),
    chapter: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
    topicId: z.string().optional().nullable(),
    topic: z.string().optional().nullable(),

    questionText: z.string().min(5, 'Question text must be at least 5 characters').optional(),
    question: z.string().min(5, 'Question text must be at least 5 characters').optional(),

    optionA: z.string().optional(),
    optionB: z.string().optional(),
    optionC: z.string().optional(),
    optionD: z.string().optional(),
    options: z.union([
        z.object({
            A: z.string().min(1),
            B: z.string().min(1),
            C: z.string().min(1),
            D: z.string().min(1),
        }),
        z.array(z.string()).length(4),
    ]).optional(),

    correctAnswer: z.string().optional(),
    correctOption: z.string().optional(),
    explanation: z.string().optional().nullable(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).default('PENDING_REVIEW'),
    questionType: z.enum(['MCQ']).default('MCQ'),
    sourceType: z.enum(['ORIGINAL', 'IMPORTED', 'AI_GENERATED']).default('ORIGINAL'),
    sourceReference: z.string().optional().nullable(),
}).transform((data) => {
    const qText = data.questionText || data.question || '';
    let optA = data.optionA;
    let optB = data.optionB;
    let optC = data.optionC;
    let optD = data.optionD;

    if (data.options) {
        if (Array.isArray(data.options)) {
            optA = data.options[0];
            optB = data.options[1];
            optC = data.options[2];
            optD = data.options[3];
        } else {
            optA = data.options.A;
            optB = data.options.B;
            optC = data.options.C;
            optD = data.options.D;
        }
    }

    const correct = (data.correctAnswer || data.correctOption || '').trim().toUpperCase();

    return {
        ...data,
        questionText: qText,
        optionA: optA || '',
        optionB: optB || '',
        optionC: optC || '',
        optionD: optD || '',
        correctAnswer: correct,
    };
}).refine((data) => data.questionText.length >= 5, {
    message: 'Question text is required',
    path: ['questionText'],
}).refine((data) => data.optionA && data.optionB && data.optionC && data.optionD, {
    message: 'All 4 options (A, B, C, D) are required',
    path: ['options'],
}).refine((data) => ['A', 'B', 'C', 'D'].includes(data.correctAnswer), {
    message: 'Correct answer must be A, B, C, or D',
    path: ['correctAnswer'],
});

export const updateQuestionSchema = z.object({
    questionText: z.string().min(5).optional(),
    optionA: z.string().min(1).optional(),
    optionB: z.string().min(1).optional(),
    optionC: z.string().min(1).optional(),
    optionD: z.string().min(1).optional(),
    correctAnswer: z.enum(['A', 'B', 'C', 'D']).optional(),
    correctOption: z.enum(['A', 'B', 'C', 'D']).optional(),
    explanation: z.string().optional().nullable(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    status: z.enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED']).optional(),
    sourceType: z.enum(['ORIGINAL', 'IMPORTED', 'AI_GENERATED']).optional(),
    sourceReference: z.string().optional().nullable(),
    topicId: z.string().optional().nullable(),
}).transform((data) => {
    if (data.correctOption && !data.correctAnswer) {
        data.correctAnswer = data.correctOption;
    }
    return data;
});

export const bulkImportSchema = z.object({
    version: z.string().optional(),
    board: z.string().optional(),
    questions: z.array(z.any()).min(1, 'Questions array must contain at least 1 item'),
});

export const createTestSchema = z.object({
    boardId: z.string().optional(),
    class: z.union([z.string(), z.number()]).transform((v) => String(v)).optional(),
    subjectId: z.string().optional(),
    chapterId: z.string().min(1, 'Chapter ID is required'),
    topicId: z.string().optional().nullable(),
    title: z.string().optional(),
    mode: z.enum(['PRACTICE', 'TEST']).optional(),
    questionCount: z.coerce.number().int().min(1, 'At least 1 question is required').max(50, 'Max 50 questions').default(10),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'MIXED']).default('MIXED'),
});

export const submitTestSchema = z.object({
    testId: z.string().optional(),
    attemptId: z.string().optional(),
    answers: z.array(
        z.object({
            questionId: z.string().min(1, 'questionId is required'),
            selectedOption: z.string().optional().nullable(),
            timeSpentSeconds: z.coerce.number().int().min(0).optional(),
            isFlagged: z.boolean().optional(),
        })
    ).optional(),
    responses: z.array(
        z.object({
            questionId: z.string().min(1, 'questionId is required'),
            selectedOption: z.string().optional().nullable(),
            timeSpentSeconds: z.coerce.number().int().min(0).optional(),
            isFlagged: z.boolean().optional(),
        })
    ).optional(),
    durationSeconds: z.coerce.number().int().min(0).optional(),
    timeTakenSecs: z.coerce.number().int().min(0).optional(),
    tabSwitchCount: z.coerce.number().int().min(0).optional(),
    telemetry: z.any().optional(),
}).transform((data) => {
    const rawAnswers = data.responses || data.answers || [];
    const answers = rawAnswers.map((a) => ({
        questionId: a.questionId,
        selectedOption: a.selectedOption ? a.selectedOption.trim().toUpperCase() : null,
        timeSpentSeconds: a.timeSpentSeconds || 0,
        isFlagged: Boolean(a.isFlagged),
    }));
    const timeTaken = data.durationSeconds !== undefined ? data.durationSeconds : (data.timeTakenSecs || 0);
    return {
        ...data,
        answers,
        timeTakenSecs: timeTaken,
        tabSwitchCount: data.tabSwitchCount || 0,
    };
});