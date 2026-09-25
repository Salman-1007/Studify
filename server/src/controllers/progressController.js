import { prisma } from '../config/db.js';
import { ok } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getProgress = asyncHandler(async(req, res) => {
    const userId = req.user.id;
    const [standardAttempts, attempts, sessions, topicPerf, groups, deckCount, user] = await Promise.all([
        prisma.standardTestAttempt.findMany({
            where: { userId, isSubmitted: true },
            include: { subject: true, chapter: true },
            orderBy: { submittedAt: 'desc' },
        }),
        prisma.quizAttempt.findMany({
            where: { userId },
            include: { quiz: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.studySession.findMany({ where: { userId } }),
        prisma.userTopicPerformance.findMany({ where: { userId } }),
        prisma.groupMember.count({ where: { userId } }),
        prisma.flashcardDeck.count({ where: { userId } }),
        prisma.user.findUnique({
            where: { id: userId },
            select: { points: true, streakCount: true, level: true },
        }),
    ]);

    const totalQuizzes = attempts.length + standardAttempts.length;
    const totalScore =
        attempts.reduce((s, a) => s + (a.score || 0), 0) +
        standardAttempts.reduce((s, a) => s + (a.score || 0), 0);
    const totalQuestions =
        attempts.reduce((s, a) => s + (a.totalQuestions || 0), 0) +
        standardAttempts.reduce((s, a) => s + (a.totalQuestions || 0), 0);

    const avgAccuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
    const standardMins = Math.round(standardAttempts.reduce((s, a) => s + (a.timeTakenSecs || 0), 0) / 60);
    const sessionMins = sessions.reduce((s, x) => s + x.minutes, 0);
    const totalStudyMinutes = Math.max(standardMins + sessionMins, standardAttempts.length > 0 ? standardAttempts.length * 3 : 0);

    const weakTopics = topicPerf
        .filter((t) => t.isWeak || (t.totalCount >= 1 && (t.correctCount / t.totalCount) < 0.6))
        .map((t) => t.topic);

    const weakTopicsDetails = topicPerf
        .filter((t) => t.isWeak || (t.totalCount >= 1 && (t.correctCount / t.totalCount) < 0.6))
        .map((t) => ({
            topic: t.topic,
            subject: t.subject || 'Physics',
            accuracy: Math.round((t.correctCount / t.totalCount) * 100),
            totalCount: t.totalCount,
        }));

    const bySubject = {};
    for (const a of attempts) {
        const key = a.quiz.subject || a.quiz.topic || 'General';
        if (!bySubject[key]) bySubject[key] = { subject: key, attempts: 0, totalPercentage: 0 };
        bySubject[key].attempts += 1;
        bySubject[key].totalPercentage += a.percentage;
    }
    for (const sa of standardAttempts) {
        const key = sa.subject?.subjectName || 'Physics';
        if (!bySubject[key]) bySubject[key] = { subject: key, attempts: 0, totalPercentage: 0 };
        bySubject[key].attempts += 1;
        bySubject[key].totalPercentage += sa.percentage;
    }

    const subjectPerformance = Object.values(bySubject).map((s) => ({
        subject: s.subject,
        attempts: s.attempts,
        avgPercentage: Math.round(s.totalPercentage / s.attempts),
    }));

    const recentStandard = standardAttempts.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.subject?.bookName || a.subject?.subjectName
            ? `${a.subject.bookName || a.subject.subjectName} - ${a.chapter?.chapterName || 'Chapter Test'}`
            : 'Practice Test',
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: Math.round(a.percentage || 0),
        date: a.submittedAt || a.createdAt,
        type: 'Standard Test',
        url: `/tests/${a.id}/results`,
    }));

    const recentQuizzes = attempts.slice(0, 5).map((a) => ({
        id: a.id,
        title: a.quiz?.title || 'Practice Quiz',
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: Math.round(a.percentage || 0),
        date: a.createdAt,
        type: 'Quiz',
        url: `/quizzes/${a.quizId}/results`,
    }));

    const recentAttempts = [...recentStandard, ...recentQuizzes]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 6);

    const points = user?.points ?? req.user.points ?? 0;
    const dynamicLevel = Math.floor(points / 100) + 1;
    const streakCount = user?.streakCount ?? req.user.streakCount ?? 0;

    ok(res, {
        quizzesCompleted: totalQuizzes,
        standardTestsCount: standardAttempts.length,
        customQuizzesCount: attempts.length,
        avgAccuracy,
        totalStudyMinutes,
        streakCount,
        xp: points,
        level: dynamicLevel,
        weakTopics,
        weakTopicsDetails,
        subjectPerformance,
        groupsJoined: groups,
        flashcardDecks: deckCount,
        recentAttempts,
    });
});