import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Send, Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Skeleton from '../components/Skeleton.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function Mentor() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const materialId = searchParams.get('material');
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const bottomRef = useRef(null);

  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data.data.conversations),
  });

  const { data: conversation, isLoading, error } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => api.get(`/conversations/${conversationId}`).then((r) => r.data.data.conversation),
    enabled: Boolean(conversationId),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages?.length]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const message = input.trim();
    setInput('');
    setSending(true);
    try {
      const res = await api.post('/ai/chat', { conversationId, message, materialId: !conversationId ? materialId : undefined });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      if (!conversationId) {
        navigate(`/mentor/${res.data.data.conversationId}`);
      } else {
        qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'The AI Mentor is unavailable right now', 'error');
      setInput(message);
    } finally {
      setSending(false);
    }
  };

  const deleteConversation = async (id) => {
    await api.delete(`/conversations/${id}`);
    qc.invalidateQueries({ queryKey: ['conversations'] });
    if (id === conversationId) navigate('/mentor');
  };

  const saveRename = async (id) => {
    await api.put(`/conversations/${id}`, { title: renameValue });
    qc.invalidateQueries({ queryKey: ['conversations'] });
    setRenamingId(null);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <aside className="w-64 hidden md:flex flex-col border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
        <button
          onClick={() => navigate('/mentor')}
          className="flex items-center gap-2 px-4 py-3 text-sm text-blue-400 hover:bg-slate-800 border-b border-slate-800"
        >
          <Plus size={16} /> New conversation
        </button>
        <div className="flex-1 overflow-y-auto">
          {conversations?.length === 0 && <p className="text-xs text-slate-500 px-4 py-3">No conversations yet</p>}
          {conversations?.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer ${c.id === conversationId ? 'bg-slate-800' : 'hover:bg-slate-800/60'}`}
              onClick={() => navigate(`/mentor/${c.id}`)}
            >
              {renamingId === c.id ? (
                <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                  <button onClick={() => saveRename(c.id)}><Check size={14} className="text-emerald-400" /></button>
                  <button onClick={() => setRenamingId(null)}><X size={14} className="text-slate-500" /></button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate">{c.title}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-200"
                    onClick={(e) => { e.stopPropagation(); setRenamingId(c.id); setRenameValue(c.title); }}
                  ><Pencil size={13} /></button>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                  ><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col border border-slate-800 rounded-xl bg-slate-900/40 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!conversationId && (
            <EmptyState title="Ask your AI Mentor anything" subtitle="Start a new conversation — it can reference materials you've uploaded." />
          )}
          {isLoading && <Skeleton className="h-16" />}
          {error && <p className="text-red-400 text-sm">Couldn't load this conversation.</p>}
          {conversation?.messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-100'}`}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
                <p className="text-[10px] opacity-60 mt-1">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-400">Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-slate-800 p-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask a question about what you're studying…"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={send} disabled={sending}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-lg p-2.5 text-white"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
