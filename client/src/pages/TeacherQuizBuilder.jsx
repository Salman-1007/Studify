import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Database,
  Upload,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  FileText,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

const emptyQuestion = () => ({
  question: '',
  type: 'MCQ',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
});

export default function TeacherQuizBuilder() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const quizId = searchParams.get('quizId');
  const [mode, setMode] = useState('NOTES'); // 'NOTES' | 'BANK' | 'MANUAL'

  // Mode A: Question Bank form
  const [bankForm, setBankForm] = useState({
    boardId: '',
    classGrade: '9',
    subjectId: '',
    chapterId: '',
    difficulty: 'MEDIUM',
    count: 10,
    title: '',
  });

  // Mode B: AI Notes Upload form
  const [notesForm, setNotesForm] = useState({
    title: '',
    topic: '',
    subject: '',
    difficulty: 'MEDIUM',
    numQuestions: 8,
    materialText: '',
  });
  const [noteFile, setNoteFile] = useState(null);

  // Mode C & Editor state
  const [draft, setDraft] = useState({
    title: '',
    description: '',
    topic: '',
    subject: '',
    difficulty: 'MEDIUM',
    status: 'DRAFT',
    questions: [emptyQuestion()],
  });

  // Load quiz if editing existing quizId
  const { data: loadedQuiz, isLoading: loadingQuiz } = useQuery({
    queryKey: ['teacher-quiz', quizId],
    queryFn: () => api.get(`/teacher/quizzes/${quizId}`).then((r) => r.data.data.quiz),
    enabled: Boolean(quizId),
  });

  useEffect(() => {
    if (loadedQuiz) {
      setDraft({
        title: loadedQuiz.title || '',
        description: loadedQuiz.description || '',
        topic: loadedQuiz.topic || '',
        subject: loadedQuiz.subject || '',
        difficulty: loadedQuiz.difficulty || 'MEDIUM',
        status: loadedQuiz.status || 'DRAFT',
        questions:
          loadedQuiz.questions?.length > 0
            ? loadedQuiz.questions.map((q) => ({
                id: q.id,
                question: q.question || '',
                type: q.type || 'MCQ',
                options: Array.isArray(q.options) && q.options.length > 0 ? q.options : ['', '', '', ''],
                correctAnswer: q.correctAnswer || '',
                explanation: q.explanation || '',
              }))
            : [emptyQuestion()],
      });
    }
  }, [loadedQuiz]);

  // Curriculum selectors for Mode A
  const { data: boards = [] } = useQuery({
    queryKey: ['curriculum-boards'],
    queryFn: () => api.get('/curriculum/boards').then((r) => r.data.data.boards),
    enabled: !quizId && mode === 'BANK',
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['curriculum-subjects', bankForm.boardId, bankForm.classGrade],
    queryFn: () =>
      api
        .get('/curriculum/subjects', {
          params: {
            boardId: bankForm.boardId || undefined,
            classGrade: bankForm.classGrade || undefined,
          },
        })
        .then((r) => r.data.data.subjects),
    enabled: !quizId && mode === 'BANK',
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ['curriculum-chapters', bankForm.subjectId],
    queryFn: () =>
      api
        .get('/curriculum/chapters', { params: { subjectId: bankForm.subjectId } })
        .then((r) => r.data.data.chapters),
    enabled: !quizId && mode === 'BANK' && Boolean(bankForm.subjectId),
  });

  // Mutations
  const generateBankMutation = useMutation({
    mutationFn: (payload) => api.post('/teacher/quizzes/generate-from-bank', payload),
    onSuccess: (res) => {
      const q = res.data.data.quiz;
      showToast('Draft quiz created from curriculum bank! Review & edit below.', 'success');
      queryClient.invalidateQueries(['teacher-quizzes']);
      setSearchParams({ quizId: q.id });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Could not generate from bank', 'error'),
  });

  const generateNotesMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      if (notesForm.title.trim()) fd.append('title', notesForm.title.trim());
      if (notesForm.topic.trim()) fd.append('topic', notesForm.topic.trim());
      if (notesForm.subject.trim()) fd.append('subject', notesForm.subject.trim());
      fd.append('difficulty', notesForm.difficulty);
      fd.append('numQuestions', String(notesForm.numQuestions));
      if (notesForm.materialText.trim()) fd.append('materialText', notesForm.materialText.trim());
      if (noteFile) fd.append('file', noteFile);
      return api.post('/teacher/quizzes/generate-from-notes', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (res) => {
      const q = res.data.data.quiz;
      showToast('AI draft quiz ready! Review & customize questions below.', 'success');
      queryClient.invalidateQueries(['teacher-quizzes']);
      setSearchParams({ quizId: q.id });
    },
    onError: (err) => showToast(err.response?.data?.message || 'Failed to generate quiz from notes', 'error'),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ nextStatus }) => {
      const cleanedQuestions = draft.questions.map((q) => ({
        question: q.question.trim(),
        type: q.type || 'MCQ',
        options:
          q.type === 'MCQ'
            ? q.options.map((o) => o.trim()).filter(Boolean)
            : q.type === 'TRUE_FALSE'
            ? ['True', 'False']
            : [],
        correctAnswer: q.correctAnswer.trim(),
        explanation: q.explanation?.trim() || null,
      }));

      if (quizId) {
        return api.put(`/teacher/quizzes/${quizId}`, {
          title: draft.title.trim(),
          description: draft.description?.trim() || null,
          topic: draft.topic.trim() || 'General',
          subject: draft.subject?.trim() || null,
          difficulty: draft.difficulty,
          status: nextStatus || draft.status,
          questions: cleanedQuestions,
        });
      }

      const created = await api.post('/teacher/quizzes', {
        title: draft.title.trim(),
        description: draft.description?.trim() || null,
        topic: draft.topic.trim() || 'General',
        subject: draft.subject?.trim() || null,
        difficulty: draft.difficulty,
        questions: cleanedQuestions,
      });
      return created;
    },
    onSuccess: (res, vars) => {
      const saved = res.data.data.quiz;
      showToast(
        vars.nextStatus === 'PUBLISHED' ? 'Quiz published!' : 'Draft saved successfully',
        'success'
      );
      queryClient.invalidateQueries(['teacher-quizzes']);
      if (!quizId && saved?.id) {
        setSearchParams({ quizId: saved.id });
      }
      if (vars.redirectToLibrary) {
        navigate('/teacher/quizzes');
      }
    },
    onError: (err) => showToast(err.response?.data?.message || 'Could not save quiz', 'error'),
  });

  const updateQuestion = (index, patch) => {
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    }));
  };

  const moveQuestion = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= draft.questions.length) return;
    setDraft((prev) => {
      const next = [...prev.questions];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, questions: next };
    });
  };

  if (quizId && loadingQuiz) return <Skeleton className="h-96 rounded-2xl max-w-4xl mx-auto" />;

  const showEditor = Boolean(quizId) || mode === 'MANUAL';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <Link to="/teacher/quizzes" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-1">
            <ArrowLeft size={13} /> Quiz Library
          </Link>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
            {quizId ? 'Edit & Review Quiz' : 'Teacher Quiz Builder'}
          </h1>
          <p className="text-xs text-slate-400">
            Generate MCQs from lecture notes or the verified bank, then inspect, edit, and publish before assigning.
          </p>
        </div>
      </div>

      {!quizId && (
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'NOTES', label: 'From Notes / PDF / DOCX (AI)', icon: Upload },
            { key: 'BANK', label: 'From Question Bank', icon: Database },
            { key: 'MANUAL', label: 'Manual Builder', icon: Plus },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                mode === key
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'border border-slate-800 text-slate-300 hover:bg-slate-900'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Mode B: Notes Upload / AI */}
      {!quizId && mode === 'NOTES' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generateNotesMutation.mutate();
          }}
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 text-xs"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Quiz Title (optional)</label>
              <input
                value={notesForm.title}
                onChange={(e) => setNotesForm({ ...notesForm, title: e.target.value })}
                placeholder="e.g. Chapter 3 Kinematics Check"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Subject</label>
              <input
                value={notesForm.subject}
                onChange={(e) => setNotesForm({ ...notesForm, subject: e.target.value })}
                placeholder="Physics, Biology, Chemistry…"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Topic Focus</label>
              <input
                value={notesForm.topic}
                onChange={(e) => setNotesForm({ ...notesForm, topic: e.target.value })}
                placeholder="e.g. Equations of Motion"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Difficulty</label>
              <select
                value={notesForm.difficulty}
                onChange={(e) => setNotesForm({ ...notesForm, difficulty: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Question Count</label>
              <input
                type="number"
                min={3}
                max={30}
                value={notesForm.numQuestions}
                onChange={(e) => setNotesForm({ ...notesForm, numQuestions: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Upload Lecture Notes (PDF, DOCX, or TXT — max 10MB)
            </label>
            <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-950/60 p-5 cursor-pointer transition-colors">
              <FileText size={18} className="text-indigo-400" />
              <span className="text-slate-300 font-medium">
                {noteFile ? `${noteFile.name} (${Math.round(noteFile.size / 1024)} KB)` : 'Click to choose PDF, DOCX, or TXT file'}
              </span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Or Paste Lecture Notes / Syllabus Excerpt</label>
            <textarea
              rows={5}
              value={notesForm.materialText}
              onChange={(e) => setNotesForm({ ...notesForm, materialText: e.target.value })}
              placeholder="Paste key paragraphs, definitions, or formulas here…"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={generateNotesMutation.isPending}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles size={15} />
            {generateNotesMutation.isPending ? 'Extracting & Generating Draft…' : 'Generate Editable Draft Quiz'}
          </button>
        </form>
      )}

      {/* Mode A: Question Bank */}
      {!quizId && mode === 'BANK' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generateBankMutation.mutate({
              subjectId: bankForm.subjectId || undefined,
              chapterId: bankForm.chapterId || undefined,
              difficulty: bankForm.difficulty,
              count: Number(bankForm.count) || 10,
              title: bankForm.title.trim() || undefined,
            });
          }}
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 space-y-4 text-xs"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Board</label>
              <select
                value={bankForm.boardId}
                onChange={(e) => setBankForm({ ...bankForm, boardId: e.target.value, subjectId: '', chapterId: '' })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="">All Boards</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Class / Track</label>
              <select
                value={bankForm.classGrade}
                onChange={(e) => setBankForm({ ...bankForm, classGrade: e.target.value, subjectId: '', chapterId: '' })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              >
                {['9', '10', '11', '12', 'MDCAT', 'ECAT'].map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Subject</label>
              <select
                value={bankForm.subjectId}
                onChange={(e) => setBankForm({ ...bankForm, subjectId: e.target.value, chapterId: '' })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="">Any Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.subjectName} (Class {s.classGrade})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Chapter (optional)</label>
              <select
                value={bankForm.chapterId}
                onChange={(e) => setBankForm({ ...bankForm, chapterId: e.target.value })}
                disabled={!bankForm.subjectId}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 disabled:opacity-50"
              >
                <option value="">All Chapters</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.chapterName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Custom Title</label>
              <input
                value={bankForm.title}
                onChange={(e) => setBankForm({ ...bankForm, title: e.target.value })}
                placeholder="Optional quiz title"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Difficulty</label>
              <select
                value={bankForm.difficulty}
                onChange={(e) => setBankForm({ ...bankForm, difficulty: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              >
                <option value="MIXED">Mixed</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Number of Questions</label>
              <input
                type="number"
                min={3}
                max={50}
                value={bankForm.count}
                onChange={(e) => setBankForm({ ...bankForm, count: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={generateBankMutation.isPending}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <Database size={15} />
            {generateBankMutation.isPending ? 'Loading Approved MCQs…' : 'Create Editable Draft from Bank'}
          </button>
        </form>
      )}

      {/* Full Draft Editor */}
      {showEditor && (
        <div className="space-y-5 text-xs">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Quiz Title *</label>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Quiz title"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Subject</label>
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  placeholder="Physics"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Topic</label>
                <input
                  value={draft.topic}
                  onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                  placeholder="Kinematics"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Difficulty</label>
                <select
                  value={draft.difficulty}
                  onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {draft.questions.map((q, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-indigo-400">Question #{idx + 1}</span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(idx, { type: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200"
                    >
                      <option value="MCQ">MCQ</option>
                      <option value="TRUE_FALSE">True / False</option>
                      <option value="FILL_BLANK">Fill Blank</option>
                    </select>
                    <button type="button" onClick={() => moveQuestion(idx, -1)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" onClick={() => moveQuestion(idx, 1)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                      <ArrowDown size={13} />
                    </button>
                    {draft.questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            questions: prev.questions.filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={q.question}
                  onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                  placeholder="Enter question stem…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                />

                {q.type === 'MCQ' && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((optIdx) => (
                      <input
                        key={optIdx}
                        value={q.options?.[optIdx] || ''}
                        onChange={(e) => {
                          const nextOpts = [...(q.options || ['', '', '', ''])];
                          nextOpts[optIdx] = e.target.value;
                          updateQuestion(idx, { options: nextOpts });
                        }}
                        placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                      />
                    ))}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Correct Answer (must match option text for MCQ)</label>
                    <input
                      value={q.correctAnswer}
                      onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                      placeholder="Exact correct answer"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Explanation (shown after submission)</label>
                    <input
                      value={q.explanation}
                      onChange={(e) => updateQuestion(idx, { explanation: e.target.value })}
                      placeholder="Brief explanation…"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, questions: [...prev.questions, emptyQuestion()] }))}
              className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} /> Add Question
            </button>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                disabled={saveDraftMutation.isPending}
                onClick={() => saveDraftMutation.mutate({ nextStatus: 'DRAFT' })}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={14} /> Save Draft
              </button>
              <button
                type="button"
                disabled={saveDraftMutation.isPending}
                onClick={() => saveDraftMutation.mutate({ nextStatus: 'PUBLISHED', redirectToLibrary: true })}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} /> Publish Quiz & Open Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
