import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Sparkles, FileText, BookOpen } from 'lucide-react';
import { api } from '../lib/api.js';

export default function ShareStudyModal({ open, onClose, onSelect }) {
  const [tab, setTab] = useState('QUIZ');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteExcerpt, setNoteExcerpt] = useState('');

  const { data: quizzes = [] } = useQuery({
    queryKey: ['share-quizzes'],
    queryFn: () => api.get('/quizzes').then((r) => r.data.data?.quizzes || r.data.data || []),
    enabled: open && tab === 'QUIZ',
  });

  const { data: materials = [] } = useQuery({
    queryKey: ['share-materials'],
    queryFn: () => api.get('/materials').then((r) => r.data.data?.materials || r.data.data || []),
    enabled: open && tab === 'MATERIAL',
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ fontFamily: 'Poppins' }}>
            Share Study Content
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="flex gap-1.5 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
          {[
            { key: 'QUIZ', label: 'Quiz', icon: Sparkles },
            { key: 'MATERIAL', label: 'Material', icon: FileText },
            { key: 'STUDY_NOTE', label: 'Study Note', icon: BookOpen },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                tab === key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800/60'
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'QUIZ' && (
          <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
            {quizzes.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No quizzes available to share yet.</p>
            ) : (
              quizzes.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    onSelect({
                      messageType: 'QUIZ',
                      attachment: { id: q.id, title: q.title },
                      defaultContent: `Shared quiz: ${q.title}`,
                    });
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold">{q.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {q.subject || 'General'} • {q.difficulty || 'MEDIUM'}
                  </p>
                </button>
              ))
            )}
          </div>
        )}

        {tab === 'MATERIAL' && (
          <div className="max-h-60 overflow-y-auto space-y-2 scrollbar-thin">
            {materials.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Upload study notes first to share them here.</p>
            ) : (
              materials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect({
                      messageType: 'MATERIAL',
                      attachment: { id: m.id, title: m.title },
                      defaultContent: `Shared study material: ${m.title}`,
                    });
                    onClose();
                  }}
                  className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-indigo-500/50 bg-slate-950/50 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-semibold">{m.title}</p>
                  <p className="text-[11px] text-slate-400">{m.fileType || 'Document'}</p>
                </button>
              ))
            )}
          </div>
        )}

        {tab === 'STUDY_NOTE' && (
          <div className="space-y-3 text-xs">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Note title (e.g. Newton's Laws Summary)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <input
              type="text"
              value={noteTopic}
              onChange={(e) => setNoteTopic(e.target.value)}
              placeholder="Subject / Topic (optional)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <textarea
              rows={3}
              value={noteExcerpt}
              onChange={(e) => setNoteExcerpt(e.target.value)}
              placeholder="Key summary or formula…"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
            <button
              type="button"
              disabled={!noteTitle.trim()}
              onClick={() => {
                onSelect({
                  messageType: 'STUDY_NOTE',
                  attachment: {
                    title: noteTitle.trim(),
                    topic: noteTopic.trim() || null,
                    excerpt: noteExcerpt.trim(),
                  },
                  defaultContent: `Shared study note: ${noteTitle.trim()}`,
                });
                setNoteTitle('');
                setNoteTopic('');
                setNoteExcerpt('');
                onClose();
              }}
              className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold cursor-pointer"
            >
              Attach Study Note
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
