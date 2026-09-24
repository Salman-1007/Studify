import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Layers,
  Plus,
  BookOpen,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  X,
  Clock,
  ChevronRight,
  Brain,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Flashcards() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('BANK'); // 'BANK' | 'AI'
  const [submitting, setSubmitting] = useState(false);

  // Bank Form State
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [bankCardCount, setBankCardCount] = useState(10);
  const [bankDeckTitle, setBankDeckTitle] = useState('');

  // AI Form State
  const [aiTopic, setAiTopic] = useState('');
  const [aiCardCount, setAiCardCount] = useState(8);
  const [aiMaterialId, setAiMaterialId] = useState('');

  // Queries
  const { data: decks = [], isLoading: loadingDecks } = useQuery({
    queryKey: ['decks'],
    queryFn: () => api.get('/flashcards/decks').then((r) => r.data.data.decks),
  });

  const { data: due = [] } = useQuery({
    queryKey: ['due-cards'],
    queryFn: () => api.get('/flashcards/due').then((r) => r.data.data.cards),
  });

  // Query boards
  const { data: boards } = useQuery({
    queryKey: ['curriculum-boards'],
    queryFn: () => api.get('/curriculum/boards').then((r) => r.data.data.boards),
  });

  const boardId = boards?.[0]?.id;

  // Query subjects
  const { data: subjects } = useQuery({
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

  // Query materials for AI deck
  const { data: materials } = useQuery({
    queryKey: ['materials'],
    queryFn: () => api.get('/materials').then((r) => r.data.data.materials),
  });

  // Submit Bank Deck
  const handleCreateBankDeck = async (e) => {
    e.preventDefault();
    if (!selectedChapterId) {
      showToast('Please select a curriculum chapter', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/flashcards/from-question-bank', {
        chapterId: selectedChapterId,
        subjectId: selectedSubjectId,
        count: Number(bankCardCount),
        title: bankDeckTitle.trim() || undefined,
      });

      showToast('Flashcard deck created from Question Bank!', 'success');
      setShowModal(false);
      queryClient.invalidateQueries(['decks']);
      navigate(`/flashcards/${res.data.data.deck.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not create deck from question bank', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit AI Deck
  const handleCreateAIDeck = async (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) {
      showToast('Please enter a topic', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/flashcards/generate-ai', {
        topic: aiTopic.trim(),
        numCards: Number(aiCardCount),
        materialId: aiMaterialId || undefined,
      });

      showToast('AI Flashcards generated!', 'success');
      setShowModal(false);
      queryClient.invalidateQueries(['decks']);
      navigate(`/flashcards/${res.data.data.deck.id}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not generate flashcards with AI', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors';

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Top Banner */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-900/40 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Spaced Repetition Engine
            </span>
            <span className="text-xs text-slate-400">Class 9 PTB Key Concepts</span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
            Board Exam Revision Flashcards
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            Memorize formulas, definitions, and high-yield board concepts faster with Leitner spaced repetition. Create decks directly from the official Punjab question bank or with AI.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer shrink-0 self-start md:self-auto"
        >
          <Plus size={15} />
          Create Flashcard Deck
        </button>
      </div>

      {/* Main Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Poppins' }}>
            Flashcard Decks
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {decks.length} total decks in your study library
          </p>
        </div>

        {due.length > 0 && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            <Clock size={14} />
            <span>{due.length} cards scheduled for review today</span>
          </div>
        )}
      </div>

      {/* Decks Grid */}
      {loadingDecks ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : decks.length === 0 ? (
        <EmptyState
          title="No flashcard decks yet"
          subtitle="Click 'Create Flashcard Deck' above to build a deck from your Punjab Textbook syllabus or using AI."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              to={`/flashcards/${deck.id}`}
              className="group rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 p-5 space-y-3 transition-all hover:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Layers size={16} />
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {deck._count?.cards || 0} cards
                  </span>
                </div>

                <h3 className="font-bold text-white text-base group-hover:text-amber-400 transition-colors line-clamp-2">
                  {deck.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                  Topic: {deck.topic || 'General Science'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 text-xs">
                <span className="text-slate-500">Spaced repetition active</span>
                <span className="text-amber-400 font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Study Now <ChevronRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Poppins' }}>
                  Create Flashcard Deck
                </h3>
                <p className="text-xs text-slate-400">
                  Select your preferred source for rapid syllabus memorization
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setModalMode('BANK')}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  modalMode === 'BANK'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BookOpen size={14} />
                <span>From Question Bank</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMode('AI')}
                className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  modalMode === 'AI'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles size={14} />
                <span>AI Generator</span>
              </button>
            </div>

            {/* Mode 1: From Question Bank */}
            {modalMode === 'BANK' && (
              <form onSubmit={handleCreateBankDeck} className="space-y-4 pt-1">
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Number of Cards
                    </label>
                    <select
                      value={bankCardCount}
                      onChange={(e) => setBankCardCount(e.target.value)}
                      className={inputClass}
                    >
                      <option value="5">5 Cards</option>
                      <option value="10">10 Cards</option>
                      <option value="15">15 Cards</option>
                      <option value="20">20 Cards</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Deck Title <span className="text-slate-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={bankDeckTitle}
                      onChange={(e) => setBankDeckTitle(e.target.value)}
                      placeholder="e.g. Kinematics Key Laws"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedChapterId}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <BookOpen size={14} />
                    <span>{submitting ? 'Generating Deck…' : 'Create from Question Bank'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Mode 2: AI Flashcards */}
            {modalMode === 'AI' && (
              <form onSubmit={handleCreateAIDeck} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Topic or Concept <span className="text-rose-400">*</span>
                  </label>
                  <input
                    required
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. Physics Formulas, Newton's Laws, SI Units"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Cards Count
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={aiCardCount}
                      onChange={(e) => setAiCardCount(e.target.value)}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Material <span className="text-slate-500">(Optional)</span>
                    </label>
                    <select
                      value={aiMaterialId}
                      onChange={(e) => setAiMaterialId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">No material</option>
                      {materials?.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2.5 justify-end pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !aiTopic.trim()}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    <Sparkles size={14} />
                    <span>{submitting ? 'Generating AI Deck…' : 'Generate with AI'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
