import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  Upload,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
  Search,
  BookOpen,
  Copy,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function AdminQuestions() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [classFilter, setClassFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importChapterId, setImportChapterId] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [isImporting, setIsImporting] = useState(false);

  // 1. Fetch Subjects for filter
  const { data: subjects } = useQuery({
    queryKey: ['curriculum-subjects-all', classFilter],
    queryFn: () =>
      api
        .get('/curriculum/subjects', { params: { classGrade: classFilter || undefined } })
        .then((r) => r.data.data.subjects),
  });

  // 2. Fetch Chapters for dropdowns
  const { data: chapters } = useQuery({
    queryKey: ['curriculum-chapters-all', classFilter, subjectFilter],
    queryFn: () =>
      api
        .get('/curriculum/chapters', {
          params: {
            subjectId: subjectFilter || undefined,
            classGrade: classFilter || undefined,
          },
        })
        .then((r) => r.data.data.chapters),
  });

  // 3. Fetch Questions with filters
  const { data: questionsData, isLoading } = useQuery({
    queryKey: ['admin-questions', classFilter, subjectFilter, statusFilter, chapterFilter, difficultyFilter, searchTerm, page],
    queryFn: () =>
      api
        .get('/admin/questions', {
          params: {
            classGrade: classFilter || undefined,
            subjectId: subjectFilter || undefined,
            status: statusFilter || undefined,
            chapterId: chapterFilter || undefined,
            difficulty: difficultyFilter || undefined,
            search: searchTerm || undefined,
            page,
            limit: 20,
          },
        })
        .then((r) => r.data.data),
  });

  // 4. Status Mutation (Approve / Reject)
  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => api.patch(`/admin/questions/${id}/status`, { status }),
    onSuccess: (_, variables) => {
      showToast(`Question marked as ${variables.status}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Could not update question status', 'error');
    },
  });

  // 5. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/questions/${id}`),
    onSuccess: () => {
      showToast('Question deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Could not delete question', 'error');
    },
  });

  // 6. Handle Bulk JSON Import
  const handleImportJson = async () => {
    if (!importJsonText.trim()) {
      showToast('Please paste a JSON array of questions', 'error');
      return;
    }

    let parsedQuestions;
    try {
      parsedQuestions = JSON.parse(importJsonText);
      if (!Array.isArray(parsedQuestions)) {
        showToast('JSON must be an array of question objects', 'error');
        return;
      }
    } catch (err) {
      showToast('Invalid JSON syntax: ' + err.message, 'error');
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await api.post('/admin/questions/import-json', {
        questions: parsedQuestions,
        defaultChapterId: importChapterId || undefined,
      });

      setImportResult(res.data.data);
      showToast(`Import completed: ${res.data.data.importedCount} questions added!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-questions'] });
    } catch (err) {
      showToast(err.response?.data?.message || 'Import failed', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const sampleJson = [
    {
      questionText: 'Which one of the following is a derived quantity in physics?',
      optionA: 'Length',
      optionB: 'Mass',
      optionC: 'Speed',
      optionD: 'Time',
      correctOption: 'C',
      difficulty: 'EASY',
      explanation: 'Speed is derived from distance (length) divided by time (m/s).',
      tags: ['physical quantities', 'derived units'],
    },
  ];

  const copySampleJson = () => {
    setImportJsonText(JSON.stringify(sampleJson, null, 2));
    showToast('Sample JSON copied into editor', 'info');
  };

  const questions = questionsData?.questions || [];
  const pagination = questionsData?.pagination || {};

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
              Admin Portal
            </span>
            <span className="text-xs text-slate-400">Punjab Textbook Board / PECTAA</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
            Canonical Question Bank Management
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Review, approve, curate, and bulk import MCQs across classes and subjects.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsImportModalOpen(true);
            setImportResult(null);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/20 cursor-pointer self-start sm:self-auto"
        >
          <Upload size={16} />
          Bulk Import JSON
        </button>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
        {/* Class Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Class</label>
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSubjectFilter('');
              setChapterFilter('');
              setPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Classes</option>
            <option value="9">Class 9</option>
            <option value="10">Class 10</option>
          </select>
        </div>

        {/* Subject Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Subject</label>
          <select
            value={subjectFilter}
            onChange={(e) => {
              setSubjectFilter(e.target.value);
              setChapterFilter('');
              setPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Subjects</option>
            {subjects?.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.subjectName} ({sub.classGrade ? `Cl ${sub.classGrade}` : ''})
              </option>
            ))}
          </select>
        </div>

        {/* Chapter Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Chapter</label>
          <select
            value={chapterFilter}
            onChange={(e) => {
              setChapterFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Chapters</option>
            {chapters?.map((chap) => (
              <option key={chap.id} value={chap.id}>
                Ch {chap.chapterNumber}: {chap.chapterName || chap.title}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {/* Difficulty Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty</label>
          <select
            value={difficultyFilter}
            onChange={(e) => {
              setDifficultyFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Search Text</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search question..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Questions Table / List */}
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : questions.length === 0 ? (
        <div className="text-center py-16 border border-slate-800 rounded-2xl bg-slate-900/30 text-slate-400">
          <BookOpen size={36} className="mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">No questions found</p>
          <p className="text-xs text-slate-500 mt-1">Adjust your filters or import new questions using the JSON tool.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Showing {questions.length} of {pagination.total || questions.length} questions
            </span>
            <span>
              Page {pagination.page || 1} of {pagination.totalPages || 1}
            </span>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
            {questions.map((q) => {
              const statusColors = {
                APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                PENDING_REVIEW: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
              };

              const chapterTitle = q.chapter?.chapterName || q.chapter?.title;

              return (
                <div key={q.id} className="p-5 space-y-3">
                  {/* Top metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          statusColors[q.status] || 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {q.status}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Class {q.classGrade} · {q.subject?.subjectName || ''}
                      </span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {q.difficulty}
                      </span>
                      {q.chapter && (
                        <span className="text-xs text-slate-400">
                          Ch {q.chapter.chapterNumber}: {chapterTitle}
                        </span>
                      )}
                      {q.topic && (
                        <span className="text-xs text-slate-500">· {q.topic.topicName || q.topic.title}</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {q.status !== 'APPROVED' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: q.id, status: 'APPROVED' })}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle size={13} />
                          Approve
                        </button>
                      )}

                      {q.status !== 'REJECTED' && (
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: q.id, status: 'REJECTED' })}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-xs font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <XCircle size={13} />
                          Reject
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this question?')) {
                            deleteMutation.mutate(q.id);
                          }
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title="Delete question"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <p className="text-sm font-medium text-slate-100">{q.questionText}</p>

                  {/* Options */}
                  <div className="grid sm:grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'A', text: q.optionA },
                      { key: 'B', text: q.optionB },
                      { key: 'C', text: q.optionC },
                      { key: 'D', text: q.optionD },
                    ].map(({ key, text }) => {
                      const isCorrect = q.correctAnswer === key || q.correctOption === key;
                      return (
                        <div
                          key={key}
                          className={`p-2 rounded-lg border flex items-center gap-2 ${
                            isCorrect
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold'
                              : 'border-slate-800 bg-slate-900/30 text-slate-400'
                          }`}
                        >
                          <span className="font-bold">{key}.</span>
                          <span className="line-clamp-1">{text}</span>
                          {isCorrect && (
                            <span className="ml-auto text-emerald-400 text-xs font-medium">Correct</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {q.explanation && (
                    <p className="text-xs text-slate-400 bg-slate-800/40 p-2.5 rounded-lg border border-slate-800">
                      <span className="text-slate-300 font-medium">Explanation: </span>
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-between items-center pt-3">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-slate-400">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* JSON Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-semibold text-white" style={{ fontFamily: 'Poppins' }}>
                  Bulk Import Questions (JSON)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Import structured MCQs with automatic duplicate detection and validation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* Target Chapter selection */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Chapter (Applied if not specified per question)
              </label>
              <select
                value={importChapterId}
                onChange={(e) => setImportChapterId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select Chapter...</option>
                {chapters?.map((chap) => (
                  <option key={chap.id} value={chap.id}>
                    Ch {chap.chapterNumber}: {chap.chapterName || chap.title} ({chap.subject?.subjectName || ''} {chap.subject?.classGrade ? `Cl ${chap.subject.classGrade}` : ''})
                  </option>
                ))}
              </select>
            </div>

            {/* Template sample button */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Paste JSON array below:</span>
              <button
                type="button"
                onClick={copySampleJson}
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
              >
                <Copy size={13} />
                Load Sample JSON
              </button>
            </div>

            {/* JSON Textarea */}
            <textarea
              rows={9}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder={`[\n  {\n    "questionText": "...",\n    "optionA": "...",\n    "optionB": "...",\n    "optionC": "...",\n    "optionD": "...",\n    "correctOption": "A",\n    "difficulty": "MEDIUM",\n    "explanation": "..."\n  }\n]`}
              className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500 resize-y"
            />

            {/* Import Results Banner */}
            {importResult && (
              <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-3 font-semibold">
                  <span className="text-emerald-400">✓ {importResult.importedCount} Imported</span>
                  <span className="text-amber-400">⚠ {importResult.skippedCount} Skipped (Duplicates)</span>
                </div>
                {importResult.skippedDetails?.length > 0 && (
                  <div className="text-slate-400 max-h-28 overflow-y-auto space-y-1 pt-1 border-t border-slate-700">
                    {importResult.skippedDetails.map((sk, idx) => (
                      <p key={idx} className="line-clamp-1">
                        • {sk.reason}: "{sk.questionText}"
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isImporting}
                onClick={handleImportJson}
                className="px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                {isImporting ? 'Importing...' : 'Run Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
