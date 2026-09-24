import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Sparkles, ArrowLeft, Layers, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function QuizCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [createMode, setCreateMode] = useState('BANK'); // 'BANK' | 'AI'
  const [submitting, setSubmitting] = useState(false);

  // Question bank state
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [bankDifficulty, setBankDifficulty] = useState('MIXED');
  const [bankQuestionCount, setBankQuestionCount] = useState(10);
  const [bankTitle, setBankTitle] = useState('');

  // AI quiz state
  const [aiForm, setAiForm] = useState({
    topic: '',
    subject: 'Physics',
    difficulty: 'MEDIUM',
    numQuestions: 5,
    materialId: '',
  });

  // Query boards
  const { data: boards } = useQuery({
    queryKey: ['curriculum-boards'],
    queryFn: () => api.get('/curriculum/boards').then((r) => r.data.data.boards),
  });

  const boardId = boards?.[0]?.id;

  // Query subjects
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ['curriculum-subjects', boardId],
    queryFn: () => api.get('/curriculum/subjects', { params: { boardId, gradeLevel: '9' } }).then((r) => r.data.data.subjects),
    enabled: !!boardId,
  });

  useEffect(() => {
    if (subjects && subjects.length > 0 && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  // Query chapters
  const { data: chapters, isLoading: loadingChapters } = useQuery({
    queryKey: ['curriculum-chapters', selectedSubjectId],
    queryFn: () => api.get('/curriculum/chapters', { params: { subjectId: selectedSubjectId } }).then((r) => r.data.data.chapters),
    enabled: !!selectedSubjectId,
  });

  useEffect(() => {
    if (chapters && chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  // Query user's materials for AI quiz source
  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: () => api.get('/materials').then((r) => r.data.data.materials),
  });

  // Submit from Question Bank
  const handleCreateFromBank = async (e) => {
    e.preventDefault();
    if (!selectedChapterId) {
      showToast('Please select a curriculum chapter', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/quizzes/from-question-bank', {
        chapterId: selectedChapterId,
        subjectId: selectedSubjectId,
        difficulty: bankDifficulty,
        count: Number(bankQuestionCount),
        title: bankTitle.trim() || undefined,
      });

      showToast('Quiz created from Question Bank!', 'success');
      navigate(`/quizzes/${res.data.data.quiz.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not create quiz from question bank', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit from AI Generator
  const handleCreateFromAI = async (e) => {
    e.preventDefault();
    if (!aiForm.topic.trim()) {
      showToast('Please enter a topic', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/ai/generate-quiz', {
        ...aiForm,
        numQuestions: Number(aiForm.numQuestions),
        materialId: aiForm.materialId || undefined,
      });

      showToast('AI Quiz generated successfully!', 'success');
      navigate(`/quizzes/${res.data.data.quiz.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate quiz with AI', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <Link
          to="/quizzes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors mb-2"
        >
          <ArrowLeft size={14} /> Back to Quizzes
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
          Create a Quiz
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Choose between verified Punjab Textbook Board question bank items or AI-generated quiz questions
        </p>
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
        <button
          type="button"
          onClick={() => setCreateMode('BANK')}
          className={`flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            createMode === 'BANK'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <BookOpen size={16} />
          <span>Curriculum Question Bank</span>
        </button>

        <button
          type="button"
          onClick={() => setCreateMode('AI')}
          className={`flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            createMode === 'AI'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Sparkles size={16} />
          <span>AI-Powered Generator</span>
        </button>
      </div>

      {/* MODE 1: From Canonical Question Bank */}
      {createMode === 'BANK' && (
        <form
          onSubmit={handleCreateFromBank}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 space-y-5 shadow-xl backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Verified PTB Syllabus Questions
            </span>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Subject & Book
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedChapterId('');
              }}
              className={inputClass}
            >
              {subjects?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.bookName || s.subjectName} (Class {s.classGrade})
                </option>
              ))}
            </select>
          </div>

          {/* Chapter Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Chapter
            </label>
            {loadingChapters ? (
              <Skeleton className="h-10 rounded-xl" />
            ) : (
              <select
                value={selectedChapterId}
                onChange={(e) => setSelectedChapterId(e.target.value)}
                className={inputClass}
              >
                {chapters?.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    Ch {ch.chapterNumber}: {ch.chapterName}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Difficulty & Number of Questions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Difficulty Level
              </label>
              <select
                value={bankDifficulty}
                onChange={(e) => setBankDifficulty(e.target.value)}
                className={inputClass}
              >
                <option value="MIXED">Mixed (Balanced)</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Number of MCQs
              </label>
              <select
                value={bankQuestionCount}
                onChange={(e) => setBankQuestionCount(e.target.value)}
                className={inputClass}
              >
                <option value="5">5 Questions</option>
                <option value="10">10 Questions (Standard)</option>
                <option value="15">15 Questions</option>
                <option value="20">20 Questions (Full Test)</option>
              </select>
            </div>
          </div>

          {/* Custom Quiz Title (Optional) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Custom Quiz Title <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={bankTitle}
              onChange={(e) => setBankTitle(e.target.value)}
              placeholder="e.g. Physics Chapter 1 Speed Drill"
              className={inputClass}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !selectedChapterId}
            className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
          >
            <BookOpen size={16} />
            <span>{submitting ? 'Generating Quiz…' : 'Create Quiz from Question Bank'}</span>
          </button>
        </form>
      )}

      {/* MODE 2: AI-Powered Generator */}
      {createMode === 'AI' && (
        <form
          onSubmit={handleCreateFromAI}
          className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-7 space-y-5 shadow-xl backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
              Gemini & Groq AI Generator
            </span>
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Topic or Concept <span className="text-rose-400">*</span>
            </label>
            <input
              required
              value={aiForm.topic}
              onChange={(e) => setAiForm({ ...aiForm, topic: e.target.value })}
              placeholder="e.g. Newton's Laws of Motion, Work and Energy, Scalars & Vectors"
              className={inputClass}
            />
          </div>

          {/* Subject & Optional Notes Material */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Subject
              </label>
              <input
                value={aiForm.subject}
                onChange={(e) => setAiForm({ ...aiForm, subject: e.target.value })}
                placeholder="e.g. Physics, Chemistry"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Source Material <span className="text-slate-500">(Optional)</span>
              </label>
              <select
                value={aiForm.materialId}
                onChange={(e) => setAiForm({ ...aiForm, materialId: e.target.value })}
                className={inputClass}
              >
                <option value="">No material (General Curriculum)</option>
                {materials?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Difficulty & Number of Questions */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Difficulty
              </label>
              <select
                value={aiForm.difficulty}
                onChange={(e) => setAiForm({ ...aiForm, difficulty: e.target.value })}
                className={inputClass}
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Questions
              </label>
              <input
                type="number"
                min={3}
                max={15}
                value={aiForm.numQuestions}
                onChange={(e) => setAiForm({ ...aiForm, numQuestions: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting || !aiForm.topic.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
          >
            <Sparkles size={16} />
            <span>{submitting ? 'Generating AI Quiz…' : 'Generate Quiz with AI'}</span>
          </button>
        </form>
      )}
    </div>
  );
}
