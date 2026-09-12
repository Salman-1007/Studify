import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function QuizResults() {
  const { state } = useLocation();
  const { id } = useParams();
  const navigate = useNavigate();

  if (!state) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p>Results aren't available — take the quiz again to see your score.</p>
        <button onClick={() => navigate(`/quizzes/${id}`)} className="mt-4 text-blue-400 text-sm">Retry quiz</button>
      </div>
    );
  }

  const { attempt, pointsEarned, achievementsAwarded } = state;

  return (
    <div className="max-w-xl space-y-6">
      <div className="text-center">
        <p className="text-4xl font-semibold" style={{ fontFamily: 'Poppins' }}>{Math.round(attempt.percentage)}%</p>
        <p className="text-slate-400 mt-1">{attempt.score} / {attempt.totalQuestions} correct · +{pointsEarned} points</p>
      </div>

      {achievementsAwarded?.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm px-4 py-3">
          Achievement unlocked: {achievementsAwarded.join(', ')}
        </div>
      )}

      <div className="space-y-3">
        {attempt.questionAttempts.map((qa) => (
          <div key={qa.id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-start gap-2">
              {qa.isCorrect ? <CheckCircle2 className="text-emerald-400 mt-0.5" size={16} /> : <XCircle className="text-red-400 mt-0.5" size={16} />}
              <div>
                <p className="text-sm">{qa.question.question}</p>
                <p className="text-xs text-slate-400 mt-1">Your answer: {qa.givenAnswer || '—'}</p>
                {!qa.isCorrect && <p className="text-xs text-emerald-400 mt-0.5">Correct answer: {qa.question.correctAnswer}</p>}
                {qa.question.explanation && <p className="text-xs text-slate-500 mt-1">{qa.question.explanation}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate(`/quizzes/${id}`)} className="text-sm px-4 py-2 rounded-lg border border-slate-700">Retry</button>
        <button onClick={() => navigate('/quizzes')} className="text-sm px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 font-medium">Back to quizzes</button>
      </div>
    </div>
  );
}
