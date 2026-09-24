import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  Users,
  BookOpen,
  MessageSquare,
  FileText,
  Download,
  Trash2,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
  Plus,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';

export default function Admin() {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('OVERVIEW'); // 'OVERVIEW' | 'USERS' | 'MATERIALS' | 'CHATS' | 'PACKS'

  // Form state for creating question pack
  const [showPackModal, setShowPackModal] = useState(false);
  const [packForm, setPackForm] = useState({
    title: 'PTB Class 9 Physics - Board Exam Pack',
    description: 'Punjab Textbook Board Class 9 Physics full syllabus multiple choice questions with verified board answers.',
    classGrade: '9',
    subjectName: 'Physics',
    boardName: 'Punjab Textbook Board / PECTAA',
  });

  // Queries
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data.data),
  });

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data.data.users),
    enabled: activeTab === 'USERS' || activeTab === 'OVERVIEW',
  });

  const { data: materialsData, isLoading: loadingMaterials } = useQuery({
    queryKey: ['admin-materials'],
    queryFn: () => api.get('/admin/materials').then((r) => r.data.data.materials),
    enabled: activeTab === 'MATERIALS',
  });

  const { data: chatsData, isLoading: loadingChats } = useQuery({
    queryKey: ['admin-chats'],
    queryFn: () => api.get('/admin/chats-audit').then((r) => r.data.data),
    enabled: activeTab === 'CHATS',
  });

  const { data: packsData, isLoading: loadingPacks } = useQuery({
    queryKey: ['question-packs'],
    queryFn: () => api.get('/question-packs').then((r) => r.data.data.packs),
    enabled: activeTab === 'PACKS' || activeTab === 'OVERVIEW',
  });

  // Mutations
  const deactivateUserMutation = useMutation({
    mutationFn: (userId) => api.patch(`/admin/users/${userId}/deactivate`),
    onSuccess: () => {
      showToast('User deactivated', 'success');
      queryClient.invalidateQueries(['admin-users']);
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/materials/${id}`),
    onSuccess: () => {
      showToast('Material deleted from database', 'success');
      queryClient.invalidateQueries(['admin-materials']);
    },
  });

  const createPackMutation = useMutation({
    mutationFn: (data) => api.post('/question-packs', data),
    onSuccess: () => {
      showToast('Question pack published successfully!', 'success');
      setShowPackModal(false);
      queryClient.invalidateQueries(['question-packs']);
    },
    onError: (err) => {
      showToast(err.response?.data?.message || 'Failed to create pack', 'error');
    },
  });

  if (loadingStats) return <Skeleton className="h-96 rounded-2xl max-w-5xl mx-auto" />;

  const tabs = [
    { key: 'OVERVIEW', label: 'Overview', icon: Layers },
    { key: 'USERS', label: 'Users', icon: Users },
    { key: 'MATERIALS', label: 'Material Audit', icon: FileText },
    { key: 'CHATS', label: 'Chat Audit', icon: MessageSquare },
    { key: 'PACKS', label: 'Question Packs', icon: Package },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
              Admin Portal
            </span>
            <span className="text-xs text-slate-400">Production Moderation & Content Management</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight" style={{ fontFamily: 'Poppins' }}>
            System Administration
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/admin/questions"
            className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <BookOpen size={14} />
            <span>Manage Canonical MCQs</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin border-b border-slate-800">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === key
                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab: OVERVIEW */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Platform Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 font-medium uppercase">Registered Students</p>
              <p className="text-2xl font-bold text-white mt-1" style={{ fontFamily: 'Poppins' }}>
                {stats?.users || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 font-medium uppercase">Canonical MCQs</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1" style={{ fontFamily: 'Poppins' }}>
                {stats?.bankQuestions || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 font-medium uppercase">Standard Tests Completed</p>
              <p className="text-2xl font-bold text-blue-400 mt-1" style={{ fontFamily: 'Poppins' }}>
                {stats?.testAttempts || 0}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-400 font-medium uppercase">Study Groups</p>
              <p className="text-2xl font-bold text-amber-400 mt-1" style={{ fontFamily: 'Poppins' }}>
                {stats?.groups || 0}
              </p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid sm:grid-cols-3 gap-4">
            <div
              onClick={() => setActiveTab('MATERIALS')}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all cursor-pointer space-y-2"
            >
              <FileText className="text-blue-400" size={22} />
              <h3 className="text-sm font-bold text-white">Student Uploaded Materials</h3>
              <p className="text-xs text-slate-400">
                Audit {stats?.materials || 0} uploaded study notes, syllabus PDFs, and extracted text.
              </p>
            </div>

            <div
              onClick={() => setActiveTab('CHATS')}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all cursor-pointer space-y-2"
            >
              <MessageSquare className="text-emerald-400" size={22} />
              <h3 className="text-sm font-bold text-white">Live Chat Moderation</h3>
              <p className="text-xs text-slate-400">
                Monitor {stats?.directChats || 0} direct chat channels and group discussions for student safety.
              </p>
            </div>

            <div
              onClick={() => setActiveTab('PACKS')}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition-all cursor-pointer space-y-2"
            >
              <Package className="text-amber-400" size={22} />
              <h3 className="text-sm font-bold text-white">Downloadable Question Packs</h3>
              <p className="text-xs text-slate-400">
                Manage curriculum packs for offline JSON export and board review.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: USERS */}
      {activeTab === 'USERS' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Platform Users ({usersData?.length || 0})</h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden divide-y divide-slate-800">
            {loadingUsers ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading users…</div>
            ) : (
              usersData?.map((u) => (
                <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-100 text-sm">{u.name}</span>
                      <span className="text-slate-400">({u.email})</span>
                      {u.role === 'ADMIN' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-400 mt-1">
                      <span>{u.grade ? `Class ${u.grade}` : 'Class 9'}</span>
                      <span>•</span>
                      <span>{u.board || 'Punjab Board'}</span>
                      <span>•</span>
                      <span className="text-amber-400 font-semibold">{u.points || 0} XP</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${u.isActive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </span>
                    {u.isActive && u.role !== 'ADMIN' && (
                      <button
                        type="button"
                        onClick={() => deactivateUserMutation.mutate(u.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 text-[11px] border border-slate-700 hover:border-rose-900/40 transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: MATERIALS AUDIT */}
      {activeTab === 'MATERIALS' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Student Uploaded Materials</h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden divide-y divide-slate-800">
            {loadingMaterials ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading uploaded materials…</div>
            ) : materialsData?.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No materials uploaded yet.</div>
            ) : (
              materialsData?.map((mat) => (
                <div key={mat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-100 text-sm flex items-center gap-2">
                      <FileText size={16} className="text-blue-400" />
                      {mat.title}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      Uploaded by <strong>{mat.user?.name}</strong> ({mat.user?.email}) •{' '}
                      {new Date(mat.createdAt).toLocaleDateString()}
                    </p>
                    {mat.extractedText && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 max-w-xl">
                        Preview: {mat.extractedText.slice(0, 140)}…
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {mat.fileUrl && (
                      <a
                        href={mat.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-1.5"
                      >
                        <ExternalLink size={13} />
                        View File
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Delete this material?')) {
                          deleteMaterialMutation.mutate(mat.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30"
                      title="Delete material"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: CHAT AUDIT */}
      {activeTab === 'CHATS' && (
        <div className="space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-base font-bold text-white mb-3">1-on-1 Direct Chat Channels</h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden divide-y divide-slate-800">
              {loadingChats ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading chat logs…</div>
              ) : chatsData?.directChats?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No active direct chats yet.</div>
              ) : (
                chatsData?.directChats?.map((chat) => (
                  <div key={chat.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-200">
                          {chat.user1?.name} & {chat.user2?.name}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700">
                          {chat.status}
                        </span>
                      </div>
                      <span className="text-slate-500">{chat._count?.messages || 0} messages</span>
                    </div>

                    {chat.messages && chat.messages.length > 0 && (
                      <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/80 space-y-1">
                        {chat.messages.slice(0, 2).map((m) => (
                          <p key={m.id} className="text-[11px] text-slate-400">
                            <strong className="text-slate-300">{m.sender?.name}:</strong>{' '}
                            <span className={m.isUnsent ? 'italic text-slate-600' : ''}>
                              {m.isUnsent ? 'This message was unsent' : m.content}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-white mb-3">Recent Group Discussions</h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden divide-y divide-slate-800">
              {chatsData?.recentGroupMessages?.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No recent group messages.</div>
              ) : (
                chatsData?.recentGroupMessages?.map((m) => (
                  <div key={m.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <span className="font-semibold text-blue-400">{m.sender?.name}</span>{' '}
                      <span className="text-slate-500">in [{m.group?.name}]</span>
                      <p className={`mt-0.5 ${m.isUnsent ? 'italic text-slate-500' : 'text-slate-200'}`}>
                        {m.isUnsent ? 'This message was unsent' : m.content}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: QUESTION PACKS */}
      {activeTab === 'PACKS' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Downloadable Curriculum Packs</h2>
              <p className="text-xs text-slate-400">
                Official JSON and offline test bank bundles for student practice and review
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPackModal(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Pack</span>
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {loadingPacks ? (
              <Skeleton className="h-44 rounded-2xl" />
            ) : packsData?.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-xs text-slate-500 bg-slate-900/30 rounded-2xl border border-slate-800">
                No question packs created yet. Click "Create Pack" above.
              </div>
            ) : (
              packsData?.map((pack) => (
                <div key={pack.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                        Class {pack.classGrade} • {pack.subjectName}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1.5">{pack.title}</h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {pack.downloads} downloads
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {pack.description}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-500">{pack.boardName}</span>
                    <a
                      href={`/api/question-packs/${pack.id}/download`}
                      download
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Download JSON</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Create Pack Modal */}
      {showPackModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Poppins' }}>
              Create Curriculum Question Pack
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Pack Title</label>
                <input
                  type="text"
                  value={packForm.title}
                  onChange={(e) => setPackForm({ ...packForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Class / Grade</label>
                <input
                  type="text"
                  value={packForm.classGrade}
                  onChange={(e) => setPackForm({ ...packForm, classGrade: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Subject</label>
                <input
                  type="text"
                  value={packForm.subjectName}
                  onChange={(e) => setPackForm({ ...packForm, subjectName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={packForm.description}
                  onChange={(e) => setPackForm({ ...packForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPackModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={createPackMutation.isPending}
                onClick={() => createPackMutation.mutate(packForm)}
                className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-md shadow-blue-500/20"
              >
                {createPackMutation.isPending ? 'Publishing…' : 'Publish Pack'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
