import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, History, Play, CheckCircle, Award, Sparkles, Filter, ChevronRight, Layers } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function StudentQuestionBank() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(() => user?.class || user?.grade || '9');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [mode, setMode] = useState('PRACTICE');
  const [generating, setGenerating] = useState(false);

  // 1. Fetch Boards
  const { data: boards, isLoading: loadingBoards } = useQuery({
    queryKey: ['curriculum-boards'],
    queryFn: () => api.get('/curriculum/boards').then((r) => r.data.data.boards),
  });

  // Automatically select Punjab Board when loaded
  useEffect(() => {
    if (boards && boards.length > 0 && !selectedBoardId) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  // 1b. Fetch dynamic classes/tracks
  const { data: availableClasses = ['9', '10', '11', '12', 'MDCAT', 'ECAT'] } = useQuery({
    queryKey: ['curriculum-classes'],
    queryFn: () => api.get('/curriculum/classes').then((r) => r.data.data.classes),
  });

  // 2. Fetch Subjects for Selected Grade/Track
  const isEntryTest = selectedGrade === 'MDCAT' || selectedGrade === 'ECAT';
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ['curriculum-subjects', selectedBoardId, selectedGrade],
    queryFn: () =>
      api
        .get('/curriculum/subjects', {
          params: {
            boardId: isEntryTest ? undefined : selectedBoardId,
            classGrade: selectedGrade,
          },
        })
        .then((r) => r.data.data.subjects),
  });

  // Automatically select first subject when subjects load or change
  useEffect(() => {
    if (subjects && subjects.length > 0) {
      const exists = subjects.some((s) => s.id === selectedSubjectId);
      if (!exists) {
        setSelectedSubjectId(subjects[0].id);
        setSelectedChapterId('');
      }
    }
  }, [subjects, selectedSubjectId]);

  // 3. Fetch Chapters for selected Subject
  const { data: chapters, isLoading: loadingChapters } = useQuery({
    queryKey: ['curriculum-chapters', selectedSubjectId],
    queryFn: () =>
      api.get('/curriculum/chapters', { params: { subjectId: selectedSubjectId } }).then((r) => r.data.data.chapters),
    enabled: !!selectedSubjectId,
  });

  // Automatically select first chapter when chapters load
  useEffect(() => {
    if (chapters && chapters.length > 0) {
      const exists = chapters.some((c) => c.id === selectedChapterId);
      if (!exists) {
        setSelectedChapterId(chapters[0].id);
      }
    }
  }, [chapters, selectedChapterId]);

  // 4. Fetch Topics for selected Chapter
  const { data: topics } = useQuery({
    queryKey: ['curriculum-topics', selectedChapterId],
    queryFn: () =>
      api.get('/curriculum/topics', { params: { chapterId: selectedChapterId } }).then((r) => r.data.data.topics),
    enabled: !!selectedChapterId,
  });

  const currentSubject = subjects?.find((s) => s.id === selectedSubjectId);
  const selectedChapter = chapters?.find((c) => c.id === selectedChapterId);
  const totalApprovedQuestions = chapters?.reduce((acc, c) => acc + (c._count?.questions ?? c._count?.questionItems ?? 0), 0) || 0;

  const handleStartTest = async () => {
    if (!selectedChapterId) {
      showToast('Please select a chapter to begin', 'error');
      return;
    }

    setGenerating(true);
    try {
      const subjectLabel = currentSubject ? `${currentSubject.subjectName} ${selectedGrade}` : `Class ${selectedGrade}`;
      const title = `${subjectLabel} · Ch ${selectedChapter ? selectedChapter.chapterNumber : ''}: ${selectedChapter ? selectedChapter.title : 'Chapter'} Test`;

      const payload = {
        title,
        chapterId: selectedChapterId,
        topicId: selectedTopicId || undefined,
        difficulty: difficulty || undefined,
        questionCount: Number(questionCount),
        mode,
      };

      const res = await api.post('/tests', payload);
      const attempt = res.data.data.attempt;
      showToast('Test generated successfully!', 'success');
      navigate(`/tests/${attempt.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate test. Ensure approved questions exist.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
              Curriculum Question Bank
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300">
              Punjab Textbook Board / PECTAA
            </span>
            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Class {selectedGrade} {currentSubject?.subjectName || ''}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: 'Poppins' }}>
            Canonical Question Bank & Chapter Tests
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Practice board-aligned MCQs with verified answers, instant scoring, and server-validated XP rewards.
          </p>
        </div>

        <Link
          to="/tests/history"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-sm text-slate-200 transition-colors self-start md:self-auto"
        >
          <History size={16} className="text-blue-400" />
          Test History
        </Link>
      </div>

      {/* Class & Subject Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Track / Grade:</span>
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            {availableClasses.map((grade) => (
              <button
                key={grade}
                type="button"
                onClick={() => {
                  setSelectedGrade(grade);
                  setSelectedSubjectId('');
                  setSelectedChapterId('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  String(selectedGrade) === String(grade)
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {grade === 'MDCAT' ? 'MDCAT (Medical)' : grade === 'ECAT' ? 'ECAT (Engg)' : `Class ${grade}`}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 ml-2">Subject:</span>
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            {loadingSubjects ? (
              <span className="text-xs text-slate-500 px-3 py-1.5">Loading subjects...</span>
            ) : subjects?.length ? (
              subjects.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubjectId(sub.id);
                    setSelectedChapterId('');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    selectedSubjectId === sub.id
                      ? 'bg-blue-500 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sub.subjectName}
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-500 px-3 py-1.5">No subjects found</span>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Layers size={14} className="text-emerald-400" />
          <span>Curriculum Bank: <strong className="text-emerald-400">{totalApprovedQuestions} MCQs</strong></span>
        </div>
      </div>

      {loadingBoards || loadingSubjects ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Chapters Explorer */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={16} className="text-blue-400" />
              {currentSubject?.subjectName || 'Subject'} {selectedGrade} Chapters
            </h2>

            {loadingChapters ? (
              <Skeleton className="h-40" />
            ) : !chapters || chapters.length === 0 ? (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 text-sm text-slate-400">
                No chapters found for this subject.
              </div>
            ) : (
              <div className="space-y-2">
                {chapters.map((chap) => {
                  const isSelected = selectedChapterId === chap.id;
                  const mcqCount = chap._count?.questions ?? chap._count?.questionItems ?? 0;
                  return (
                    <button
                      key={chap.id}
                      onClick={() => {
                        setSelectedChapterId(chap.id);
                        setSelectedTopicId('');
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-sm shadow-blue-500/10'
                          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
                      }`}
                    >
                      <div>
                        <p className={`text-xs font-semibold ${isSelected ? 'text-blue-400' : 'text-slate-400'}`}>
                          Chapter {chap.chapterNumber}
                        </p>
                        <p className="text-sm font-medium text-slate-200 mt-0.5 line-clamp-1">{chap.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {mcqCount} approved MCQ{mcqCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <ChevronRight size={18} className={isSelected ? 'text-blue-400' : 'text-slate-600'} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Test Generator Configuration */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="font-semibold text-lg text-white" style={{ fontFamily: 'Poppins' }}>
                    Configure Test Attempt
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedChapter
                      ? `Selected: Chapter ${selectedChapter.chapterNumber} — ${selectedChapter.title}`
                      : 'Select a chapter on the left to start'}
                  </p>
                </div>
                <Sparkles size={20} className="text-amber-400" />
              </div>

              {/* Form Options */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Topic Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Topic (Optional)
                  </label>
                  <select
                    value={selectedTopicId}
                    onChange={(e) => setSelectedTopicId(e.target.value)}
                    disabled={!selectedChapterId || !topics || topics.length === 0}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 disabled:opacity-40 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Topics in Chapter</option>
                    {topics?.map((top) => (
                      <option key={top.id} value={top.id}>
                        {top.topicNumber ? `${top.topicNumber} ` : ''}{top.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Difficulty Filter */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="">All Difficulties (Balanced)</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>

                {/* Number of Questions */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Number of Questions
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[5, 10, 15, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setQuestionCount(num)}
                        className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                          questionCount === num
                            ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                            : 'border-slate-700 hover:border-slate-600 text-slate-400'
                        }`}
                      >
                        {num} MCQs
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Test Mode
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('PRACTICE')}
                      className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                        mode === 'PRACTICE'
                          ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                          : 'border-slate-700 hover:border-slate-600 text-slate-400'
                      }`}
                    >
                      Practice
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('TEST')}
                      className={`py-2 text-xs font-medium rounded-lg border transition-all ${
                        mode === 'TEST'
                          ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                          : 'border-slate-700 hover:border-slate-600 text-slate-400'
                      }`}
                    >
                      Exam Test
                    </button>
                  </div>
                </div>
              </div>

              {/* Start Test CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={!selectedChapterId || generating}
                  onClick={handleStartTest}
                  className="w-full py-3 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                >
                  <Play size={18} fill="currentColor" />
                  {generating ? 'Generating Test...' : 'Start Chapter Test'}
                </button>
                <p className="text-center text-xs text-slate-500 mt-2">
                  Answers are securely checked on the server. Earn up to {questionCount * 10} XP!
                </p>
              </div>
            </div>

            {/* Curriculum Quality Guarantee Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-4 flex items-start gap-3">
              <Award className="text-amber-400 shrink-0 mt-0.5" size={20} />
              <div className="text-xs text-slate-400 leading-relaxed">
                <p className="font-semibold text-slate-200">Verified Board Alignment</p>
                Questions in this question bank strictly follow the Punjab Textbook Board / PECTAA Class {selectedGrade} {currentSubject?.subjectName || 'Curriculum'} syllabus. Every question undergoes teacher verification and syllabus cross-checking before approval.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
